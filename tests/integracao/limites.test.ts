/**
 * R15: limites de quantidade e de datas, no serviço (mensagem ao lado do
 * campo) e no banco (CHECK), para nada estourar o calendário nem o int4.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cadastrarAluno } from "@/servidor/alunos/cadastro";
import { confirmarLote, previaLote } from "@/servidor/alunos/lotes";
import { matricular } from "@/servidor/alunos/matriculas";
import { estender, registrarPeriodo } from "@/servidor/alunos/periodos";
import { destrancar, trancar } from "@/servidor/alunos/trancamentos";
import { transferir } from "@/servidor/alunos/transferencias";
import { criarBancoDeTeste } from "../apoio/banco";
import { esperarErroPg } from "../apoio/erros-pg";
import {
  criarAdministracao,
  criarAluno,
  criarMatricula,
  criarPeriodo,
  criarPlano,
  criarTurma,
} from "../apoio/fabricas";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
let adm: Awaited<ReturnType<typeof criarAdministracao>>;
let plano: Awaited<ReturnType<typeof criarPlano>>;

const HOJE = "2026-11-25";
const MAX_DIAS = "Informe no máximo 3650 dias.";
const MAX_AULAS = "Informe no máximo 520 aulas.";
const DATA = "Informe uma data válida.";

beforeAll(async () => {
  banco = await criarBancoDeTeste();
  adm = await criarAdministracao(banco.db);
  plano = await criarPlano(banco.db);
});
afterAll(async () => {
  await banco.encerrar();
});

async function alunoVigente(turmaId?: string) {
  const aluno = await criarAluno(banco.db);
  await criarPeriodo(banco.db, {
    alunoId: aluno.id,
    inicio: "2026-11-01",
    fim: "2026-12-31",
    criadoPor: adm.id,
    planoId: plano.id,
  });
  if (turmaId) {
    await criarMatricula(banco.db, {
      alunoId: aluno.id,
      turmaId,
      entrada: "2026-11-01",
      criadoPor: adm.id,
    });
  }
  return aluno;
}

describe("quantidade por lançamento: até 3650 dias ou 520 aulas", () => {
  it("estender", async () => {
    const turma = await criarTurma(banco.db, { dias: [5] });
    const aluno = await alunoVigente(turma.id);
    const ext = (quantidade: string | number, unidade = "dias") =>
      estender(
        banco.db,
        {
          alunoId: aluno.id,
          quantidade,
          unidade,
          motivo: "X",
          feitoPor: adm.id,
        },
        HOJE,
      );
    for (const q of [3651, "3000000", "3000000000", "99999999999999999999"]) {
      expect(await ext(q)).toEqual({
        ok: false,
        erros: { quantidade: MAX_DIAS },
      });
    }
    expect(await ext(521, "aulas")).toEqual({
      ok: false,
      erros: { quantidade: MAX_AULAS },
    });
    expect((await ext(3650)).ok).toBe(true);
    expect((await ext(520, "aulas")).ok).toBe(true);
  });

  it("transferir", async () => {
    const de = await alunoVigente();
    const para = await criarAluno(banco.db);
    const mover = (quantidade: string | number, unidade = "dias") =>
      transferir(
        banco.db,
        {
          deAlunoId: de.id,
          paraAlunoId: para.id,
          quantidade,
          unidade,
          motivo: "X",
          feitoPor: adm.id,
        },
        HOJE,
      );
    expect(await mover("3000000000")).toEqual({
      ok: false,
      erros: { quantidade: MAX_DIAS },
    });
    expect(await mover(521, "aulas")).toEqual({
      ok: false,
      erros: { quantidade: MAX_AULAS },
    });
  });

  it("lote: prévia e confirmação", async () => {
    const turma = await criarTurma(banco.db);
    await alunoVigente(turma.id);
    const escopo = { tipo: "turmas" as const, turmaIds: [turma.id] };
    expect(
      await previaLote(
        banco.db,
        { escopo, quantidade: "2000000000", unidade: "dias" },
        HOJE,
      ),
    ).toEqual({ ok: false, erros: { quantidade: MAX_DIAS } });
    expect(
      await previaLote(
        banco.db,
        { escopo, quantidade: 521, unidade: "aulas" },
        HOJE,
      ),
    ).toEqual({ ok: false, erros: { quantidade: MAX_AULAS } });
    expect(
      await confirmarLote(
        banco.db,
        {
          escopo,
          quantidade: 3651,
          unidade: "dias",
          motivo: "X",
          feitoPor: adm.id,
        },
        HOJE,
      ),
    ).toEqual({ ok: false, erros: { quantidade: MAX_DIAS } });
  });
});

describe("trancamento: volta até 3650 dias depois do início", () => {
  it("trancar e destrancar", async () => {
    const aluno = await alunoVigente();
    const r = await trancar(
      banco.db,
      {
        alunoId: aluno.id,
        inicio: "2026-11-25",
        volta: "2036-11-23",
        feitoPor: adm.id,
      },
      HOJE,
    );
    expect(r).toEqual({
      ok: false,
      erros: { volta: "A volta precisa ser até 3650 dias depois do início." },
    });
    const aberto = await trancar(
      banco.db,
      { alunoId: aluno.id, inicio: "2026-11-25", feitoPor: adm.id },
      HOJE,
    );
    if (!aberto.ok) throw new Error(JSON.stringify(aberto.erros));
    expect(
      await destrancar(banco.db, {
        trancamentoId: aberto.valor.trancamentoId,
        volta: "2036-11-23",
        feitoPor: adm.id,
      }),
    ).toEqual({
      ok: false,
      erros: { volta: "A volta precisa ser até 3650 dias depois do início." },
    });
    expect(
      (
        await destrancar(banco.db, {
          trancamentoId: aberto.valor.trancamentoId,
          volta: "2036-11-22",
          feitoPor: adm.id,
        })
      ).ok,
    ).toBe(true);
  });
});

describe("datas entre 1900-01-01 e 2100-12-31", () => {
  it("período", async () => {
    const aluno = await criarAluno(banco.db);
    expect(
      await registrarPeriodo(banco.db, {
        alunoId: aluno.id,
        planoId: plano.id,
        inicio: "2026-11-25",
        fim: "9999-12-31",
        feitoPor: adm.id,
      }),
    ).toEqual({ ok: false, erros: { fim: DATA } });
  });

  it("matrícula", async () => {
    const aluno = await criarAluno(banco.db);
    const turma = await criarTurma(banco.db);
    expect(
      await matricular(banco.db, {
        alunoId: aluno.id,
        turmaId: turma.id,
        entrada: "2101-01-01",
        feitoPor: adm.id,
      }),
    ).toEqual({ ok: false, erros: { entrada: DATA } });
  });

  it("trancamento", async () => {
    const aluno = await alunoVigente();
    expect(
      await trancar(
        banco.db,
        { alunoId: aluno.id, inicio: "1899-12-31", feitoPor: adm.id },
        HOJE,
      ),
    ).toEqual({ ok: false, erros: { inicio: DATA } });
  });

  it("nascimento", async () => {
    const r = await cadastrarAluno(
      banco.db,
      {
        nome: "Ana Antiga",
        nascimento: "1800-01-01",
        whatsapp: "27999990000",
        turmaIds: [],
      },
      adm.id,
      HOJE,
    );
    expect(r.ok).toBe(false);
    // Mesma mensagem já usada para nascimento inválido.
    if (!r.ok) {
      expect(r.erros.nascimento).toBe("Informe a data de nascimento.");
    }
  });
});

describe("CHECK no banco", () => {
  it("ajustes_periodo recusa |dias| > 36500 e transferencias recusa dias > 36500", async () => {
    const aluno = await alunoVigente();
    const [p] = (await banco.sql(
      `select id from periodos_contratados where aluno_id = '${aluno.id}'`,
    )) as { id: string }[];
    const ajuste = (dias: number) =>
      banco.sql(
        `insert into ajustes_periodo (periodo_id, tipo, dias, quantidade_digitada, unidade_digitada, motivo, criado_por)
         values ('${p.id}', 'extensao', ${dias}, 1, 'dias', 'X', '${adm.id}')`,
      );
    await esperarErroPg(ajuste(36501), "23514");
    await ajuste(36500);
    const transf = (dias: number) =>
      banco.sql(
        `insert into transferencias (periodo_origem_id, periodo_destino_id, dias, motivo, criado_por)
         values ('${p.id}', '${p.id}', ${dias}, 'X', '${adm.id}')`,
      );
    await esperarErroPg(transf(36501), "23514");
  });
});
