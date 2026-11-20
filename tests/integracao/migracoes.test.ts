import { afterAll, beforeAll, expect, it } from "vitest";
import { migrar } from "@/servidor/banco/migrar";
import { criarBancoDeTeste } from "../apoio/banco";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
beforeAll(async () => {
  banco = await criarBancoDeTeste();
});
afterAll(async () => {
  await banco.encerrar();
});

it("aplica as migrações do zero num banco vazio", async () => {
  const linhas = await banco.sql(
    "select count(*)::int as n from drizzle.__drizzle_migrations",
  );
  expect((linhas[0] as { n: number }).n).toBeGreaterThan(0);
});

it("rodar as migrações de novo não falha nem muda nada", async () => {
  const antes = await banco.sql(
    "select count(*)::int as n from drizzle.__drizzle_migrations",
  );
  await migrar(banco.url);
  const depois = await banco.sql(
    "select count(*)::int as n from drizzle.__drizzle_migrations",
  );
  expect(depois).toEqual(antes);
});
