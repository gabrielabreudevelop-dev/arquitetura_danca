import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { type Banco, obterBanco } from "../banco/cliente";
import { type Papel, pessoaPapeis, pessoas } from "../banco/esquema";
import { obterAuth } from "./auth";

type SessaoDePessoa = { pessoaId: string; papeis: Papel[] };

/** Decide o que fazer com uma visita a uma área restrita a certos papéis. */
export function decidirAcesso(
  sessao: SessaoDePessoa | null,
  permitidos: readonly Papel[],
): "permitir" | "entrar" | "sem-acesso" {
  if (!sessao) return "entrar";
  return sessao.papeis.some((p) => permitidos.includes(p))
    ? "permitir"
    : "sem-acesso";
}

/** Papéis ativos de uma pessoa (papéis com `ativo = false` não contam). */
export async function papeisAtivos(
  db: Banco,
  pessoaId: string,
): Promise<Papel[]> {
  const linhas = await db
    .select({ papel: pessoaPapeis.papel })
    .from(pessoaPapeis)
    .where(
      and(eq(pessoaPapeis.pessoaId, pessoaId), eq(pessoaPapeis.ativo, true)),
    );
  return linhas.map((l) => l.papel);
}

/**
 * Exige uma sessão cuja pessoa tenha ao menos um dos papéis. Sem sessão (ou
 * sem pessoa ligada ao usuário) vai para `/entrar`; sem o papel, para
 * `/sem-acesso`.
 */
export async function exigirPapel(
  permitidos: readonly Papel[],
): Promise<{ pessoaId: string; nome: string; papeis: Papel[] }> {
  const sessao = await obterAuth().api.getSession({ headers: await headers() });
  const db = obterBanco();

  let pessoa: { id: string; nome: string } | undefined;
  let papeis: Papel[] = [];
  if (sessao) {
    [pessoa] = await db
      .select({ id: pessoas.id, nome: pessoas.nome })
      .from(pessoas)
      .where(eq(pessoas.usuarioId, sessao.user.id));
    if (pessoa) papeis = await papeisAtivos(db, pessoa.id);
  }

  const decisao = decidirAcesso(
    pessoa ? { pessoaId: pessoa.id, papeis } : null,
    permitidos,
  );
  if (decisao === "entrar") redirect("/entrar");
  if (decisao === "sem-acesso" || !pessoa) redirect("/sem-acesso");
  return { pessoaId: pessoa.id, nome: pessoa.nome, papeis };
}

/** Exige a administração. Toda server action do painel começa por esta chamada. */
export async function exigirAdministracao(): Promise<{
  pessoaId: string;
  nome: string;
  papeis: Papel[];
}> {
  return exigirPapel(["administracao"]);
}

/**
 * Diz se a visita atual tem sessão de uma pessoa com o papel de administração.
 * Nunca redireciona: serve a rotas que respondem 404 a quem não tem acesso.
 */
export async function sessaoEhAdministracao(): Promise<boolean> {
  const sessao = await obterAuth().api.getSession({ headers: await headers() });
  if (!sessao) return false;
  const db = obterBanco();
  const [pessoa] = await db
    .select({ id: pessoas.id })
    .from(pessoas)
    .where(eq(pessoas.usuarioId, sessao.user.id));
  if (!pessoa) return false;
  return (await papeisAtivos(db, pessoa.id)).includes("administracao");
}
