import type { z } from "zod";

/** Resultado de uma operação de cadastro. Em `erros`, a chave `"_"` é o erro geral do formulário. */
export type Resultado<T> =
  | { ok: true; valor: T }
  | { ok: false; erros: Record<string, string> };

/** Erros do Zod como `{ campo: primeiraMensagem }`. Erros sem caminho vão para `"_"`. */
export function errosDeZod(erro: z.ZodError): Record<string, string> {
  const erros: Record<string, string> = {};
  for (const problema of erro.issues) {
    const chave = problema.path.length ? problema.path.join(".") : "_";
    if (!(chave in erros)) erros[chave] = problema.message;
  }
  return erros;
}

/** Mensagem do erro geral quando a exclusão esbarra numa chave estrangeira. */
export const MENSAGEM_EM_USO = "Está em uso; desative em vez de excluir.";

type ErroPg = { code?: string; constraint?: string };

/** Acha o erro do pg, mesmo embrulhado pelo Drizzle (`cause`). */
export function acharErroPg(erro: unknown): ErroPg | null {
  let atual: unknown = erro;
  for (let i = 0; i < 5 && atual && typeof atual === "object"; i++) {
    const { code, constraint, cause } = atual as ErroPg & { cause?: unknown };
    if (typeof code === "string") return { code, constraint };
    atual = cause;
  }
  return null;
}

/**
 * Traduz um erro do banco em erros de formulário, pelo nome da constraint.
 * `23503` (chave estrangeira) sem entrada no mapa vira "Está em uso; desative
 * em vez de excluir." no erro geral. Erro não reconhecido devolve `null`:
 * quem chama relança.
 */
export function traduzirErroBanco(
  erro: unknown,
  mapa: Record<string, { campo: string; mensagem: string }>,
): Record<string, string> | null {
  const pg = acharErroPg(erro);
  if (!pg) return null;
  const entrada = pg.constraint ? mapa[pg.constraint] : undefined;
  if (entrada) return { [entrada.campo]: entrada.mensagem };
  if (pg.code === "23503") return { _: MENSAGEM_EM_USO };
  return null;
}
