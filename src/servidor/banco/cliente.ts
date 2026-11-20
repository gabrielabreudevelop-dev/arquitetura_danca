import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as esquema from "./esquema";

export type Banco = NodePgDatabase<typeof esquema>;

/** Abre um pool de conexões e devolve o Drizzle junto de `encerrar()`. */
export function criarBanco(url: string): {
  db: Banco;
  encerrar(): Promise<void>;
} {
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema: esquema });
  return { db, encerrar: () => pool.end() };
}
