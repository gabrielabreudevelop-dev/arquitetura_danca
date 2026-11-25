/**
 * Trancamento do período: pausa com volta conhecida ou aberta, fechamento
 * ("destrancar") e anulação. Na pausa fechada, uma linha `trancamento` no
 * livro do último período empurra o fim pelos dias parados. Toda escrita roda
 * numa transação que começa travando a linha do aluno.
 */
import { and, eq, isNull } from "drizzle-orm";
import type { Banco } from "../banco/cliente";
import {
  ajustesPeriodo,
  periodosContratados,
  trancamentos,
} from "../banco/esquema";
import { ehUuid, executarTraduzindo } from "../cadastros/comum";
import type { Resultado } from "../cadastros/resultado";
import { alunoAtivoOuErro, type Executor } from "./cadastro";
import { diasEntre, ehDataIso, formatarDia } from "./datas";
import { estaVazio, fimEfetivo, ultimoPeriodo } from "./estado";
import {
  bloqueioPorDiasCedidos,
  carregarPeriodosDoAluno,
  travarAluno,
} from "./periodos";

const MENSAGEM_DATA = "Informe uma data válida.";
const MENSAGEM_MOTIVO = "Informe o motivo.";
const MENSAGEM_JA_ANULADO = "Isso já foi anulado.";
const MENSAGEM_VOLTA = "A volta precisa ser depois do início.";
const MENSAGEM_SOBREPOSTO = "Já existe um trancamento nesse intervalo.";

type Falha = { ok: false; erros: Record<string, string> };

const falha = (campo: string, mensagem: string): Falha => ({
  ok: false,
  erros: { [campo]: mensagem },
});

/** Dois trancamentos se sobrepõem se se cruzam; a volta é o primeiro dia de volta, então encostar não conta. */
function sobrepoe(
  a: { inicio: string; volta: string | null },
  b: { inicio: string; volta: string | null },
): boolean {
  return (
    (b.volta === null || a.inicio < b.volta) &&
    (a.volta === null || b.inicio < a.volta)
  );
}

/**
 * Pausa o último período do aluno a partir de `inicio`. Com `volta`, fecha na
 * hora e gera a linha do livro (dias = volta − início); sem ela, fica aberto
 * até `destrancar`. Bloqueada para aluno encerrado.
 */
export async function trancar(
  db: Banco,
  a: {
    alunoId: string;
    inicio: string;
    volta?: string;
    motivo?: string;
    feitoPor: string;
  },
  hoje: string,
): Promise<Resultado<{ trancamentoId: string }>> {
  const inicio = a.inicio?.trim() ?? "";
  const volta = a.volta?.trim() || null;
  const motivo = a.motivo?.trim() || null;
  const erros: Record<string, string> = {};
  if (!ehDataIso(inicio)) erros.inicio = MENSAGEM_DATA;
  if (volta !== null) {
    if (!ehDataIso(volta)) erros.volta = MENSAGEM_DATA;
    else if (!erros.inicio && volta <= inicio) erros.volta = MENSAGEM_VOLTA;
  }
  if (Object.keys(erros).length > 0) return { ok: false, erros };

  return executarTraduzindo<{ trancamentoId: string }>(
    () =>
      db.transaction(async (tx) => {
        if (!ehUuid(a.alunoId)) return falha("_", "Aluno não encontrado.");
        await travarAluno(tx, a.alunoId);
        const ativo = await alunoAtivoOuErro(tx, a.alunoId);
        if (!ativo.ok) return ativo;
        const { periodos, trancamentos: existentes } =
          await carregarPeriodosDoAluno(tx, a.alunoId);
        if (existentes.some((t) => t.volta === null)) {
          return falha("_", "Já existe um trancamento aberto.");
        }
        const ultimo = ultimoPeriodo(periodos);
        if (!ultimo || fimEfetivo(ultimo) < hoje || estaVazio(ultimo)) {
          return falha(
            "_",
            "Só é possível trancar um período vigente ou que vai começar.",
          );
        }
        const fim = fimEfetivo(ultimo);
        if (inicio < ultimo.inicio || inicio > fim) {
          return falha(
            "inicio",
            `O início precisa estar dentro do período (${formatarDia(ultimo.inicio)} a ${formatarDia(fim)}).`,
          );
        }
        if (existentes.some((t) => sobrepoe({ inicio, volta }, t))) {
          return falha("inicio", MENSAGEM_SOBREPOSTO);
        }
        const [novo] = await tx
          .insert(trancamentos)
          .values({
            periodoId: ultimo.id,
            inicio,
            volta,
            motivo,
            criadoPor: a.feitoPor,
          })
          .returning({ id: trancamentos.id });
        if (volta !== null) {
          await registrarLinha(tx, {
            periodoId: ultimo.id,
            trancamentoId: novo.id,
            dias: diasEntre(inicio, volta),
            motivo,
            feitoPor: a.feitoPor,
          });
        }
        return { ok: true as const, valor: { trancamentoId: novo.id } };
      }),
    {},
  );
}

async function registrarLinha(
  tx: Executor,
  a: {
    periodoId: string;
    trancamentoId: string;
    dias: number;
    motivo: string | null;
    feitoPor: string;
  },
) {
  await tx.insert(ajustesPeriodo).values({
    periodoId: a.periodoId,
    tipo: "trancamento",
    dias: a.dias,
    quantidadeDigitada: a.dias,
    unidadeDigitada: "dias",
    motivo: a.motivo,
    trancamentoId: a.trancamentoId,
    criadoPor: a.feitoPor,
  });
}

async function buscarTrancamento(tx: Executor, trancamentoId: string) {
  const [t] = await tx
    .select({
      id: trancamentos.id,
      inicio: trancamentos.inicio,
      volta: trancamentos.volta,
      motivo: trancamentos.motivo,
      anuladoEm: trancamentos.anuladoEm,
      alunoId: periodosContratados.alunoId,
    })
    .from(trancamentos)
    .innerJoin(
      periodosContratados,
      eq(periodosContratados.id, trancamentos.periodoId),
    )
    .where(eq(trancamentos.id, trancamentoId));
  return t;
}

/**
 * Fecha um trancamento aberto com a data de volta e gera a linha do livro
 * (dias = volta − início) no último período. Vale também para aluno
 * encerrado: só fecha uma pausa que já existe.
 */
export async function destrancar(
  db: Banco,
  a: { trancamentoId: string; volta: string; feitoPor: string },
): Promise<Resultado<{ dias: number }>> {
  const volta = a.volta?.trim() ?? "";
  if (!ehDataIso(volta)) return falha("volta", MENSAGEM_DATA);
  const naoEncontrado = falha("_", "Trancamento não encontrado.");
  if (!ehUuid(a.trancamentoId)) return naoEncontrado;

  return executarTraduzindo<{ dias: number }>(
    () =>
      db.transaction(async (tx) => {
        const lido = await buscarTrancamento(tx, a.trancamentoId);
        if (!lido) return naoEncontrado;
        await travarAluno(tx, lido.alunoId);
        const t = await buscarTrancamento(tx, a.trancamentoId);
        if (!t) return naoEncontrado;
        if (t.anuladoEm) return falha("_", "Este trancamento foi anulado.");
        if (t.volta !== null) {
          return falha("_", "Este trancamento já foi encerrado.");
        }
        if (volta <= t.inicio) return falha("volta", MENSAGEM_VOLTA);
        const { periodos, trancamentos: outros } =
          await carregarPeriodosDoAluno(tx, t.alunoId);
        if (
          outros.some(
            (o) => o.id !== t.id && sobrepoe({ inicio: t.inicio, volta }, o),
          )
        ) {
          return falha("volta", MENSAGEM_SOBREPOSTO);
        }
        const ultimo = ultimoPeriodo(periodos);
        if (!ultimo) return naoEncontrado;
        const dias = diasEntre(t.inicio, volta);
        await tx
          .update(trancamentos)
          .set({
            volta,
            destrancadoPor: a.feitoPor,
            destrancadoEm: new Date(),
          })
          .where(eq(trancamentos.id, t.id));
        await registrarLinha(tx, {
          periodoId: ultimo.id,
          trancamentoId: t.id,
          dias,
          motivo: t.motivo,
          feitoPor: a.feitoPor,
        });
        return { ok: true as const, valor: { dias } };
      }),
    {},
  );
}

/**
 * Anula o trancamento (aberto ou fechado) e a linha que ele gerou no livro.
 * Vale também para aluno encerrado: corrigir o histórico não exige reabrir.
 */
export async function anularTrancamento(
  db: Banco,
  a: { trancamentoId: string; motivo: string; feitoPor: string },
): Promise<Resultado<null>> {
  const motivo = a.motivo?.trim() ?? "";
  if (!motivo) return falha("motivo", MENSAGEM_MOTIVO);
  const naoEncontrado = falha("_", "Trancamento não encontrado.");
  if (!ehUuid(a.trancamentoId)) return naoEncontrado;

  return executarTraduzindo<null>(
    () =>
      db.transaction(async (tx) => {
        const lido = await buscarTrancamento(tx, a.trancamentoId);
        if (!lido) return naoEncontrado;
        await travarAluno(tx, lido.alunoId);
        const t = await buscarTrancamento(tx, a.trancamentoId);
        if (!t) return naoEncontrado;
        if (t.anuladoEm) return falha("_", MENSAGEM_JA_ANULADO);
        const [linha] = await tx
          .select({
            periodoId: ajustesPeriodo.periodoId,
            dias: ajustesPeriodo.dias,
          })
          .from(ajustesPeriodo)
          .where(
            and(
              eq(ajustesPeriodo.trancamentoId, t.id),
              isNull(ajustesPeriodo.anuladoEm),
            ),
          );
        if (linha) {
          const cedidos = await bloqueioPorDiasCedidos(
            tx,
            linha.periodoId,
            linha.dias,
          );
          if (cedidos) return cedidos;
        }
        const anulacao = {
          anuladoEm: new Date(),
          anuladoPor: a.feitoPor,
          motivoAnulacao: motivo,
        };
        await tx
          .update(trancamentos)
          .set(anulacao)
          .where(eq(trancamentos.id, t.id));
        await tx
          .update(ajustesPeriodo)
          .set(anulacao)
          .where(
            and(
              eq(ajustesPeriodo.trancamentoId, t.id),
              isNull(ajustesPeriodo.anuladoEm),
            ),
          );
        return { ok: true as const, valor: null };
      }),
    {},
  );
}
