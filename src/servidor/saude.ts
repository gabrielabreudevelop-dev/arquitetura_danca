import { sql } from "drizzle-orm";
import { obterBanco } from "./banco/cliente";

const LIMITE_MS = 2000;

export type ResultadoSaude = {
  http: 200 | 503;
  corpo: { status: "ok" | "erro"; banco: "ok" | "indisponivel" };
};

/**
 * Executa a verificação do banco com limite de 2 s. Qualquer falha ou
 * demora vira 503, sem expor detalhes do erro.
 */
export async function verificarSaude(
  checarBanco: () => Promise<void>,
): Promise<ResultadoSaude> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      checarBanco(),
      new Promise<never>((_, rejeitar) => {
        temporizador = setTimeout(
          () => rejeitar(new Error("tempo esgotado")),
          LIMITE_MS,
        );
      }),
    ]);
    return { http: 200, corpo: { status: "ok", banco: "ok" } };
  } catch {
    return { http: 503, corpo: { status: "erro", banco: "indisponivel" } };
  } finally {
    clearTimeout(temporizador);
  }
}

/** Verificação real: `select 1` na conexão compartilhada. */
export async function checarBancoCompartilhado(): Promise<void> {
  // Se as variáveis de ambiente faltarem, obterBanco lança e conta como falha.
  await obterBanco().execute(sql`select 1`);
}
