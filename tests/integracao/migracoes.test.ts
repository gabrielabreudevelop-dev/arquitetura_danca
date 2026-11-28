import { randomBytes } from "node:crypto";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";
import { criarBanco } from "@/servidor/banco/cliente";
import { migrar } from "@/servidor/banco/migrar";
import { criarBancoDeTeste } from "../apoio/banco";
import { criarAdministracao, criarTurma } from "../apoio/fabricas";

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

it("chamada salva: aulas realizadas existentes ficam com chamada salva; 'não houve' não", async () => {
  // Banco migrado só até 0012, com aulas criadas antes da coluna existir.
  const pasta = mkdtempSync(join(tmpdir(), "migracoes-"));
  cpSync("drizzle", pasta, { recursive: true });
  const caminhoDiario = join(pasta, "meta", "_journal.json");
  const diario = JSON.parse(readFileSync(caminhoDiario, "utf8")) as {
    entries: { idx: number }[];
  };
  diario.entries = diario.entries.filter((e) => e.idx <= 12);
  writeFileSync(caminhoDiario, JSON.stringify(diario));

  const admin = process.env.DATABASE_URL_TESTE_ADMIN as string;
  const nome = `teste_${randomBytes(8).toString("hex")}`;
  const poolAdmin = new Pool({ connectionString: admin });
  await poolAdmin.query(`create database ${nome}`);
  const url = new URL(admin);
  url.pathname = `/${nome}`;
  const pool = new Pool({ connectionString: url.toString() });
  const { db, encerrar } = criarBanco(url.toString());
  try {
    await migrar(url.toString(), pasta);
    const adm = await criarAdministracao(db);
    const outro = await criarAdministracao(db);
    const turma = await criarTurma(db, { dias: [2] });
    const inserir = async (valores: string) =>
      (
        await pool.query(
          `insert into aulas (turma_id, data, situacao, motivo, criado_por, criado_em, alterado_por, alterado_em) values ${valores} returning id`,
        )
      ).rows[0].id as string;
    const criada = await inserir(
      `('${turma.id}', '2026-11-03', 'realizada', null, '${adm.id}', '2026-11-03T22:00:00Z', null, null)`,
    );
    const alterada = await inserir(
      `('${turma.id}', '2026-11-10', 'realizada', null, '${adm.id}', '2026-11-10T22:00:00Z', '${outro.id}', '2026-11-11T10:00:00Z')`,
    );
    const naoHouve = await inserir(
      `('${turma.id}', '2026-11-17', 'nao_houve', 'feriado', '${adm.id}', '2026-11-17T22:00:00Z', null, null)`,
    );

    await migrar(url.toString());
    const linhas = (
      await pool.query(
        "select id, chamada_salva_em, chamada_salva_por from aulas",
      )
    ).rows as {
      id: string;
      chamada_salva_em: Date | null;
      chamada_salva_por: string | null;
    }[];
    const por = new Map(linhas.map((l) => [l.id, l]));
    expect(por.get(criada)).toMatchObject({
      chamada_salva_em: new Date("2026-11-03T22:00:00Z"),
      chamada_salva_por: adm.id,
    });
    expect(por.get(alterada)).toMatchObject({
      chamada_salva_em: new Date("2026-11-11T10:00:00Z"),
      chamada_salva_por: outro.id,
    });
    expect(por.get(naoHouve)).toMatchObject({
      chamada_salva_em: null,
      chamada_salva_por: null,
    });

    // Os dois juntos ou nenhum.
    await expect(
      pool.query(
        `update aulas set chamada_salva_por = null where id = '${criada}'`,
      ),
    ).rejects.toThrow(/aulas_chamada_salva_completa/);
  } finally {
    await pool.end();
    await encerrar();
    await poolAdmin.query(`drop database if exists ${nome} with (force)`);
    await poolAdmin.end();
    rmSync(pasta, { recursive: true, force: true });
  }
});
