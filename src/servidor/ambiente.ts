import { z } from "zod";

const esquema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  // IPs/CIDRs separados por vírgula; vazio ou ausente = nenhum.
  PROXIES_CONFIAVEIS: z
    .string()
    .optional()
    .transform((texto, ctx) => {
      if (texto === undefined || texto.trim() === "") return undefined;
      const itens = texto.split(",").map((item) => item.trim());
      if (itens.some((item) => item === "")) {
        ctx.addIssue({ code: "custom", message: "entrada vazia na lista" });
        return z.NEVER;
      }
      return itens;
    }),
});

export type Ambiente = z.infer<typeof esquema>;

/**
 * Valida as variáveis de ambiente. A mensagem de erro lista apenas os
 * nomes das variáveis inválidas, nunca os valores.
 */
export function lerAmbiente(
  fonte: Record<string, string | undefined>,
): Ambiente {
  const resultado = esquema.safeParse(fonte);
  if (!resultado.success) {
    const nomes = [
      ...new Set(
        resultado.error.issues.map((problema) => String(problema.path[0])),
      ),
    ];
    throw new Error(
      `Variáveis de ambiente inválidas ou ausentes: ${nomes.join(", ")}`,
    );
  }
  return resultado.data;
}

let cache: Ambiente | undefined;

function carregar(): Ambiente {
  cache ??= lerAmbiente(process.env);
  return cache;
}

/**
 * Ambiente lido de `process.env` somente no primeiro acesso a uma
 * propriedade, para que `next build` funcione sem variáveis definidas.
 */
export const ambiente: Ambiente = {
  get DATABASE_URL() {
    return carregar().DATABASE_URL;
  },
  get BETTER_AUTH_SECRET() {
    return carregar().BETTER_AUTH_SECRET;
  },
  get BETTER_AUTH_URL() {
    return carregar().BETTER_AUTH_URL;
  },
  get PROXIES_CONFIAVEIS() {
    return carregar().PROXIES_CONFIAVEIS;
  },
};
