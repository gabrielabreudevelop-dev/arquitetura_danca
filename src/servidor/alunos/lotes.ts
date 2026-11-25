/**
 * Extensão em lote: prolonga o último período de todo aluno vigente de uma ou
 * mais turmas (ou do estúdio todo) de uma vez. A prévia mostra quem recebe;
 * confirmar grava o lote e uma linha `extensao` por aluno, e anular desfaz as
 * linhas ainda vivas. Toda escrita roda numa transação que trava os alunos.
 */
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Banco } from "../banco/cliente";
import {
  ajustesPeriodo,
  lotesExtensao,
  loteTurmas,
  matriculas,
  modulos,
  periodosContratados,
  pessoaPapeis,
  pessoas,
  ritmos,
  turmaDias,
  turmas,
} from "../banco/esquema";
import { ehUuid, executarTraduzindo } from "../cadastros/comum";
import type { Resultado } from "../cadastros/resultado";
import type { Executor } from "./cadastro";
import { rotuloDaTurma } from "./carga";
import { diasPorAulas } from "./conversao";
import type { DataIso } from "./datas";
import { calcularEstado, fimEfetivo } from "./estado";
import { carregarPeriodosDoAluno, travarAlunosEmOrdem } from "./periodos";

const MENSAGEM_MOTIVO = "Informe o motivo.";
const MENSAGEM_QUANTIDADE = "Informe um número inteiro maior que zero.";
const MENSAGEM_JA_ANULADO = "Isso já foi anulado.";
const MENSAGEM_TURMAS_ATIVAS = "Escolha turmas ativas.";
const MENSAGEM_SEM_ALUNO = "Nenhum aluno vigente nessas turmas.";
const MENSAGEM_SEM_ALUNO_ESTUDIO = "Nenhum aluno vigente no estúdio.";
const MENSAGEM_LOTE_NAO_ENCONTRADO = "Lote não encontrado.";

export type EscopoLote =
  | { tipo: "turmas"; turmaIds: string[] }
  | { tipo: "estudio" };

export type LinhaPrevia = {
  alunoId: string;
  nome: string;
  fimAntes: DataIso;
  fimDepois: DataIso;
  dias: number;
  turmaConversaoId: string | null;
};

type Falha = { ok: false; erros: Record<string, string> };

const falha = (campo: string, mensagem: string): Falha => ({
  ok: false,
  erros: { [campo]: mensagem },
});

type Entrada = {
  escopo: EscopoLote;
  quantidade: string | number;
  unidade: string;
};

/** Entrada já validada; `turmaIds` sem repetição (vazio no estúdio todo). */
type Pedido = {
  turmaIds: string[];
  todoEstudio: boolean;
  quantidade: number;
  unidade: "dias" | "aulas";
};

type LinhaInterna = LinhaPrevia & { periodoId: string };

/** Valida o que não precisa do banco; devolve o pedido ou os erros por campo. */
function lerPedido(a: Entrada): Resultado<Pedido> {
  const erros: Record<string, string> = {};
  const texto = String(a.quantidade ?? "").trim();
  const numero = /^\d+$/.test(texto) ? Number(texto) : 0;
  const quantidade = Number.isSafeInteger(numero) && numero > 0 ? numero : null;
  if (quantidade === null) erros.quantidade = MENSAGEM_QUANTIDADE;
  const unidade =
    a.unidade === "dias" || a.unidade === "aulas" ? a.unidade : null;
  if (!unidade) erros.unidade = "Escolha dias ou aulas.";
  const todoEstudio = a.escopo?.tipo === "estudio";
  let turmaIds: string[] = [];
  if (todoEstudio) {
    if (unidade === "aulas")
      erros.unidade = "No estúdio todo, informe em dias.";
  } else {
    const brutos = a.escopo?.tipo === "turmas" ? a.escopo.turmaIds : [];
    turmaIds = [
      ...new Set((brutos ?? []).map((id) => String(id).toLowerCase())),
    ];
    if (turmaIds.length === 0) {
      erros.turmaIds = "Escolha ao menos uma turma ou o estúdio todo.";
    } else if (!turmaIds.every(ehUuid)) {
      erros.turmaIds = MENSAGEM_TURMAS_ATIVAS;
    }
  }
  if (quantidade === null || !unidade || Object.keys(erros).length > 0) {
    return { ok: false, erros };
  }
  return { ok: true, valor: { turmaIds, todoEstudio, quantidade, unidade } };
}

/** Quem receberia o lote agora: vigentes (e, por turma, com matrícula aberta). */
async function calcularLinhas(
  tx: Executor,
  p: Pedido,
  hoje: DataIso,
): Promise<Resultado<LinhaInterna[]>> {
  // Dias por semana de cada turma escolhida (só as ativas valem).
  const porTurma = new Map<string, number>();
  if (!p.todoEstudio) {
    const escolhidas = await tx
      .select({
        id: turmas.id,
        ativa: turmas.ativa,
        diasPorSemana: count(turmaDias.diaSemana),
      })
      .from(turmas)
      .leftJoin(turmaDias, eq(turmaDias.turmaId, turmas.id))
      .where(inArray(turmas.id, p.turmaIds))
      .groupBy(turmas.id);
    if (
      escolhidas.length !== p.turmaIds.length ||
      escolhidas.some((t) => !t.ativa)
    ) {
      return falha("turmaIds", MENSAGEM_TURMAS_ATIVAS);
    }
    if (
      p.unidade === "aulas" &&
      escolhidas.some((t) => t.diasPorSemana === 0)
    ) {
      return falha(
        "unidade",
        "Uma das turmas não tem dias na semana; informe em dias.",
      );
    }
    for (const t of escolhidas) porTurma.set(t.id, t.diasPorSemana);
  }

  // Candidatos: alunos com papel de aluno; por turma, só com matrícula aberta.
  const candidatos = new Map<
    string,
    { nome: string; ativo: boolean; turmas: string[] }
  >();
  if (p.todoEstudio) {
    const todos = await tx
      .select({ id: pessoas.id, nome: pessoas.nome, ativo: pessoaPapeis.ativo })
      .from(pessoaPapeis)
      .innerJoin(pessoas, eq(pessoas.id, pessoaPapeis.pessoaId))
      .where(eq(pessoaPapeis.papel, "aluno"));
    for (const t of todos) {
      candidatos.set(t.id, { nome: t.nome, ativo: t.ativo, turmas: [] });
    }
  } else {
    const abertas = await tx
      .select({
        id: pessoas.id,
        nome: pessoas.nome,
        ativo: pessoaPapeis.ativo,
        turmaId: matriculas.turmaId,
      })
      .from(matriculas)
      .innerJoin(pessoas, eq(pessoas.id, matriculas.alunoId))
      .innerJoin(
        pessoaPapeis,
        and(
          eq(pessoaPapeis.pessoaId, pessoas.id),
          eq(pessoaPapeis.papel, "aluno"),
        ),
      )
      .where(
        and(inArray(matriculas.turmaId, p.turmaIds), isNull(matriculas.saida)),
      );
    for (const m of abertas) {
      const c = candidatos.get(m.id) ?? {
        nome: m.nome,
        ativo: m.ativo,
        turmas: [],
      };
      c.turmas.push(m.turmaId);
      candidatos.set(m.id, c);
    }
  }

  const linhas: LinhaInterna[] = [];
  for (const [alunoId, c] of candidatos) {
    const { periodos, trancamentos } = await carregarPeriodosDoAluno(
      tx,
      alunoId,
    );
    const resumo = calcularEstado(
      { encerrado: !c.ativo, periodos, trancamentos },
      hoje,
    );
    if (resumo.estado !== "vigente" || resumo.ultimo === null) continue;
    let dias = p.quantidade;
    let turmaConversaoId: string | null = null;
    if (p.unidade === "aulas") {
      // Em mais de uma turma do lote, vale a conversão que dá mais dias.
      dias = 0;
      for (const turmaId of c.turmas) {
        const d = diasPorAulas(p.quantidade, porTurma.get(turmaId) ?? 0);
        if (d > dias) {
          dias = d;
          turmaConversaoId = turmaId;
        }
      }
    }
    linhas.push({
      alunoId,
      nome: c.nome,
      periodoId: resumo.ultimo.id,
      fimAntes: resumo.ultimo.fimEfetivo,
      fimDepois: fimEfetivo({
        ...resumo.ultimo,
        diasAjustes: resumo.ultimo.diasAjustes + dias,
      }),
      dias,
      turmaConversaoId,
    });
  }
  linhas.sort(
    (x, y) =>
      x.nome.localeCompare(y.nome, "pt-BR") || (x.alunoId < y.alunoId ? -1 : 1),
  );
  return { ok: true, valor: linhas };
}

const semPeriodo = ({ periodoId: _, ...linha }: LinhaInterna): LinhaPrevia =>
  linha;

/** Quem receberia o lote, por nome, com fim atual, novo fim e dias. */
export async function previaLote(
  db: Banco,
  a: Entrada,
  hoje: DataIso,
): Promise<Resultado<{ linhas: LinhaPrevia[] }>> {
  const pedido = lerPedido(a);
  if (!pedido.ok) return pedido;
  const linhas = await calcularLinhas(db, pedido.valor, hoje);
  if (!linhas.ok) return linhas;
  return { ok: true, valor: { linhas: linhas.valor.map(semPeriodo) } };
}

/**
 * Grava o lote e uma extensão por aluno. A prévia é recalculada dentro da
 * transação, depois de travar quem a primeira leitura mostrou.
 */
export async function confirmarLote(
  db: Banco,
  a: Entrada & { motivo: string; feitoPor: string },
  hoje: DataIso,
): Promise<Resultado<{ loteId: string; alunos: number }>> {
  const pedido = lerPedido(a);
  const motivo = a.motivo?.trim() ?? "";
  if (!pedido.ok) {
    return {
      ok: false,
      erros: {
        ...pedido.erros,
        ...(motivo ? {} : { motivo: MENSAGEM_MOTIVO }),
      },
    };
  }
  if (!motivo) return falha("motivo", MENSAGEM_MOTIVO);
  const p = pedido.valor;

  return executarTraduzindo<{ loteId: string; alunos: number }>(
    () =>
      db.transaction(async (tx) => {
        const lida = await calcularLinhas(tx, p, hoje);
        if (!lida.ok) return lida;
        await travarAlunosEmOrdem(
          tx,
          lida.valor.map((l) => l.alunoId),
        );
        const recalculada = await calcularLinhas(tx, p, hoje);
        if (!recalculada.ok) return recalculada;
        const linhas = recalculada.valor;
        if (linhas.length === 0) {
          return falha(
            "_",
            p.todoEstudio ? MENSAGEM_SEM_ALUNO_ESTUDIO : MENSAGEM_SEM_ALUNO,
          );
        }
        const [novo] = await tx
          .insert(lotesExtensao)
          .values({
            todoEstudio: p.todoEstudio,
            quantidadeDigitada: p.quantidade,
            unidadeDigitada: p.unidade,
            motivo,
            criadoPor: a.feitoPor,
          })
          .returning({ id: lotesExtensao.id });
        if (p.turmaIds.length > 0) {
          await tx
            .insert(loteTurmas)
            .values(
              p.turmaIds.map((turmaId) => ({ loteId: novo.id, turmaId })),
            );
        }
        await tx.insert(ajustesPeriodo).values(
          linhas.map((l) => ({
            periodoId: l.periodoId,
            tipo: "extensao" as const,
            dias: l.dias,
            quantidadeDigitada: p.quantidade,
            unidadeDigitada: p.unidade,
            turmaConversaoId: l.turmaConversaoId,
            motivo,
            loteId: novo.id,
            criadoPor: a.feitoPor,
          })),
        );
        return {
          ok: true as const,
          valor: { loteId: novo.id, alunos: linhas.length },
        };
      }),
    {},
  );
}

/** Lotes do mais novo ao mais antigo. */
export async function listarLotes(db: Banco): Promise<
  {
    id: string;
    criadoEm: Date;
    criadoPor: string;
    turmas: string[];
    todoEstudio: boolean;
    quantidadeDigitada: number;
    unidadeDigitada: "dias" | "aulas";
    motivo: string;
    alunos: number;
    anulado: boolean;
    motivoAnulacao: string | null;
  }[]
> {
  const lotes = await db
    .select({
      id: lotesExtensao.id,
      criadoEm: lotesExtensao.criadoEm,
      criadoPor: pessoas.nome,
      todoEstudio: lotesExtensao.todoEstudio,
      quantidadeDigitada: lotesExtensao.quantidadeDigitada,
      unidadeDigitada: lotesExtensao.unidadeDigitada,
      motivo: lotesExtensao.motivo,
      anuladoEm: lotesExtensao.anuladoEm,
      motivoAnulacao: lotesExtensao.motivoAnulacao,
      alunos:
        sql<number>`(select count(*) from ${ajustesPeriodo} where ${ajustesPeriodo.loteId} = ${lotesExtensao.id})`.mapWith(
          Number,
        ),
    })
    .from(lotesExtensao)
    .innerJoin(pessoas, eq(pessoas.id, lotesExtensao.criadoPor))
    .orderBy(desc(lotesExtensao.criadoEm), desc(lotesExtensao.id));
  if (lotes.length === 0) return [];

  const modulo = alias(modulos, "modulo");
  const doLote = await db
    .select({
      loteId: loteTurmas.loteId,
      ritmo: ritmos.nome,
      modulo: modulo.nome,
      dias: sql<
        number[]
      >`coalesce(array_agg(${turmaDias.diaSemana} order by ${turmaDias.diaSemana}) filter (where ${turmaDias.diaSemana} is not null), '{}')`,
      horarioInicio: turmas.horarioInicio,
    })
    .from(loteTurmas)
    .innerJoin(turmas, eq(turmas.id, loteTurmas.turmaId))
    .innerJoin(ritmos, eq(ritmos.id, turmas.ritmoId))
    .innerJoin(modulo, eq(modulo.id, turmas.moduloId))
    .leftJoin(turmaDias, eq(turmaDias.turmaId, turmas.id))
    .groupBy(loteTurmas.loteId, turmas.id, ritmos.id, modulo.id)
    .orderBy(
      asc(ritmos.ordem),
      asc(ritmos.nome),
      asc(modulo.ordem),
      asc(turmas.id),
    );
  const rotulos = new Map<string, string[]>();
  for (const t of doLote) {
    rotulos.set(t.loteId, [...(rotulos.get(t.loteId) ?? []), rotuloDaTurma(t)]);
  }
  return lotes.map(({ anuladoEm, ...l }) => ({
    ...l,
    turmas: rotulos.get(l.id) ?? [],
    anulado: anuladoEm !== null,
  }));
}

async function buscarLote(tx: Executor, loteId: string) {
  const [l] = await tx
    .select({ id: lotesExtensao.id, anuladoEm: lotesExtensao.anuladoEm })
    .from(lotesExtensao)
    .where(eq(lotesExtensao.id, loteId));
  return l;
}

/** Alunos donos das linhas vivas do lote. */
async function alunosDasLinhasVivas(tx: Executor, loteId: string) {
  const linhas = await tx
    .select({ alunoId: periodosContratados.alunoId })
    .from(ajustesPeriodo)
    .innerJoin(
      periodosContratados,
      eq(periodosContratados.id, ajustesPeriodo.periodoId),
    )
    .where(
      and(eq(ajustesPeriodo.loteId, loteId), isNull(ajustesPeriodo.anuladoEm)),
    );
  return linhas.map((l) => l.alunoId);
}

/**
 * Anula as linhas ainda vivas do lote e o próprio lote. Vale também para
 * aluno encerrado: corrigir o histórico não exige reabrir.
 */
export async function anularLote(
  db: Banco,
  a: { loteId: string; motivo: string; feitoPor: string },
): Promise<Resultado<{ anulados: number }>> {
  const motivo = a.motivo?.trim() ?? "";
  if (!motivo) return falha("motivo", MENSAGEM_MOTIVO);
  const naoEncontrado = falha("_", MENSAGEM_LOTE_NAO_ENCONTRADO);
  if (!ehUuid(a.loteId)) return naoEncontrado;
  return executarTraduzindo<{ anulados: number }>(
    () =>
      db.transaction(async (tx) => {
        if (!(await buscarLote(tx, a.loteId))) return naoEncontrado;
        await travarAlunosEmOrdem(tx, await alunosDasLinhasVivas(tx, a.loteId));
        // Relido depois das travas: outra anulação já terminou.
        const lote = await buscarLote(tx, a.loteId);
        if (!lote) return naoEncontrado;
        if (lote.anuladoEm) return falha("_", MENSAGEM_JA_ANULADO);
        const agora = new Date();
        const anuladas = await tx
          .update(ajustesPeriodo)
          .set({
            anuladoEm: agora,
            anuladoPor: a.feitoPor,
            motivoAnulacao: motivo,
          })
          .where(
            and(
              eq(ajustesPeriodo.loteId, lote.id),
              isNull(ajustesPeriodo.anuladoEm),
            ),
          )
          .returning({ id: ajustesPeriodo.id });
        await tx
          .update(lotesExtensao)
          .set({
            anuladoEm: agora,
            anuladoPor: a.feitoPor,
            motivoAnulacao: motivo,
          })
          .where(eq(lotesExtensao.id, lote.id));
        return { ok: true as const, valor: { anulados: anuladas.length } };
      }),
    {},
  );
}
