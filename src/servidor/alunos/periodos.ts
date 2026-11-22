/**
 * Períodos contratados e o livro de lançamentos: registrar período, sugerir a
 * renovação, estender um aluno e anular linhas do livro ou períodos. Toda
 * escrita roda numa transação que começa travando a linha do aluno.
 */
import { and, asc, count, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Banco } from "../banco/cliente";
import {
  ajustesPeriodo,
  matriculas,
  periodosContratados,
  pessoas,
  planos,
  trancamentos,
  transferencias,
  turmaDias,
} from "../banco/esquema";
import { ehUuid, executarTraduzindo } from "../cadastros/comum";
import type { Resultado } from "../cadastros/resultado";
import { alunoAtivoOuErro, type Executor, travar } from "./cadastro";
import { diasPorAulas } from "./conversao";
import { type DataIso, ehDataIso, formatarDia, somarDias } from "./datas";
import {
  fimEfetivo,
  type PeriodoParaEstado,
  type TrancamentoParaEstado,
  ultimoPeriodo,
} from "./estado";

const MENSAGEM_NAO_ENCONTRADO = "Aluno não encontrado.";
const MENSAGEM_DATA = "Informe uma data válida.";
const MENSAGEM_PLANO = "Escolha um plano ativo.";
const MENSAGEM_MOTIVO = "Informe o motivo.";
const MENSAGEM_QUANTIDADE = "Informe um número inteiro maior que zero.";
const MENSAGEM_TURMA_AULAS = "Escolha a turma das aulas.";
const MENSAGEM_SEM_TURMA = "Sem turma, informe em dias.";
const MENSAGEM_JA_ANULADO = "Isso já foi anulado.";

type Falha = { ok: false; erros: Record<string, string> };

const falha = (campo: string, mensagem: string): Falha => ({
  ok: false,
  erros: { [campo]: mensagem },
});

/** Trava a linha do aluno em `pessoas` até o fim da transação. */
export async function travarAluno(tx: Executor, alunoId: string) {
  await travar(tx, alunoId);
}

/** Períodos e trancamentos não anulados do aluno, na forma do cálculo de estado. */
export async function carregarPeriodosDoAluno(
  tx: Executor,
  alunoId: string,
): Promise<{
  periodos: PeriodoParaEstado[];
  trancamentos: TrancamentoParaEstado[];
}> {
  if (!ehUuid(alunoId)) return { periodos: [], trancamentos: [] };
  const periodos = await tx
    .select({
      id: periodosContratados.id,
      inicio: periodosContratados.inicio,
      fim: periodosContratados.fim,
      diasAjustes:
        sql<number>`coalesce(sum(${ajustesPeriodo.dias}) filter (where ${ajustesPeriodo.anuladoEm} is null), 0)`.mapWith(
          Number,
        ),
    })
    .from(periodosContratados)
    .leftJoin(
      ajustesPeriodo,
      eq(ajustesPeriodo.periodoId, periodosContratados.id),
    )
    .where(
      and(
        eq(periodosContratados.alunoId, alunoId),
        isNull(periodosContratados.anuladoEm),
      ),
    )
    .groupBy(periodosContratados.id)
    .orderBy(asc(periodosContratados.inicio));
  const listaTrancamentos = await tx
    .select({
      id: trancamentos.id,
      periodoId: trancamentos.periodoId,
      inicio: trancamentos.inicio,
      volta: trancamentos.volta,
    })
    .from(trancamentos)
    .innerJoin(
      periodosContratados,
      eq(periodosContratados.id, trancamentos.periodoId),
    )
    .where(
      and(
        eq(periodosContratados.alunoId, alunoId),
        isNull(periodosContratados.anuladoEm),
        isNull(trancamentos.anuladoEm),
      ),
    )
    .orderBy(asc(trancamentos.inicio));
  return { periodos, trancamentos: listaTrancamentos };
}

/**
 * Valores iniciais do formulário de período: o plano do último período (se
 * ainda ativo) e o início no dia seguinte ao fim efetivo do último, se ele
 * termina hoje ou depois; senão, hoje. `inicioMinimo` é o primeiro dia
 * aceito (nulo sem período).
 */
export async function sugestaoDePeriodo(
  db: Executor,
  alunoId: string,
  hoje: DataIso,
): Promise<{
  planoId: string | null;
  inicio: DataIso;
  inicioMinimo: DataIso | null;
}> {
  const { periodos } = await carregarPeriodosDoAluno(db, alunoId);
  const ultimo = ultimoPeriodo(periodos);
  if (!ultimo) return { planoId: null, inicio: hoje, inicioMinimo: null };
  const fim = fimEfetivo(ultimo);
  const inicioMinimo = somarDias(fim, 1);
  const [plano] = await db
    .select({ id: planos.id })
    .from(periodosContratados)
    .innerJoin(planos, eq(planos.id, periodosContratados.planoId))
    .where(and(eq(periodosContratados.id, ultimo.id), eq(planos.ativo, true)));
  return {
    planoId: plano?.id ?? null,
    inicio: fim >= hoje ? inicioMinimo : hoje,
    inicioMinimo,
  };
}

/** Registra um período de plano. Precisa começar depois do fim efetivo do último. */
export async function registrarPeriodo(
  db: Banco,
  a: {
    alunoId: string;
    planoId: string;
    inicio: string;
    fim: string;
    feitoPor: string;
  },
): Promise<Resultado<{ periodoId: string }>> {
  const inicio = a.inicio?.trim() ?? "";
  const fim = a.fim?.trim() ?? "";
  const planoId = a.planoId?.trim() ?? "";
  const erros: Record<string, string> = {};
  if (!ehUuid(planoId)) erros.planoId = MENSAGEM_PLANO;
  if (!ehDataIso(inicio)) erros.inicio = MENSAGEM_DATA;
  if (!ehDataIso(fim)) erros.fim = MENSAGEM_DATA;
  else if (!erros.inicio && fim < inicio) {
    erros.fim = "O fim precisa ser depois do início.";
  }
  if (Object.keys(erros).length > 0) return { ok: false, erros };

  return executarTraduzindo<{ periodoId: string }>(
    () =>
      db.transaction(async (tx) => {
        if (!ehUuid(a.alunoId)) return falha("_", MENSAGEM_NAO_ENCONTRADO);
        await travarAluno(tx, a.alunoId);
        const ativo = await alunoAtivoOuErro(tx, a.alunoId);
        if (!ativo.ok) return ativo;
        const [plano] = await tx
          .select({ id: planos.id })
          .from(planos)
          .where(and(eq(planos.id, planoId), eq(planos.ativo, true)));
        if (!plano) return falha("planoId", MENSAGEM_PLANO);
        // Lido depois da trava: outra gravação simultânea já terminou.
        const { periodos } = await carregarPeriodosDoAluno(tx, a.alunoId);
        const ultimo = ultimoPeriodo(periodos);
        if (ultimo) {
          const fimAtual = fimEfetivo(ultimo);
          if (inicio <= fimAtual) {
            return falha(
              "inicio",
              `O período atual vai até ${formatarDia(fimAtual)}. O novo precisa começar a partir de ${formatarDia(somarDias(fimAtual, 1))}.`,
            );
          }
        }
        const [novo] = await tx
          .insert(periodosContratados)
          .values({
            alunoId: a.alunoId,
            inicio,
            fim,
            planoId,
            origem: "plano",
            criadoPor: a.feitoPor,
          })
          .returning({ id: periodosContratados.id });
        return { ok: true as const, valor: { periodoId: novo.id } };
      }),
    {},
  );
}

/**
 * Converte a quantidade digitada em dias. Em aulas, usa a turma indicada
 * (entre as matrículas abertas do aluno) ou a única matrícula aberta.
 */
export async function diasDoAjuste(
  tx: Executor,
  a: {
    alunoId: string;
    quantidade: number;
    unidade: "dias" | "aulas";
    turmaId?: string;
  },
): Promise<Resultado<{ dias: number; turmaConversaoId: string | null }>> {
  if (a.unidade === "dias") {
    return { ok: true, valor: { dias: a.quantidade, turmaConversaoId: null } };
  }
  const abertas = await tx
    .select({
      turmaId: matriculas.turmaId,
      diasPorSemana: count(turmaDias.diaSemana),
    })
    .from(matriculas)
    .leftJoin(turmaDias, eq(turmaDias.turmaId, matriculas.turmaId))
    .where(and(eq(matriculas.alunoId, a.alunoId), isNull(matriculas.saida)))
    .groupBy(matriculas.turmaId);
  if (abertas.length === 0) return falha("unidade", MENSAGEM_SEM_TURMA);
  const turmaId = a.turmaId?.trim();
  let escolhida: (typeof abertas)[number] | undefined;
  if (turmaId) escolhida = abertas.find((m) => m.turmaId === turmaId);
  else if (abertas.length === 1) escolhida = abertas[0];
  if (!escolhida) return falha("turmaId", MENSAGEM_TURMA_AULAS);
  if (escolhida.diasPorSemana === 0) {
    return falha(
      "unidade",
      "Essa turma não tem dias na semana; informe em dias.",
    );
  }
  return {
    ok: true,
    valor: {
      dias: diasPorAulas(a.quantidade, escolhida.diasPorSemana),
      turmaConversaoId: escolhida.turmaId,
    },
  };
}

/** Inteiro maior que zero, vindo de formulário (texto) ou de código. */
function lerQuantidade(bruto: string | number): number | null {
  const texto = String(bruto ?? "").trim();
  if (!/^\d+$/.test(texto)) return null;
  const n = Number(texto);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * Extensão individual: uma linha `extensao` no livro do último período do
 * aluno. `hoje` fica na assinatura para as telas; a regra não depende dele.
 */
export async function estender(
  db: Banco,
  a: {
    alunoId: string;
    quantidade: string | number;
    unidade: string;
    turmaId?: string;
    motivo: string;
    feitoPor: string;
  },
  _hoje: DataIso,
): Promise<
  Resultado<{
    ajusteId: string;
    dias: number;
    fimAntes: DataIso;
    fimDepois: DataIso;
  }>
> {
  const erros: Record<string, string> = {};
  const quantidade = lerQuantidade(a.quantidade);
  if (quantidade === null) erros.quantidade = MENSAGEM_QUANTIDADE;
  const unidade =
    a.unidade === "dias" || a.unidade === "aulas" ? a.unidade : null;
  if (!unidade) erros.unidade = "Escolha dias ou aulas.";
  const motivo = a.motivo?.trim() ?? "";
  if (!motivo) erros.motivo = MENSAGEM_MOTIVO;
  const turmaId = a.turmaId?.trim() || undefined;
  if (turmaId && !ehUuid(turmaId)) erros.turmaId = MENSAGEM_TURMA_AULAS;
  if (quantidade === null || !unidade || Object.keys(erros).length > 0) {
    return { ok: false, erros };
  }

  return executarTraduzindo(
    () =>
      db.transaction(async (tx) => {
        if (!ehUuid(a.alunoId)) return falha("_", MENSAGEM_NAO_ENCONTRADO);
        await travarAluno(tx, a.alunoId);
        const ativo = await alunoAtivoOuErro(tx, a.alunoId);
        if (!ativo.ok) return ativo;
        const { periodos } = await carregarPeriodosDoAluno(tx, a.alunoId);
        const ultimo = ultimoPeriodo(periodos);
        if (!ultimo) return falha("_", "Este aluno ainda não tem período.");
        const conversao = await diasDoAjuste(tx, {
          alunoId: a.alunoId,
          quantidade,
          unidade,
          turmaId,
        });
        if (!conversao.ok) return conversao;
        const { dias, turmaConversaoId } = conversao.valor;
        const [linha] = await tx
          .insert(ajustesPeriodo)
          .values({
            periodoId: ultimo.id,
            tipo: "extensao",
            dias,
            quantidadeDigitada: quantidade,
            unidadeDigitada: unidade,
            turmaConversaoId,
            motivo,
            criadoPor: a.feitoPor,
          })
          .returning({ id: ajustesPeriodo.id });
        return {
          ok: true as const,
          valor: {
            ajusteId: linha.id,
            dias,
            fimAntes: fimEfetivo(ultimo),
            fimDepois: fimEfetivo({
              ...ultimo,
              diasAjustes: ultimo.diasAjustes + dias,
            }),
          },
        };
      }),
    {},
  );
}

/** O aluno dono do período: `undefined` se o período não existe. */
async function alunoDoPeriodo(tx: Executor, periodoId: string) {
  const [p] = await tx
    .select({ alunoId: periodosContratados.alunoId })
    .from(periodosContratados)
    .where(eq(periodosContratados.id, periodoId));
  return p?.alunoId;
}

async function buscarAjuste(tx: Executor, ajusteId: string) {
  const [linha] = await tx
    .select({
      id: ajustesPeriodo.id,
      periodoId: ajustesPeriodo.periodoId,
      anuladoEm: ajustesPeriodo.anuladoEm,
      transferenciaId: ajustesPeriodo.transferenciaId,
      trancamentoId: ajustesPeriodo.trancamentoId,
    })
    .from(ajustesPeriodo)
    .where(eq(ajustesPeriodo.id, ajusteId));
  return linha;
}

/**
 * Anula uma linha do livro. Linhas de transferência e de trancamento são
 * anuladas pela operação de origem; linhas de lote podem ser anuladas sozinhas.
 * Vale também para aluno encerrado: corrigir o histórico não exige reabrir.
 */
export async function anularAjuste(
  db: Banco,
  a: { ajusteId: string; motivo: string; feitoPor: string },
): Promise<Resultado<null>> {
  const motivo = a.motivo?.trim() ?? "";
  if (!motivo) return falha("motivo", MENSAGEM_MOTIVO);
  const naoEncontrado = falha("_", "Lançamento não encontrado.");
  if (!ehUuid(a.ajusteId)) return naoEncontrado;
  return executarTraduzindo<null>(
    () =>
      db.transaction(async (tx) => {
        const lida = await buscarAjuste(tx, a.ajusteId);
        if (!lida) return naoEncontrado;
        const alunoId = await alunoDoPeriodo(tx, lida.periodoId);
        if (!alunoId) return naoEncontrado;
        await travarAluno(tx, alunoId);
        const linha = await buscarAjuste(tx, a.ajusteId);
        if (!linha) return naoEncontrado;
        if (linha.anuladoEm) return falha("_", MENSAGEM_JA_ANULADO);
        if (linha.transferenciaId) {
          return falha(
            "_",
            "Este lançamento faz parte de uma transferência. Anule a transferência.",
          );
        }
        if (linha.trancamentoId) {
          return falha(
            "_",
            "Este lançamento faz parte de um trancamento. Anule o trancamento.",
          );
        }
        await tx
          .update(ajustesPeriodo)
          .set({
            anuladoEm: new Date(),
            anuladoPor: a.feitoPor,
            motivoAnulacao: motivo,
          })
          .where(eq(ajustesPeriodo.id, linha.id));
        return { ok: true as const, valor: null };
      }),
    {},
  );
}

/**
 * Uma linha do livro em poucas palavras, como no histórico: "+5 dias
 * (feriado)", "−14 dias (transferidos para João Souza)".
 */
export function descreverAjusteCurto(a: {
  dias: number;
  motivo: string | null;
  tipo: string;
  nomeOutraPessoa?: string;
}): string {
  const n = Math.abs(a.dias);
  const quantidade = `${a.dias < 0 ? "−" : "+"}${n} ${n === 1 ? "dia" : "dias"}`;
  let detalhe: string | null;
  if (a.tipo === "transferencia_saida" && a.nomeOutraPessoa) {
    detalhe = `transferidos para ${a.nomeOutraPessoa}`;
  } else if (a.tipo === "transferencia_entrada" && a.nomeOutraPessoa) {
    detalhe = `recebidos de ${a.nomeOutraPessoa}`;
  } else {
    detalhe =
      a.motivo?.trim() || (a.tipo === "trancamento" ? "trancamento" : null);
  }
  return detalhe ? `${quantidade} (${detalhe})` : quantidade;
}

/** "a", "a e b", "a, b e c". */
function juntarComE(itens: string[]): string {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/** Lançamentos vivos do período, descritos para a mensagem de bloqueio. */
async function lancamentosVivos(tx: Executor, periodoId: string) {
  const outroPeriodo = alias(periodosContratados, "outro_periodo");
  const outraPessoa = alias(pessoas, "outra_pessoa");
  const linhas = await tx
    .select({
      dias: ajustesPeriodo.dias,
      motivo: ajustesPeriodo.motivo,
      tipo: ajustesPeriodo.tipo,
      nomeOutraPessoa: outraPessoa.nome,
    })
    .from(ajustesPeriodo)
    .leftJoin(
      transferencias,
      eq(transferencias.id, ajustesPeriodo.transferenciaId),
    )
    .leftJoin(
      outroPeriodo,
      sql`${outroPeriodo.id} = case when ${ajustesPeriodo.tipo} = 'transferencia_saida' then ${transferencias.periodoDestinoId} else ${transferencias.periodoOrigemId} end`,
    )
    .leftJoin(outraPessoa, eq(outraPessoa.id, outroPeriodo.alunoId))
    .where(
      and(
        eq(ajustesPeriodo.periodoId, periodoId),
        isNull(ajustesPeriodo.anuladoEm),
      ),
    )
    .orderBy(asc(ajustesPeriodo.criadoEm), asc(ajustesPeriodo.id));
  // Trancamento aberto ainda não tem linha no livro.
  const abertos = await tx
    .select({ inicio: trancamentos.inicio })
    .from(trancamentos)
    .where(
      and(
        eq(trancamentos.periodoId, periodoId),
        isNull(trancamentos.anuladoEm),
        isNull(trancamentos.volta),
      ),
    )
    .orderBy(asc(trancamentos.inicio));
  return [
    ...linhas.map((l) =>
      descreverAjusteCurto({
        ...l,
        nomeOutraPessoa: l.nomeOutraPessoa ?? undefined,
      }),
    ),
    ...abertos.map((t) => `trancamento aberto desde ${formatarDia(t.inicio)}`),
  ];
}

async function buscarPeriodo(tx: Executor, periodoId: string) {
  const [p] = await tx
    .select({
      id: periodosContratados.id,
      alunoId: periodosContratados.alunoId,
      origem: periodosContratados.origem,
      anuladoEm: periodosContratados.anuladoEm,
    })
    .from(periodosContratados)
    .where(eq(periodosContratados.id, periodoId));
  return p;
}

/**
 * Anula um período sem lançamentos vivos. Período de transferência é
 * anulado pela transferência. Vale também para aluno encerrado: corrigir o
 * histórico não exige reabrir.
 */
export async function anularPeriodo(
  db: Banco,
  a: { periodoId: string; motivo: string; feitoPor: string },
): Promise<Resultado<null>> {
  const motivo = a.motivo?.trim() ?? "";
  if (!motivo) return falha("motivo", MENSAGEM_MOTIVO);
  const naoEncontrado = falha("_", "Período não encontrado.");
  if (!ehUuid(a.periodoId)) return naoEncontrado;
  return executarTraduzindo<null>(
    () =>
      db.transaction(async (tx) => {
        const lido = await buscarPeriodo(tx, a.periodoId);
        if (!lido) return naoEncontrado;
        await travarAluno(tx, lido.alunoId);
        const periodo = await buscarPeriodo(tx, a.periodoId);
        if (!periodo) return naoEncontrado;
        if (periodo.anuladoEm) return falha("_", MENSAGEM_JA_ANULADO);
        if (periodo.origem === "transferencia") {
          return falha(
            "_",
            "Este período veio de uma transferência. Anule a transferência.",
          );
        }
        const vivos = await lancamentosVivos(tx, periodo.id);
        if (vivos.length > 0) {
          const um = vivos.length === 1;
          return falha(
            "_",
            `Este período tem ${vivos.length} ${um ? "lançamento" : "lançamentos"}: ${juntarComE(vivos)}. ${um ? "Anule-o antes." : "Anule-os antes."}`,
          );
        }
        await tx
          .update(periodosContratados)
          .set({
            anuladoEm: new Date(),
            anuladoPor: a.feitoPor,
            motivoAnulacao: motivo,
          })
          .where(eq(periodosContratados.id, periodo.id));
        return { ok: true as const, valor: null };
      }),
    {},
  );
}
