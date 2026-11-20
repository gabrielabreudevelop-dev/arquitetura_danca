import { z } from "zod";
import { type Resultado, traduzirErroBanco } from "./resultado";

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
 * formulário; qualquer outro é relançado.
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
    throw erro;
  }
}
