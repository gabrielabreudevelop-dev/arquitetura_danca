/**
 * Ficha do aluno: os dados da carga mais um histórico único (períodos,
 * ajustes, trancamentos, matrículas e encerramentos), do mais recente ao
 * mais antigo, com quem fez cada coisa e o que ainda pode ser anulado.
 */
import { and, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  ajustesPeriodo,
  bloqueiosContato,
  contatos,
  encerramentosAluno,
  lotesExtensao,
  loteTurmas,
  matriculas,
  mensagensProntas,
  modulos,
  periodosContratados,
  pessoas,
  planos,
  ritmos,
  trancamentos,
  transferencias,
  turmaDias,
  turmas,
} from "../banco/esquema";
import { ehUuid } from "../cadastros/comum";
import { LISTAS_ALUNO } from "../contatos/valores";
import { type Executor, podeExcluirAluno } from "./cadastro";
import { type AlunoCarregado, carregarAlunos, rotuloDaTurma } from "./carga";
import { type DataIso, diasEntre, formatarDia } from "./datas";
import { contarDias, formatarDiasComSinal } from "./periodos";

export type AcaoAnular = {
  tipo: "ajuste" | "periodo" | "trancamento" | "transferencia" | "lote";
  id: string;
};

export type ItemHistorico = {
  em: Date;
  tipo:
    | "periodo"
    | "ajuste"
    | "trancamento"
    | "matricula"
    | "saida_turma"
    | "encerramento"
    | "reabertura";
  texto: string;
  por: string;
  anulado: { em: Date; por: string; motivo: string } | null;
  anular: AcaoAnular | null;
  /** Id do trancamento aberto, quando este item é um. */
  destrancar?: string;
};

export type Ficha = {
  aluno: AlunoCarregado;
  historico: ItemHistorico[];
  matriculasEncerradas: { rotulo: string; entrada: DataIso; saida: DataIso }[];
  contatos: {
    em: Date;
    por: string;
    mensagem: string | null;
    resultado: string | null;
    grupoId: string;
  }[];
  podeExcluir: boolean;
  naoQuerContato: { em: Date; por: string } | null;
};

const ORDEM_NO_EMPATE: Record<ItemHistorico["tipo"], number> = {
  periodo: 0,
  matricula: 1,
  saida_turma: 2,
  ajuste: 3,
  trancamento: 4,
  encerramento: 5,
  reabertura: 6,
};

const SEM_AUTOR = "—";

type Anulacao = {
  anuladoEm: Date | null;
  anuladoPor: string | null;
  motivoAnulacao: string | null;
};

/** "08/12" → instante do meio-dia em São Paulo (sem horário de verão desde 2019). */
function meioDiaEmSaoPaulo(data: DataIso): Date {
  return new Date(`${data}T12:00:00-03:00`);
}

function contarAulas(n: number): string {
  return `${n} ${n === 1 ? "aula" : "aulas"}`;
}

function juntarComE(itens: string[]): string {
  return itens.join(" e ");
}

export async function obterFicha(
  db: Executor,
  alunoId: string,
  hoje: DataIso,
): Promise<Ficha | null> {
  if (!ehUuid(alunoId)) return null;
  const [aluno] = await carregarAlunos(db, hoje, { ids: [alunoId] });
  if (!aluno) return null;

  const periodos = await db
    .select({
      id: periodosContratados.id,
      inicio: periodosContratados.inicio,
      fim: periodosContratados.fim,
      origem: periodosContratados.origem,
      plano: planos.nome,
      criadoPor: periodosContratados.criadoPor,
      criadoEm: periodosContratados.criadoEm,
      anuladoEm: periodosContratados.anuladoEm,
      anuladoPor: periodosContratados.anuladoPor,
      motivoAnulacao: periodosContratados.motivoAnulacao,
    })
    .from(periodosContratados)
    .leftJoin(planos, eq(planos.id, periodosContratados.planoId))
    .where(eq(periodosContratados.alunoId, aluno.id));
  const idsPeriodos = periodos.map((p) => p.id);

  const ajustes = idsPeriodos.length
    ? await db
        .select({
          id: ajustesPeriodo.id,
          tipo: ajustesPeriodo.tipo,
          dias: ajustesPeriodo.dias,
          quantidade: ajustesPeriodo.quantidadeDigitada,
          unidade: ajustesPeriodo.unidadeDigitada,
          motivo: ajustesPeriodo.motivo,
          loteId: ajustesPeriodo.loteId,
          transferenciaId: ajustesPeriodo.transferenciaId,
          criadoPor: ajustesPeriodo.criadoPor,
          criadoEm: ajustesPeriodo.criadoEm,
          anuladoEm: ajustesPeriodo.anuladoEm,
          anuladoPor: ajustesPeriodo.anuladoPor,
          motivoAnulacao: ajustesPeriodo.motivoAnulacao,
        })
        .from(ajustesPeriodo)
        .where(
          and(
            inArray(ajustesPeriodo.periodoId, idsPeriodos),
            // A linha do trancamento aparece como o próprio trancamento.
            ne(ajustesPeriodo.tipo, "trancamento"),
          ),
        )
    : [];

  const trancadas = idsPeriodos.length
    ? await db
        .select({
          id: trancamentos.id,
          inicio: trancamentos.inicio,
          volta: trancamentos.volta,
          criadoPor: trancamentos.criadoPor,
          criadoEm: trancamentos.criadoEm,
          anuladoEm: trancamentos.anuladoEm,
          anuladoPor: trancamentos.anuladoPor,
          motivoAnulacao: trancamentos.motivoAnulacao,
        })
        .from(trancamentos)
        .where(inArray(trancamentos.periodoId, idsPeriodos))
    : [];

  // Transferências em que este aluno cedeu ou recebeu, com o nome do outro.
  const origem = alias(periodosContratados, "periodo_origem");
  const destino = alias(periodosContratados, "periodo_destino");
  const doOrigem = alias(pessoas, "aluno_origem");
  const doDestino = alias(pessoas, "aluno_destino");
  const transferidas = idsPeriodos.length
    ? await db
        .select({
          id: transferencias.id,
          periodoOrigemId: transferencias.periodoOrigemId,
          periodoDestinoId: transferencias.periodoDestinoId,
          anuladoEm: transferencias.anuladoEm,
          anuladoPor: transferencias.anuladoPor,
          motivoAnulacao: transferencias.motivoAnulacao,
          cedente: doOrigem.nome,
          recebedor: doDestino.nome,
        })
        .from(transferencias)
        .innerJoin(origem, eq(origem.id, transferencias.periodoOrigemId))
        .innerJoin(destino, eq(destino.id, transferencias.periodoDestinoId))
        .innerJoin(doOrigem, eq(doOrigem.id, origem.alunoId))
        .innerJoin(doDestino, eq(doDestino.id, destino.alunoId))
        .where(
          or(
            inArray(transferencias.periodoOrigemId, idsPeriodos),
            inArray(transferencias.periodoDestinoId, idsPeriodos),
          ),
        )
    : [];
  const transferenciaPorId = new Map(transferidas.map((t) => [t.id, t]));
  const transferenciaDoPeriodo = new Map(
    transferidas.map((t) => [t.periodoDestinoId, t]),
  );

  // Lotes: rótulo "Forró Iniciante" (ou "estúdio todo") de cada um.
  const idsLotes = [
    ...new Set(ajustes.flatMap((a) => (a.loteId ? [a.loteId] : []))),
  ];
  const lotes = idsLotes.length
    ? await db
        .select({
          id: lotesExtensao.id,
          todoEstudio: lotesExtensao.todoEstudio,
          motivo: lotesExtensao.motivo,
          anuladoEm: lotesExtensao.anuladoEm,
          anuladoPor: lotesExtensao.anuladoPor,
          motivoAnulacao: lotesExtensao.motivoAnulacao,
        })
        .from(lotesExtensao)
        .where(inArray(lotesExtensao.id, idsLotes))
    : [];
  const turmasDosLotes = idsLotes.length
    ? await db
        .selectDistinct({
          loteId: loteTurmas.loteId,
          ritmo: ritmos.nome,
          modulo: modulos.nome,
          ritmoOrdem: ritmos.ordem,
          moduloOrdem: modulos.ordem,
        })
        .from(loteTurmas)
        .innerJoin(turmas, eq(turmas.id, loteTurmas.turmaId))
        .innerJoin(ritmos, eq(ritmos.id, turmas.ritmoId))
        .innerJoin(modulos, eq(modulos.id, turmas.moduloId))
        .where(inArray(loteTurmas.loteId, idsLotes))
    : [];
  const rotuloDoLote = new Map<
    string,
    { texto: string; motivo: string; anulacao: Anulacao }
  >();
  for (const l of lotes) {
    const nomes = turmasDosLotes
      .filter((t) => t.loteId === l.id)
      .sort(
        (a, b) =>
          a.ritmoOrdem - b.ritmoOrdem ||
          a.ritmo.localeCompare(b.ritmo, "pt-BR") ||
          a.moduloOrdem - b.moduloOrdem,
      )
      .map((t) => `${t.ritmo} ${t.modulo}`);
    rotuloDoLote.set(l.id, {
      texto: l.todoEstudio ? "estúdio todo" : juntarComE([...new Set(nomes)]),
      motivo: l.motivo,
      anulacao: l,
    });
  }

  const todasMatriculas = await db
    .select({
      id: matriculas.id,
      entrada: matriculas.entrada,
      saida: matriculas.saida,
      criadoPor: matriculas.criadoPor,
      saidaPor: matriculas.saidaPor,
      criadoEm: matriculas.criadoEm,
      ritmo: ritmos.nome,
      modulo: modulos.nome,
      dias: sql<
        number[]
      >`coalesce(array_agg(${turmaDias.diaSemana} order by ${turmaDias.diaSemana}) filter (where ${turmaDias.diaSemana} is not null), '{}')`,
      horarioInicio: turmas.horarioInicio,
    })
    .from(matriculas)
    .innerJoin(turmas, eq(turmas.id, matriculas.turmaId))
    .innerJoin(ritmos, eq(ritmos.id, turmas.ritmoId))
    .innerJoin(modulos, eq(modulos.id, turmas.moduloId))
    .leftJoin(turmaDias, eq(turmaDias.turmaId, turmas.id))
    .where(eq(matriculas.alunoId, aluno.id))
    .groupBy(matriculas.id, turmas.id, ritmos.id, modulos.id);

  const encerramentos = await db
    .select()
    .from(encerramentosAluno)
    .where(eq(encerramentosAluno.alunoId, aluno.id));

  const mensagem = alias(mensagensProntas, "mensagem");
  const contatosDoAluno = await db
    .select({
      em: contatos.criadoEm,
      criadoPor: contatos.criadoPor,
      mensagem: mensagem.nome,
      resultado: contatos.resultado,
      grupoId: contatos.grupoId,
    })
    .from(contatos)
    .leftJoin(mensagem, eq(mensagem.id, contatos.mensagemId))
    .where(
      and(
        eq(contatos.alunoId, aluno.id),
        inArray(contatos.lista, [...LISTAS_ALUNO]),
      ),
    )
    .orderBy(desc(contatos.criadoEm), desc(contatos.id));

  const [bloqueio] = await db
    .select({
      em: bloqueiosContato.marcadoEm,
      por: bloqueiosContato.marcadoPor,
    })
    .from(bloqueiosContato)
    .where(
      and(
        eq(bloqueiosContato.pessoaId, aluno.contato.pessoaId),
        isNull(bloqueiosContato.desfeitoEm),
      ),
    );

  // Nomes de todas as pessoas citadas, numa consulta só.
  const idsPessoas = new Set<string>();
  const citar = (...ids: (string | null)[]) => {
    for (const id of ids) if (id) idsPessoas.add(id);
  };
  for (const p of periodos) citar(p.criadoPor, p.anuladoPor);
  for (const a of ajustes) citar(a.criadoPor, a.anuladoPor);
  for (const t of transferidas) citar(t.anuladoPor);
  for (const l of lotes) citar(l.anuladoPor);
  for (const t of trancadas) citar(t.criadoPor, t.anuladoPor);
  for (const m of todasMatriculas) citar(m.criadoPor, m.saidaPor);
  for (const e of encerramentos) citar(e.criadoPor);
  for (const c of contatosDoAluno) citar(c.criadoPor);
  citar(bloqueio?.por ?? null);
  const nomes = new Map<string, string>();
  if (idsPessoas.size > 0) {
    const linhas = await db
      .select({ id: pessoas.id, nome: pessoas.nome })
      .from(pessoas)
      .where(inArray(pessoas.id, [...idsPessoas]));
    for (const l of linhas) nomes.set(l.id, l.nome);
  }
  const nomeDe = (id: string | null) =>
    (id ? nomes.get(id) : undefined) ?? SEM_AUTOR;

  const anulacaoDe = (a: Anulacao): ItemHistorico["anulado"] =>
    a.anuladoEm
      ? {
          em: a.anuladoEm,
          por: nomeDe(a.anuladoPor),
          motivo: a.motivoAnulacao ?? "",
        }
      : null;
  /** `anular` só existe enquanto o item não foi anulado. */
  const anularSe = (
    anulacao: ItemHistorico["anulado"],
    acao: AcaoAnular | null,
  ): AcaoAnular | null => (anulacao ? null : acao);
  /** A anulação do próprio item vale; senão, a do pai (transferência ou lote). */
  const efetiva = (propria: Anulacao, pai?: Anulacao): Anulacao =>
    propria.anuladoEm ? propria : (pai ?? propria);

  const historico: ItemHistorico[] = [];

  for (const p of periodos) {
    const intervalo = `${formatarDia(p.inicio)} a ${formatarDia(p.fim)}`;
    const recebido = p.origem === "transferencia";
    const transferencia = transferenciaDoPeriodo.get(p.id);
    const anulado = anulacaoDe(
      efetiva(p, recebido ? transferencia : undefined),
    );
    historico.push({
      em: p.criadoEm,
      tipo: "periodo",
      texto: recebido
        ? `Período recebido · ${intervalo}`
        : p.plano
          ? `Período ${p.plano} · ${intervalo}`
          : `Período · ${intervalo}`,
      por: nomeDe(p.criadoPor),
      anulado,
      anular: anularSe(
        anulado,
        recebido
          ? transferencia
            ? { tipo: "transferencia", id: transferencia.id }
            : null
          : { tipo: "periodo", id: p.id },
      ),
    });
  }

  for (const a of ajustes) {
    let texto: string;
    let anular: AcaoAnular | null;
    let pai: Anulacao | undefined;
    if (
      a.tipo === "transferencia_saida" ||
      a.tipo === "transferencia_entrada"
    ) {
      const t = a.transferenciaId
        ? transferenciaPorId.get(a.transferenciaId)
        : undefined;
      const saida = a.tipo === "transferencia_saida";
      const outro = saida ? t?.recebedor : t?.cedente;
      texto = formatarDiasComSinal(a.dias);
      if (outro) {
        texto += ` · ${saida ? "transferidos para" : "recebidos de"} ${outro}`;
      }
      pai = t;
      anular = a.transferenciaId
        ? { tipo: "transferencia", id: a.transferenciaId }
        : null;
    } else {
      const lote = a.loteId ? rotuloDoLote.get(a.loteId) : undefined;
      const motivo = a.motivo?.trim() || lote?.motivo || "";
      pai = lote?.anulacao;
      texto =
        a.unidade === "aulas"
          ? `+${contarAulas(a.quantidade)} (${contarDias(a.dias)})`
          : formatarDiasComSinal(a.dias);
      if (motivo) texto += ` · ${motivo}`;
      if (lote) texto += ` · lote ${lote.texto}`;
      anular = { tipo: "ajuste", id: a.id };
    }
    const anulado = anulacaoDe(efetiva(a, pai));
    historico.push({
      em: a.criadoEm,
      tipo: "ajuste",
      texto,
      por: nomeDe(a.criadoPor),
      anulado,
      anular: anularSe(anulado, anular),
    });
  }

  for (const t of trancadas) {
    const aberto = t.volta === null;
    const anulado = anulacaoDe(t);
    const item: ItemHistorico = {
      em: t.criadoEm,
      tipo: "trancamento",
      texto: t.volta
        ? `Trancado de ${formatarDia(t.inicio)} a ${formatarDia(t.volta)} (${contarDias(diasEntre(t.inicio, t.volta))})`
        : `Trancado desde ${formatarDia(t.inicio)}`,
      por: nomeDe(t.criadoPor),
      anulado,
      anular: anularSe(anulado, { tipo: "trancamento", id: t.id }),
    };
    if (aberto && !anulado) item.destrancar = t.id;
    historico.push(item);
  }

  for (const m of todasMatriculas) {
    historico.push({
      em: m.criadoEm,
      tipo: "matricula",
      texto: `Entrou em ${rotuloDaTurma(m)}`,
      por: nomeDe(m.criadoPor),
      anulado: null,
      anular: null,
    });
    if (m.saida) {
      historico.push({
        em: meioDiaEmSaoPaulo(m.saida),
        tipo: "saida_turma",
        texto: `Saiu de ${rotuloDaTurma(m)}`,
        por: nomeDe(m.saidaPor),
        anulado: null,
        anular: null,
      });
    }
  }

  for (const e of encerramentos) {
    historico.push({
      em: e.criadoEm,
      tipo: e.tipo === "encerramento" ? "encerramento" : "reabertura",
      texto:
        e.tipo === "reabertura"
          ? "Cadastro reaberto"
          : e.motivo
            ? `Encerrado · ${e.motivo}`
            : "Encerrado",
      por: nomeDe(e.criadoPor),
      anulado: null,
      anular: null,
    });
  }

  // Mais recente primeiro. Linhas gravadas numa transação dividem o mesmo
  // `em`: no empate, vale a ordem em que as coisas acontecem (período, depois
  // o que se lança nele), e o mais "tardio" aparece antes.
  historico.sort(
    (a, b) =>
      b.em.getTime() - a.em.getTime() ||
      ORDEM_NO_EMPATE[b.tipo] - ORDEM_NO_EMPATE[a.tipo],
  );

  const matriculasEncerradas = todasMatriculas
    .flatMap((m) =>
      m.saida
        ? [
            {
              rotulo: rotuloDaTurma(m),
              entrada: m.entrada,
              saida: m.saida,
            },
          ]
        : [],
    )
    .sort((a, b) => b.saida.localeCompare(a.saida));

  return {
    aluno,
    historico,
    matriculasEncerradas,
    contatos: contatosDoAluno.map((c) => ({
      em: c.em,
      por: nomeDe(c.criadoPor),
      mensagem: c.mensagem,
      resultado: c.resultado,
      grupoId: c.grupoId,
    })),
    podeExcluir: await podeExcluirAluno(db, aluno.id),
    naoQuerContato: bloqueio
      ? { em: bloqueio.em, por: nomeDe(bloqueio.por) }
      : null,
  };
}
