import { eq, sql } from "drizzle-orm";
import { criarAuth } from "../auth/auth";
import type { Banco } from "../banco/cliente";
import { pessoaPapeis, pessoas } from "../banco/esquema";
import { normalizarEmail } from "../pessoas/normalizar";

export type DadosMembroEquipe = {
  nome: string;
  email: string;
  senha: string;
  papel: "administracao" | "atendente";
};

/**
 * Cria a conta de login (usuário + conta `credential`), a pessoa ligada a ela
 * e o papel, tudo numa transação: se algo falha, nada fica gravado.
 */
export async function criarMembroEquipe(
  db: Banco,
  dados: DadosMembroEquipe,
  opcoesAuth?: { secret?: string; baseURL?: string },
): Promise<{ pessoaId: string; usuarioId: string }> {
  const email = normalizarEmail(dados.email);
  const nome = dados.nome.trim();
  if (!nome) throw new Error("Informe o nome.");
  if (!email) throw new Error("Informe o e-mail.");

  const existente = await db
    .select({ id: pessoas.id })
    .from(pessoas)
    .where(eq(sql`lower(${pessoas.email})`, email));
  if (existente.length > 0) {
    throw new Error("Já existe uma pessoa com este e-mail.");
  }

  return db.transaction(async (tx) => {
    // O Better Auth grava pelo mesmo `tx`, então tudo entra na mesma transação.
    const auth = criarAuth(tx as unknown as Banco, opcoesAuth);
    const ctx = await auth.$context;

    const minimo = ctx.password.config.minPasswordLength;
    if (dados.senha.length < minimo) {
      throw new Error(`A senha precisa ter pelo menos ${minimo} caracteres.`);
    }

    const usuario = await ctx.internalAdapter.createUser(
      { name: nome, email },
      { method: "email-password" },
    );
    await ctx.internalAdapter.linkAccount({
      userId: usuario.id,
      providerId: "credential",
      accountId: usuario.id,
      password: await ctx.password.hash(dados.senha),
    });

    const [pessoa] = await tx
      .insert(pessoas)
      .values({ nome, email, usuarioId: usuario.id })
      .returning({ id: pessoas.id });
    await tx
      .insert(pessoaPapeis)
      .values({ pessoaId: pessoa.id, papel: dados.papel });

    return { pessoaId: pessoa.id, usuarioId: usuario.id };
  });
}
