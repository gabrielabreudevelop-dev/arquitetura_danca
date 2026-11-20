import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Banco } from "../banco/cliente";
import { pessoaPapeis, pessoas, turmas } from "../banco/esquema";
import { normalizarEmail, normalizarWhatsapp } from "../pessoas/normalizar";
import { executarTraduzindo } from "./comum";
import { errosDeZod, MENSAGEM_EM_USO, type Resultado } from "./resultado";

const ERROS_BANCO = {
  pessoas_email_unico: {
    campo: "email",
    mensagem: "Já existe uma pessoa com esse e-mail.",
  },
};

const MENSAGEM_WHATSAPP = "WhatsApp inválido. Use DDD e número.";

export type ValorCadastro =
  | { tipo: "criado"; pessoaId: string }
  | {
      tipo: "pessoa-existente";
      pessoaId: string;
      nome: string;
      jaProfessor: boolean;
    };

export type DadosProfessor = {
  nome: string;
  email?: string;
  whatsapp?: string;
};

type DadosLimpos = {
  nome: string;
  email: string | null;
  whatsapp: string | null;
};

const esquema = z.object({
  nome: z.string().trim().min(1, "Informe o nome."),
  email: z.string().optional(),
  whatsapp: z.string().optional(),
});

/** Valida e normaliza nome, e-mail e WhatsApp. Vazio vira `null`. */
function limpar(dados: DadosProfessor): Resultado<DadosLimpos> {
  const analise = esquema.safeParse(dados);
  const erros = analise.success ? {} : errosDeZod(analise.error);
  const email = dados.email?.trim() ? normalizarEmail(dados.email) : null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    erros.email = "Informe um e-mail válido.";
  }
  let whatsapp: string | null = null;
  if (dados.whatsapp?.trim()) {
    try {
      whatsapp = normalizarWhatsapp(dados.whatsapp);
    } catch {
      erros.whatsapp = MENSAGEM_WHATSAPP;
    }
  }
  if (Object.keys(erros).length > 0 || !analise.success) {
    return { ok: false, erros };
  }
  return { ok: true, valor: { nome: analise.data.nome, email, whatsapp } };
}

/** Pessoas com o papel `professor`, por nome. `somenteAtivos` esconde os desativados. */
export async function listarProfessores(
  db: Banco,
  opcoes: { somenteAtivos?: boolean } = {},
) {
  return db
    .select({
      pessoaId: pessoas.id,
      nome: pessoas.nome,
      email: pessoas.email,
      whatsapp: pessoas.whatsapp,
      ativo: pessoaPapeis.ativo,
    })
    .from(pessoaPapeis)
    .innerJoin(pessoas, eq(pessoas.id, pessoaPapeis.pessoaId))
    .where(
      and(
        eq(pessoaPapeis.papel, "professor"),
        opcoes.somenteAtivos ? eq(pessoaPapeis.ativo, true) : undefined,
      ),
    )
    .orderBy(asc(pessoas.nome), asc(pessoas.id));
}

/**
 * Cadastra uma pessoa nova como professor(a). Se o e-mail já pertence a alguém,
 * não cria nada: devolve `pessoa-existente` para a tela perguntar se quer
 * tornar essa pessoa professor(a).
 */
export async function cadastrarProfessor(
  db: Banco,
  dados: DadosProfessor,
): Promise<Resultado<ValorCadastro>> {
  const limpo = limpar(dados);
  if (!limpo.ok) return limpo;
  const { nome, email, whatsapp } = limpo.valor;
  return executarTraduzindo<ValorCadastro>(async () => {
    if (email) {
      const [existente] = await db
        .select({ id: pessoas.id, nome: pessoas.nome })
        .from(pessoas)
        .where(sql`lower(${pessoas.email}) = ${email}`);
      if (existente) {
        const [papel] = await db
          .select({ pessoaId: pessoaPapeis.pessoaId })
          .from(pessoaPapeis)
          .where(
            and(
              eq(pessoaPapeis.pessoaId, existente.id),
              eq(pessoaPapeis.papel, "professor"),
            ),
          );
        return {
          ok: true,
          valor: {
            tipo: "pessoa-existente",
            pessoaId: existente.id,
            nome: existente.nome,
            jaProfessor: Boolean(papel),
          },
        };
      }
    }
    const pessoaId = await db.transaction(async (tx) => {
      const [pessoa] = await tx
        .insert(pessoas)
        .values({ nome, email, whatsapp })
        .returning({ id: pessoas.id });
      await tx
        .insert(pessoaPapeis)
        .values({ pessoaId: pessoa.id, papel: "professor", ativo: true });
      return pessoa.id;
    });
    return { ok: true, valor: { tipo: "criado", pessoaId } };
  }, ERROS_BANCO);
}

/** Dá (ou reativa) o papel `professor` a uma pessoa que já existe. */
export async function tornarProfessor(
  db: Banco,
  pessoaId: string,
): Promise<Resultado<null>> {
  const [pessoa] = await db
    .select({ id: pessoas.id })
    .from(pessoas)
    .where(eq(pessoas.id, pessoaId));
  if (!pessoa) return { ok: false, erros: { _: "Pessoa não encontrada." } };
  await db
    .insert(pessoaPapeis)
    .values({ pessoaId, papel: "professor", ativo: true })
    .onConflictDoUpdate({
      target: [pessoaPapeis.pessoaId, pessoaPapeis.papel],
      set: { ativo: true },
    });
  return { ok: true, valor: null };
}

/** Atualiza os dados da pessoa e liga/desliga só o papel `professor`. */
export async function atualizarProfessor(
  db: Banco,
  pessoaId: string,
  dados: DadosProfessor & { ativo: boolean },
): Promise<Resultado<null>> {
  const limpo = limpar(dados);
  if (!limpo.ok) return limpo;
  const { nome, email, whatsapp } = limpo.valor;
  return executarTraduzindo(async () => {
    return db.transaction(async (tx) => {
      // Primeiro o papel: sem ele, a pessoa não é professor e nada é alterado.
      const papeis = await tx
        .update(pessoaPapeis)
        .set({ ativo: dados.ativo })
        .where(
          and(
            eq(pessoaPapeis.pessoaId, pessoaId),
            eq(pessoaPapeis.papel, "professor"),
          ),
        )
        .returning({ pessoaId: pessoaPapeis.pessoaId });
      if (papeis.length === 0) {
        return { ok: false, erros: { _: "Professor não encontrado." } };
      }
      await tx
        .update(pessoas)
        .set({ nome, email, whatsapp, atualizadoEm: new Date() })
        .where(eq(pessoas.id, pessoaId));
      return { ok: true, valor: null };
    });
  }, ERROS_BANCO);
}

/**
 * Remove o papel `professor`. Com turma ligada, recusa. Se a pessoa ficar sem
 * nenhum papel e sem login, apaga a pessoa também.
 */
export async function excluirProfessor(
  db: Banco,
  pessoaId: string,
): Promise<Resultado<null>> {
  return executarTraduzindo(
    () =>
      db.transaction(async (tx) => {
        const [turma] = await tx
          .select({ id: turmas.id })
          .from(turmas)
          .where(eq(turmas.professorId, pessoaId))
          .limit(1);
        if (turma) return { ok: false, erros: { _: MENSAGEM_EM_USO } };
        const removidos = await tx
          .delete(pessoaPapeis)
          .where(
            and(
              eq(pessoaPapeis.pessoaId, pessoaId),
              eq(pessoaPapeis.papel, "professor"),
            ),
          )
          .returning({ pessoaId: pessoaPapeis.pessoaId });
        if (removidos.length === 0) {
          return { ok: false, erros: { _: "Professor não encontrado." } };
        }
        const [outro] = await tx
          .select({ papel: pessoaPapeis.papel })
          .from(pessoaPapeis)
          .where(eq(pessoaPapeis.pessoaId, pessoaId))
          .limit(1);
        if (!outro) {
          // Pessoa com login (usuarioId) nunca é apagada.
          await tx
            .delete(pessoas)
            .where(
              and(eq(pessoas.id, pessoaId), sql`${pessoas.usuarioId} is null`),
            );
        }
        return { ok: true, valor: null };
      }),
    {},
  );
}
