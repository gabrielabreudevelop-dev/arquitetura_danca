import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/servidor/banco/esquema/index.ts",
  out: "./drizzle",
});
