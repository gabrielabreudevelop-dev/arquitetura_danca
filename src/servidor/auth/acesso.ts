import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { obterBanco } from "../banco/cliente";
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
    if (pessoa) {
      const linhas = await db
        .select({ papel: pessoaPapeis.papel })
        .from(pessoaPapeis)
        .where(eq(pessoaPapeis.pessoaId, pessoa.id));
      papeis = linhas.map((l) => l.papel);
    }
  }

  const decisao = decidirAcesso(
    pessoa ? { pessoaId: pessoa.id, papeis } : null,
    permitidos,
  );
  if (decisao === "entrar") redirect("/entrar");
  if (decisao === "sem-acesso" || !pessoa) redirect("/sem-acesso");
  return { pessoaId: pessoa.id, nome: pessoa.nome, papeis };
}
