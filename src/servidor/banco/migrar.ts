import { migrate } from "drizzle-orm/node-postgres/migrator";
import { criarBanco } from "./cliente";

/**
 * Aplica as migrações pendentes da pasta `drizzle/` (relativa ao diretório de
 * trabalho). Rodar de novo sem migrações novas não altera nada.
 */
export async function migrar(
  url: string,
  pastaMigracoes = "drizzle",
): Promise<void> {
  const { db, encerrar } = criarBanco(url);
  try {
    await migrate(db, { migrationsFolder: pastaMigracoes });
  } finally {
    await encerrar();
  }
}
