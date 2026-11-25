import { DrizzleQueryError } from "drizzle-orm";
import { z } from "zod";
import { acharErroPg, type Resultado, traduzirErroBanco } from "./resultado";

/** O que vai ao log e à tela quando o banco falha sem tradução (R16). */
export const MENSAGEM_FALHA_BANCO = "Falha no banco de dados.";

/**
 * Erro do banco não traduzido: a mensagem do Drizzle traz a consulta e os
 * parâmetros ("params: Ana Souza, …") e a do pg pode trazer o `detail` com a
 * linha. Loga só a mensagem fixa e o código do pg, e devolve um erro novo,
 * sem `cause`, para relançar. Qualquer outro erro volta como está.
 */
export function erroSemDadosPessoais(erro: unknown): unknown {
  const pg = acharErroPg(erro);
  if (!(erro instanceof DrizzleQueryError) && !pg) return erro;
  console.error(
    pg?.code
      ? `${MENSAGEM_FALHA_BANCO} Código ${pg.code}.`
      : MENSAGEM_FALHA_BANCO,
  );
  return new Error(MENSAGEM_FALHA_BANCO);
}

/**
 * Campo `ordem` de formulário: aceita número ou texto, ignora espaços nas pontas
 * e trata texto vazio como "não é número". Inteiro de 0 a 9999.
 */
export const ordemSchema = z.preprocess(
  (valor) =>
    typeof valor === "string" && valor.trim() === "" ? Number.NaN : valor,
  z.coerce
    .number({ error: "Informe um número." })
    .int("Informe um número inteiro.")
    .min(0, "Use um número de 0 a 9999.")
    .max(9999, "Use um número de 0 a 9999."),
);

/**
 * Roda uma operação de banco que devolve `Resultado`. Erros do banco conhecidos
 * (pelo nome da constraint em `mapa`, ou chave estrangeira) viram erros de
 * formulário; outro erro do banco é relançado sem dados pessoais
 * (`erroSemDadosPessoais`); erro que não é do banco é relançado como está.
 */
export async function executarTraduzindo<T>(
  operacao: () => Promise<Resultado<T>>,
  mapa: Record<string, { campo: string; mensagem: string }>,
): Promise<Resultado<T>> {
  try {
    return await operacao();
  } catch (erro) {
    const erros = traduzirErroBanco(erro, mapa);
    if (erros) return { ok: false, erros };
    throw erroSemDadosPessoais(erro);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O texto tem o formato de um uuid? Evita mandar lixo ao Postgres (erro 22P02). */
export function ehUuid(valor: string): boolean {
  return UUID.test(valor);
}
