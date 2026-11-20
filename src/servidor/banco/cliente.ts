import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { ambiente } from "../ambiente";
import * as esquema from "./esquema";

export type Banco = NodePgDatabase<typeof esquema>;

/** Abre um pool de conexões e devolve o Drizzle junto de `encerrar()`. */
export function criarBanco(url: string): {
  db: Banco;
  encerrar(): Promise<void>;
} {
  const pool = new Pool({ connectionString: url });
  // Sem um ouvinte, o erro de uma conexão ociosa derruba o processo.
  pool.on("error", () => {
    console.error("Erro em conexão ociosa com o banco de dados.");
  });
  const db = drizzle(pool, { schema: esquema });
  return { db, encerrar: () => pool.end() };
}

type Compartilhado = ReturnType<typeof criarBanco>;

// Guardado em globalThis para sobreviver ao hot reload em desenvolvimento.
const globalComBanco = globalThis as typeof globalThis & {
  __bancoCompartilhado?: Compartilhado;
};

/** Conexão única e duradoura usada pelas rotas, criada no primeiro uso. */
export function obterBanco(): Banco {
  globalComBanco.__bancoCompartilhado ??= criarBanco(ambiente.DATABASE_URL);
  return globalComBanco.__bancoCompartilhado.db;
}

/** Encerra a conexão compartilhada, se existir (usado em testes). */
export async function encerrarBancoCompartilhado(): Promise<void> {
  const compartilhado = globalComBanco.__bancoCompartilhado;
  globalComBanco.__bancoCompartilhado = undefined;
  await compartilhado?.encerrar();
}
