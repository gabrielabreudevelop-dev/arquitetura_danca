import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { Banco } from "../banco/cliente";
import { matriculas, pessoaPapeis, turmas } from "../banco/esquema";
import { ehUuid, executarTraduzindo } from "../cadastros/comum";
import type { Resultado } from "../cadastros/resultado";
import { alunoAtivoOuErro, type Executor, travar } from "./cadastro";
import { ehDataIso, formatarDia } from "./datas";

const MENSAGEM_DATA = "Informe uma data válida.";
const MENSAGEM_TURMA_NAO_ENCONTRADA = "Turma não encontrada.";
const MENSAGEM_TURMA_ATIVA = "Escolha uma turma ativa.";
const MENSAGEM_JA_NA_TURMA = "Já está nesta turma.";
const MENSAGEM_MATRICULA_NAO_ENCONTRADA = "Matrícula não encontrada.";
const MENSAGEM_MATRICULA_ENCERRADA = "Essa matrícula já foi encerrada.";

const ERROS_BANCO_MATRICULAR = {
  matriculas_aberta_unica: { campo: "turmaId", mensagem: MENSAGEM_JA_NA_TURMA },
};
const ERROS_BANCO_TROCAR = {
  matriculas_aberta_unica: {
    campo: "novaTurmaId",
    mensagem: MENSAGEM_JA_NA_TURMA,
  },
};
const ERROS_BANCO_MOVER = {
  matriculas_aberta_unica: {
    campo: "paraTurmaId",
    mensagem: MENSAGEM_JA_NA_TURMA,
  },
};

type Falha = { ok: false; erros: Record<string, string> };

const falha = (campo: string, mensagem: string): Falha => ({
  ok: false,
  erros: { [campo]: mensagem },
});

/** A turma: `undefined` se não existe. */
async function buscarTurma(tx: Executor, turmaId: string) {
  if (!ehUuid(turmaId)) return undefined;
  const [turma] = await tx
    .select({ ativa: turmas.ativa })
    .from(turmas)
    .where(eq(turmas.id, turmaId));
  return turma;
}

async function buscarMatricula(tx: Executor, matriculaId: string) {
  const [m] = await tx
    .select()
    .from(matriculas)
    .where(eq(matriculas.id, matriculaId));
  return m;
}

/**
 * Lê a matrícula, trava o aluno e lê de novo (já com a trava), para não
 * agir sobre uma linha que outra operação acabou de fechar.
 */
async function matriculaTravada(tx: Executor, matriculaId: string) {
  if (!ehUuid(matriculaId)) return undefined;
  const lida = await buscarMatricula(tx, matriculaId);
  if (!lida) return undefined;
  await travar(tx, lida.alunoId);
  return buscarMatricula(tx, matriculaId);
}

/** Última saída do aluno na turma (matrículas já fechadas), ou `null`. */
async function ultimaSaida(
  tx: Executor,
  alunoId: string,
  turmaId: string,
): Promise<string | null> {
  const [linha] = await tx
    .select({ saida: sql<string | null>`max(${matriculas.saida})` })
    .from(matriculas)
    .where(
      and(eq(matriculas.alunoId, alunoId), eq(matriculas.turmaId, turmaId)),
    );
  return linha?.saida ?? null;
}

/** Quem volta para uma turma entra depois da última saída dela (R18). */
function mensagemVolta(saida: string): string {
  return `A entrada precisa ser depois da última saída desta turma (${formatarDia(saida)}).`;
}

/** Matricula o aluno numa turma ativa, com entrada em `entrada`. */
export async function matricular(
  db: Banco,
  a: { alunoId: string; turmaId: string; entrada: string; feitoPor: string },
): Promise<Resultado<{ matriculaId: string }>> {
  const entrada = a.entrada?.trim() ?? "";
  if (!ehDataIso(entrada)) return falha("entrada", MENSAGEM_DATA);
  return executarTraduzindo<{ matriculaId: string }>(
    () =>
      db.transaction(async (tx) => {
        if (ehUuid(a.alunoId)) await travar(tx, a.alunoId);
        const ativo = await alunoAtivoOuErro(tx, a.alunoId);
        if (!ativo.ok) return ativo;
        const turma = await buscarTurma(tx, a.turmaId);
        if (!turma) return falha("turmaId", MENSAGEM_TURMA_NAO_ENCONTRADA);
        if (!turma.ativa) return falha("turmaId", MENSAGEM_TURMA_ATIVA);
        const saida = await ultimaSaida(tx, a.alunoId, a.turmaId);
        if (saida !== null && entrada <= saida) {
          return falha("entrada", mensagemVolta(saida));
        }
        const [nova] = await tx
          .insert(matriculas)
          .values({
            alunoId: a.alunoId,
            turmaId: a.turmaId,
            entrada,
            criadoPor: a.feitoPor,
          })
          .returning({ id: matriculas.id });
        return { ok: true as const, valor: { matriculaId: nova.id } };
      }),
    ERROS_BANCO_MATRICULAR,
  );
}

/** Fecha a matrícula com saída em `saida`. O histórico fica. */
export async function tirarDaTurma(
  db: Banco,
  a: { matriculaId: string; saida: string; feitoPor: string },
): Promise<Resultado<null>> {
  const saida = a.saida?.trim() ?? "";
  if (!ehDataIso(saida)) return falha("saida", MENSAGEM_DATA);
  return executarTraduzindo<null>(
    () =>
      db.transaction(async (tx) => {
        const m = await matriculaTravada(tx, a.matriculaId);
        if (!m) return falha("_", MENSAGEM_MATRICULA_NAO_ENCONTRADA);
        if (m.saida !== null) return falha("_", MENSAGEM_MATRICULA_ENCERRADA);
        if (saida < m.entrada) {
          return falha("saida", "A saída não pode ser antes da entrada.");
        }
        await tx
          .update(matriculas)
          .set({ saida, saidaPor: a.feitoPor })
          .where(eq(matriculas.id, m.id));
        return { ok: true as const, valor: null };
      }),
    {},
  );
}

/**
 * Fecha a matrícula e abre outra, na turma nova, com a mesma data. Se o aluno
 * já está na turma nova, nada muda.
 */
export async function trocarDeTurma(
  db: Banco,
  a: {
    matriculaId: string;
    novaTurmaId: string;
    data: string;
    feitoPor: string;
  },
): Promise<Resultado<{ matriculaId: string }>> {
  const data = a.data?.trim() ?? "";
  if (!ehDataIso(data)) return falha("data", MENSAGEM_DATA);
  return executarTraduzindo<{ matriculaId: string }>(
    () =>
      db.transaction(async (tx) => {
        const m = await matriculaTravada(tx, a.matriculaId);
        if (!m) return falha("_", MENSAGEM_MATRICULA_NAO_ENCONTRADA);
        if (m.saida !== null) return falha("_", MENSAGEM_MATRICULA_ENCERRADA);
        const ativo = await alunoAtivoOuErro(tx, m.alunoId);
        if (!ativo.ok) return ativo;
        const turma = await buscarTurma(tx, a.novaTurmaId);
        if (!turma) return falha("novaTurmaId", MENSAGEM_TURMA_NAO_ENCONTRADA);
        if (!turma.ativa) return falha("novaTurmaId", MENSAGEM_TURMA_ATIVA);
        if (a.novaTurmaId === m.turmaId) {
          return falha("novaTurmaId", MENSAGEM_JA_NA_TURMA);
        }
        const [jaAberta] = await tx
          .select({ id: matriculas.id })
          .from(matriculas)
          .where(
            and(
              eq(matriculas.alunoId, m.alunoId),
              eq(matriculas.turmaId, a.novaTurmaId),
              isNull(matriculas.saida),
            ),
          );
        if (jaAberta) return falha("novaTurmaId", MENSAGEM_JA_NA_TURMA);
        if (data < m.entrada) {
          return falha("data", "A data não pode ser antes da entrada.");
        }
        const saida = await ultimaSaida(tx, m.alunoId, a.novaTurmaId);
        if (saida !== null && data <= saida) {
          return falha("data", mensagemVolta(saida));
        }
        await tx
          .update(matriculas)
          .set({ saida: data, saidaPor: a.feitoPor })
          .where(eq(matriculas.id, m.id));
        const [nova] = await tx
          .insert(matriculas)
          .values({
            alunoId: m.alunoId,
            turmaId: a.novaTurmaId,
            entrada: data,
            criadoPor: a.feitoPor,
          })
          .returning({ id: matriculas.id });
        return { ok: true as const, valor: { matriculaId: nova.id } };
      }),
    ERROS_BANCO_TROCAR,
  );
}

/**
 * Passa os alunos ativos da turma de origem para a de destino (ativa), com a
 * data dada. Quem já está no destino só sai da origem. Alunos encerrados ficam
 * como estão. Tudo ou nada.
 */
export async function moverAlunosDaTurma(
  db: Banco,
  a: { deTurmaId: string; paraTurmaId: string; data: string; feitoPor: string },
): Promise<Resultado<{ movidos: number }>> {
  const data = a.data?.trim() ?? "";
  if (!ehDataIso(data)) return falha("data", MENSAGEM_DATA);
  return executarTraduzindo<{ movidos: number }>(
    () =>
      db.transaction(async (tx) => {
        if (!(await buscarTurma(tx, a.deTurmaId))) {
          return falha("deTurmaId", MENSAGEM_TURMA_NAO_ENCONTRADA);
        }
        const destino = await buscarTurma(tx, a.paraTurmaId);
        if (!destino)
          return falha("paraTurmaId", MENSAGEM_TURMA_NAO_ENCONTRADA);
        if (a.paraTurmaId === a.deTurmaId) {
          return falha("paraTurmaId", "Escolha outra turma.");
        }
        if (!destino.ativa) return falha("paraTurmaId", MENSAGEM_TURMA_ATIVA);

        const abertasDaOrigem = () =>
          tx
            .select({
              id: matriculas.id,
              alunoId: matriculas.alunoId,
              entrada: matriculas.entrada,
            })
            .from(matriculas)
            .innerJoin(
              pessoaPapeis,
              and(
                eq(pessoaPapeis.pessoaId, matriculas.alunoId),
                eq(pessoaPapeis.papel, "aluno"),
                eq(pessoaPapeis.ativo, true),
              ),
            )
            .where(
              and(
                eq(matriculas.turmaId, a.deTurmaId),
                isNull(matriculas.saida),
              ),
            )
            .orderBy(asc(matriculas.alunoId));

        // Trava os alunos em ordem de id e só então relê o que vai mudar.
        for (const { alunoId } of await abertasDaOrigem()) {
          await travar(tx, alunoId);
        }
        const doOrigem = await abertasDaOrigem();
        // Quem entrou na turma entre a primeira leitura e a trava também é travado.
        for (const { alunoId } of doOrigem) await travar(tx, alunoId);

        // A data precisa ser igual ou posterior à maior entrada.
        const posterior = doOrigem
          .map((m) => m.entrada)
          .sort()
          .at(-1);
        if (posterior && posterior > data) {
          return falha(
            "data",
            `A data não pode ser antes da entrada de um aluno na turma (${formatarDia(posterior)}).`,
          );
        }

        const jaNoDestino = new Set(
          (
            await tx
              .select({ alunoId: matriculas.alunoId })
              .from(matriculas)
              .where(
                and(
                  eq(matriculas.turmaId, a.paraTurmaId),
                  isNull(matriculas.saida),
                ),
              )
          ).map((m) => m.alunoId),
        );

        // Quem já saiu do destino depois da data não pode voltar a ele nela.
        let maiorSaida: string | null = null;
        for (const m of doOrigem) {
          if (jaNoDestino.has(m.alunoId)) continue;
          const saida = await ultimaSaida(tx, m.alunoId, a.paraTurmaId);
          if (
            saida !== null &&
            data <= saida &&
            (!maiorSaida || saida > maiorSaida)
          ) {
            maiorSaida = saida;
          }
        }
        if (maiorSaida) return falha("data", mensagemVolta(maiorSaida));

        let movidos = 0;
        for (const m of doOrigem) {
          await tx
            .update(matriculas)
            .set({ saida: data, saidaPor: a.feitoPor })
            .where(eq(matriculas.id, m.id));
          if (jaNoDestino.has(m.alunoId)) continue;
          await tx.insert(matriculas).values({
            alunoId: m.alunoId,
            turmaId: a.paraTurmaId,
            entrada: data,
            criadoPor: a.feitoPor,
          });
          movidos += 1;
        }
        return { ok: true as const, valor: { movidos } };
      }),
    ERROS_BANCO_MOVER,
  );
}

/** Quantas matrículas abertas cada turma tem (turma sem nenhuma não aparece). */
export async function contarMatriculasAbertas(
  db: Executor,
): Promise<Map<string, number>> {
  const linhas = await db
    .select({
      turmaId: matriculas.turmaId,
      total: sql<number>`count(*)::int`,
    })
    .from(matriculas)
    .where(isNull(matriculas.saida))
    .groupBy(matriculas.turmaId);
  return new Map(linhas.map((l) => [l.turmaId, l.total]));
}
