import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Carrega .env.test e .env.local (se existirem) em process.env, que os
// processos de teste herdam. Os testes de integração precisam de
// DATABASE_URL_TESTE_ADMIN. Variáveis já definidas no ambiente têm prioridade.
for (const arquivo of [".env.test", ".env.local"]) {
  if (existsSync(arquivo)) process.loadEnvFile(arquivo);
}

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unidade",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integracao",
          include: ["tests/integracao/**/*.test.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
