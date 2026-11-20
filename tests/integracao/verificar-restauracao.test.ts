import { spawnSync } from "node:child_process";
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
  const [pessoa] = await banco.sql(
    "insert into pessoas (nome) values ('Titular') returning id",
  );
  const [texto] = await banco.sql(
    `insert into textos_consentimento (tipo_id, versao, texto, vigente_desde)
     select id, 1, 'texto', now() from tipos_consentimento where chave = 'termos_uso'
     returning id, tipo_id`,
  );
  const { id: pessoaId } = pessoa as { id: string };
  const { id: textoId, tipo_id: tipoId } = texto as {
    id: string;
    tipo_id: string;
  };
  await banco.sql(
    `insert into registros_consentimento
       (tipo_id, texto_id, titular_id, concedente_id, acao, canal, origem)
     values ('${tipoId}', '${textoId}', '${pessoaId}', '${pessoaId}', 'aceite', 'plataforma', 'pagina_preferencias')`,
  );
  const contar = async () =>
    banco.sql(
      `select (select count(*)::int from pessoas) as pessoas,
              (select count(*)::int from textos_consentimento) as textos,
              (select count(*)::int from registros_consentimento) as registros,
              (select count(*)::int from tipos_consentimento) as tipos,
              (select string_agg(chave, ',' order by chave) from tipos_consentimento) as chaves,
              (select count(*)::int from pg_trigger where not tgisinternal) as gatilhos`,
    );
  const antes = await contar();

  expect(await verificarRestauracao(banco.url)).toEqual({
    ok: true,
    problemas: [],
  });

  expect(await contar()).toEqual(antes);
  expect(antes).toEqual([
    expect.objectContaining({ pessoas: 1, textos: 1, registros: 1, tipos: 6 }),
  ]);
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

it("aponta gatilho que só dispara em modo de réplica", async () => {
  await banco.sql(
    "alter table registros_consentimento enable replica trigger registros_consentimento_sem_truncate",
  );
  const resultado = await verificarRestauracao(banco.url);
  expect(resultado.ok).toBe(false);
  expect(resultado.problemas.join("\n")).toContain(
    "registros_consentimento_sem_truncate",
  );
});

it("aponta gatilho com o nome certo mas função diferente", async () => {
  await banco.sql(
    `create function nao_bloqueia() returns trigger language plpgsql as $$ begin return null; end $$`,
  );
  await banco.sql(
    "drop trigger registros_consentimento_sem_truncate on registros_consentimento",
  );
  await banco.sql(
    "create trigger registros_consentimento_sem_truncate before truncate on registros_consentimento for each statement execute function nao_bloqueia()",
  );
  const resultado = await verificarRestauracao(banco.url);
  expect(resultado.ok).toBe(false);
  expect(resultado.problemas.join("\n")).toContain("função nao_bloqueia");
});

it("aponta gatilho com o nome certo mas evento diferente", async () => {
  await banco.sql(
    "drop trigger registros_consentimento_imutavel on registros_consentimento",
  );
  await banco.sql(
    "create trigger registros_consentimento_imutavel before update on registros_consentimento for each row execute function bloquear_alteracao()",
  );
  const resultado = await verificarRestauracao(banco.url);
  expect(resultado.ok).toBe(false);
  expect(resultado.problemas.join("\n")).toContain(
    "registros_consentimento_imutavel",
  );
});

it("as sondas de UPDATE e DELETE acusam gatilhos corretos no papel cuja função não bloqueia", async () => {
  // Nome, tipo e função certos; o corpo da função foi esvaziado.
  await banco.sql(
    "create or replace function bloquear_alteracao() returns trigger language plpgsql as $$ begin return NEW; end $$",
  );
  const resultado = await verificarRestauracao(banco.url);
  expect(resultado.ok).toBe(false);
  const texto = resultado.problemas.join("\n");
  expect(texto).toContain("UPDATE em registros_consentimento");
  expect(texto).toContain("DELETE em textos_consentimento");
  expect(texto).toContain("TRUNCATE em registros_consentimento");
  expect(texto).toContain("TRUNCATE em textos_consentimento");
});

it("a CLI imprime um problema por linha e sai com código 1", async () => {
  await banco.sql("delete from tipos_consentimento where chave = 'uso_imagem'");
  await banco.sql(
    "drop trigger textos_consentimento_imutavel on textos_consentimento",
  );
  const resultado = spawnSync(
    "pnpm",
    ["-s", "backup:verificar", "--", banco.url],
    { encoding: "utf8" },
  );
  expect(resultado.status).toBe(1);
  expect(resultado.stdout).toBe("");
  const linhas = resultado.stderr.trim().split("\n");
  expect(linhas).toHaveLength(2);
  expect(linhas.join("\n")).toContain("uso_imagem");
  expect(linhas.join("\n")).toContain("textos_consentimento_imutavel");
});

it("a CLI imprime a linha de sucesso e sai com código 0", async () => {
  const resultado = spawnSync(
    "pnpm",
    ["-s", "backup:verificar", "--", banco.url],
    { encoding: "utf8" },
  );
  expect(resultado.status).toBe(0);
  expect(resultado.stdout.trim()).toBe(
    "Restauração verificada: nenhum problema encontrado.",
  );
});
