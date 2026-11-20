import { afterEach, beforeEach, expect, it } from "vitest";
import { verificarRestauracao } from "../../scripts/verificar-restauracao";
import { criarBancoDeTeste } from "../apoio/banco";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
// Um banco novo por teste: alguns casos estragam o banco de propósito.
beforeEach(async () => {
  banco = await criarBancoDeTeste();
});
afterEach(async () => {
  await banco.encerrar();
});

it("aprova um banco migrado do zero", async () => {
  expect(await verificarRestauracao(banco.url)).toEqual({
    ok: true,
    problemas: [],
  });
});

it("não altera o banco verificado", async () => {
  await verificarRestauracao(banco.url);
  const tipos = await banco.sql(
    "select count(*)::int as n from tipos_consentimento",
  );
  expect((tipos[0] as { n: number }).n).toBe(6);
  const gatilhos = await banco.sql(
    "select count(*)::int as n from pg_trigger where not tgisinternal",
  );
  expect((gatilhos[0] as { n: number }).n).toBe(5);
});

it("aponta gatilho de imutabilidade ausente", async () => {
  await banco.sql(
    "drop trigger registros_consentimento_sem_truncate on registros_consentimento",
  );
  const resultado = await verificarRestauracao(banco.url);
  expect(resultado.ok).toBe(false);
  expect(resultado.problemas).toHaveLength(1);
  expect(resultado.problemas[0]).toContain("gatilho");
  expect(resultado.problemas[0]).toContain(
    "registros_consentimento_sem_truncate",
  );
});

it("aponta gatilho de imutabilidade desativado", async () => {
  await banco.sql(
    "alter table textos_consentimento disable trigger textos_consentimento_imutavel",
  );
  const resultado = await verificarRestauracao(banco.url);
  expect(resultado.ok).toBe(false);
  expect(resultado.problemas.join("\n")).toContain(
    "textos_consentimento_imutavel",
  );
});

it("aponta tipo de consentimento ausente", async () => {
  await banco.sql(
    "delete from tipos_consentimento where chave = 'lista_quem_vai'",
  );
  const resultado = await verificarRestauracao(banco.url);
  expect(resultado.ok).toBe(false);
  expect(resultado.problemas.join("\n")).toContain("lista_quem_vai");
});

it("aponta histórico de migrações que não bate com a pasta drizzle", async () => {
  await banco.sql(
    "delete from drizzle.__drizzle_migrations where id = (select max(id) from drizzle.__drizzle_migrations)",
  );
  const resultado = await verificarRestauracao(banco.url);
  expect(resultado.ok).toBe(false);
  expect(resultado.problemas.join("\n")).toContain("migraç");
});

it("aponta banco sem o histórico de migrações", async () => {
  await banco.sql("drop schema drizzle cascade");
  const resultado = await verificarRestauracao(banco.url);
  expect(resultado.ok).toBe(false);
  expect(resultado.problemas.join("\n")).toContain("migraç");
});
