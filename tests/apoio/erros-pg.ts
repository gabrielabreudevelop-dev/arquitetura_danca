import { expect } from "vitest";

/** Extrai o SQLSTATE de um erro do pg, mesmo embrulhado pelo Drizzle (`cause`). */
function codigoPg(erro: unknown): string | undefined {
  let atual: unknown = erro;
  for (let i = 0; i < 5 && atual && typeof atual === "object"; i++) {
    const { code, cause } = atual as { code?: unknown; cause?: unknown };
    if (typeof code === "string") return code;
    atual = cause;
  }
  return undefined;
}

/** Espera que a promessa rejeite com o SQLSTATE dado (23505 unique, 23514 check, 23503 FK). */
export async function esperarErroPg(
  promessa: PromiseLike<unknown>,
  codigo: string,
): Promise<void> {
  let erro: unknown;
  try {
    await promessa;
  } catch (e) {
    erro = e;
  }
  expect(
    erro,
    "esperava um erro do Postgres, mas a operação passou",
  ).toBeDefined();
  expect(codigoPg(erro)).toBe(codigo);
}
