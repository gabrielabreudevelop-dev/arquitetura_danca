import { asc, eq, min, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import type { Banco } from "../banco/cliente";
import { modulos, pessoas, ritmos, turmaDias, turmas } from "../banco/esquema";
import { linkGrupoWhatsappValido } from "../vitrine/eventos";
import { executarTraduzindo } from "./comum";
import { listarModulos } from "./modulos";
import { listarProfessores } from "./professores";
import { errosDeZod, type Resultado } from "./resultado";
import { listarRitmos } from "./ritmos";

const MENSAGEM_HORARIO = "Informe o horário.";
const HORARIO = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const horarioSchema = z
  .string()
  .trim()
  .regex(HORARIO, MENSAGEM_HORARIO)
  // O banco devolve "HH:MM:SS"; o formulário envia "HH:MM". Guardamos sempre com segundos.
  .transform((valor) => (valor.length === 5 ? `${valor}:00` : valor));

const esquema = z.object({
  id: z.string().optional(),
  ritmoId: z.string(),
  moduloId: z.string(),
  professorId: z.string(),
  dias: z
    .array(
      z
        .number()
        .int("Dia inválido.")
        .min(0, "Dia inválido.")
        .max(6, "Dia inválido."),
    )
    .min(1, "Escolha pelo menos um dia."),
  horarioInicio: horarioSchema,
  horarioFim: horarioSchema,
  linkGrupoWhatsapp: z.string().optional(),
  ativa: z.boolean(),
});

export type DadosTurma = {
  id?: string;
  ritmoId: string;
  moduloId: string;
  professorId: string;
  dias: number[];
  horarioInicio: string;
  horarioFim: string;
  linkGrupoWhatsapp?: string;
  ativa: boolean;
};

/** Dados já validados e prontos para gravar (horários "HH:MM:SS", link `null` se vazio). */
export type TurmaPronta = {
  id?: string;
  ritmoId: string;
  moduloId: string;
  professorId: string;
  dias: number[];
  horarioInicio: string;
  horarioFim: string;
  linkGrupoWhatsapp: string | null;
  ativa: boolean;
};

/** Turmas por ordem do ritmo, ordem do módulo, primeiro dia e início. */
export async function listarTurmas(db: Banco) {
  const modulo = alias(modulos, "modulo");
  const professor = alias(pessoas, "professor");
  return db
    .select({
      id: turmas.id,
      ritmo: ritmos.nome,
      modulo: modulo.nome,
      professor: professor.nome,
      dias: sql<
        number[]
      >`coalesce(array_agg(${turmaDias.diaSemana} order by ${turmaDias.diaSemana}) filter (where ${turmaDias.diaSemana} is not null), '{}')`,
      horarioInicio: turmas.horarioInicio,
      horarioFim: turmas.horarioFim,
      ativa: turmas.ativa,
    })
    .from(turmas)
    .innerJoin(ritmos, eq(ritmos.id, turmas.ritmoId))
    .innerJoin(modulo, eq(modulo.id, turmas.moduloId))
    .innerJoin(professor, eq(professor.id, turmas.professorId))
    .leftJoin(turmaDias, eq(turmaDias.turmaId, turmas.id))
    .groupBy(turmas.id, ritmos.id, modulo.id, professor.id)
    .orderBy(
      asc(ritmos.ordem),
      asc(ritmos.nome),
      asc(modulo.ordem),
      asc(modulo.nome),
      asc(min(turmaDias.diaSemana)),
      asc(turmas.horarioInicio),
      asc(turmas.id),
    );
}

/** A turma com seus dias (ordenados), ou `null` se não existir. */
export async function obterTurma(db: Banco, id: string) {
  const [turma] = await db.select().from(turmas).where(eq(turmas.id, id));
  if (!turma) return null;
  const dias = await db
    .select({ diaSemana: turmaDias.diaSemana })
    .from(turmaDias)
    .where(eq(turmaDias.turmaId, id))
    .orderBy(asc(turmaDias.diaSemana));
  return { ...turma, dias: dias.map((d) => d.diaSemana) };
}

/**
 * Opções dos campos do formulário: só ritmos, módulos e professores ativos,
 * mais os atuais da turma `turmaId` (mesmo desativados), para ela continuar
 * editável.
 */
export async function opcoesDeTurma(db: Banco, turmaId?: string) {
  const [atual] = turmaId
    ? await db
        .select({
          ritmoId: turmas.ritmoId,
          moduloId: turmas.moduloId,
          professorId: turmas.professorId,
        })
        .from(turmas)
        .where(eq(turmas.id, turmaId))
    : [];
  const [todosRitmos, todosModulos, todosProfessores] = await Promise.all([
    listarRitmos(db),
    listarModulos(db),
    listarProfessores(db),
  ]);
  const escolher = <T extends { ativo: boolean; nome: string }>(
    lista: T[],
    idDe: (item: T) => string,
    idAtual: string | undefined,
  ) =>
    lista
      .filter((item) => item.ativo || idDe(item) === idAtual)
      .map((item) => ({
        id: idDe(item),
        nome: item.nome,
        ativo: item.ativo,
      }));
  return {
    ritmos: escolher(todosRitmos, (r) => r.id, atual?.ritmoId),
    modulos: escolher(todosModulos, (m) => m.id, atual?.moduloId),
    professores: escolher(
      todosProfessores,
      (p) => p.pessoaId,
      atual?.professorId,
    ),
  };
}

/**
 * Grava a turma e substitui seus dias, tudo numa transação: se qualquer parte
 * falhar, nada fica gravado. Não valida nada (o banco é a última barreira);
 * quem valida é `salvarTurma`.
 */
export async function gravarTurmaComDias(
  db: Banco,
  dados: TurmaPronta,
): Promise<Resultado<{ id: string }>> {
  const { id, dias, ...valores } = dados;
  return db.transaction(async (tx) => {
    let turmaId: string;
    if (id) {
      const [linha] = await tx
        .update(turmas)
        .set(valores)
        .where(eq(turmas.id, id))
        .returning({ id: turmas.id });
      if (!linha) return { ok: false, erros: { _: "Turma não encontrada." } };
      turmaId = linha.id;
      await tx.delete(turmaDias).where(eq(turmaDias.turmaId, turmaId));
    } else {
      const [linha] = await tx
        .insert(turmas)
        .values(valores)
        .returning({ id: turmas.id });
      turmaId = linha.id;
    }
    await tx
      .insert(turmaDias)
      .values(dias.map((diaSemana) => ({ turmaId, diaSemana })));
    return { ok: true, valor: { id: turmaId } };
  });
}

/**
 * Cria ou atualiza (se vier `id`) uma turma e substitui os dias. Ritmo, módulo
 * e professor precisam estar ativos; numa edição, os que a turma já tem são
 * aceitos mesmo desativados.
 */
export async function salvarTurma(
  db: Banco,
  dados: DadosTurma,
): Promise<Resultado<{ id: string }>> {
  const analise = esquema.safeParse(dados);
  const erros = analise.success ? {} : errosDeZod(analise.error);
  // `dias.0`, `dias.1`... (item inválido) viram um erro só, no campo `dias`.
  for (const chave of Object.keys(erros)) {
    if (chave.startsWith("dias.")) {
      erros.dias ??= erros[chave];
      delete erros[chave];
    }
  }

  const opcoes = await opcoesDeTurma(db, dados.id || undefined);
  const exigirAtivo = (
    campo: "ritmoId" | "moduloId" | "professorId",
    lista: { id: string }[],
    mensagem: string,
  ) => {
    if (!lista.some((item) => item.id === dados[campo]))
      erros[campo] = mensagem;
  };
  exigirAtivo("ritmoId", opcoes.ritmos, "Escolha um ritmo ativo.");
  exigirAtivo("moduloId", opcoes.modulos, "Escolha um módulo ativo.");
  exigirAtivo("professorId", opcoes.professores, "Escolha um professor ativo.");

  const link = dados.linkGrupoWhatsapp?.trim() || null;
  if (link && !linkGrupoWhatsappValido(link)) {
    erros.linkGrupoWhatsapp =
      "Cole o link de convite do grupo (https://chat.whatsapp.com/...).";
  }
  // Compara os horários mesmo que outro campo tenha erro, para mostrar tudo de uma vez.
  const inicio = horarioSchema.safeParse(dados.horarioInicio);
  const fim = horarioSchema.safeParse(dados.horarioFim);
  if (inicio.success && fim.success && fim.data <= inicio.data) {
    erros.horarioFim = "O fim precisa ser depois do início.";
  }
  if (!analise.success || Object.keys(erros).length > 0) {
    return { ok: false, erros };
  }

  const { id, dias, ...resto } = analise.data;
  return executarTraduzindo(
    () =>
      gravarTurmaComDias(db, {
        ...resto,
        id: id || undefined,
        dias: [...new Set(dias)].sort((a, b) => a - b),
        linkGrupoWhatsapp: link,
      }),
    {},
  );
}

/** Exclui a turma (os dias vão junto). Com matrícula, o banco recusa e voltamos "Está em uso…". */
export async function excluirTurma(
  db: Banco,
  id: string,
): Promise<Resultado<null>> {
  return executarTraduzindo(async () => {
    await db.delete(turmas).where(eq(turmas.id, id));
    return { ok: true, valor: null };
  }, {});
}
