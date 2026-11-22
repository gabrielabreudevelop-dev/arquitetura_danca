import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encerrarAluno } from "@/servidor/alunos/cadastro";
import {
  anularLote,
  confirmarLote,
  listarLotes,
  previaLote,
} from "@/servidor/alunos/lotes";
import { anularAjuste } from "@/servidor/alunos/periodos";
import { trancar } from "@/servidor/alunos/trancamentos";
import {
  ajustesPeriodo,
  lotesExtensao,
  loteTurmas,
  matriculas,
  periodosContratados,
} from "@/servidor/banco/esquema";
import { criarBancoDeTeste } from "../apoio/banco";
import {
  criarAdministracao,
  criarAluno,
  criarMatricula,
  criarModulo,
  criarPeriodo,
  criarPlano,
  criarRitmo,
  criarTurma,
} from "../apoio/fabricas";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
let adm: Awaited<ReturnType<typeof criarAdministracao>>;
let plano: Awaited<ReturnType<typeof criarPlano>>;

const HOJE = "2026-11-22";

beforeAll(async () => {
  banco = await criarBancoDeTeste();
  adm = await criarAdministracao(banco.db);
  plano = await criarPlano(banco.db);
});
afterAll(async () => {
  await banco.encerrar();
});

async function aluno(
  nome: string,
  turmaIds: string[] = [],
  inicio = "2026-11-01",
  fim = "2026-11-30",
) {
  const a = await criarAluno(banco.db, { nome });
  const periodo = await criarPeriodo(banco.db, {
    alunoId: a.id,
    inicio,
    fim,
    criadoPor: adm.id,
    planoId: plano.id,
  });
  for (const turmaId of turmaIds) {
    await criarMatricula(banco.db, {
      alunoId: a.id,
      turmaId,
      entrada: "2026-11-01",
      criadoPor: adm.id,
    });
  }
  return { ...a, periodo };
}

const sufixo = () => Math.random().toString(36).slice(2, 8);

/** Cenário: turma A (ter e qui), turma B (sex); Ana, Bruno, Carla, Davi, Eva. */
async function cenario() {
  const ritmo = await criarRitmo(banco.db, { nome: `Forró ${sufixo()}` });
  const modulo = await criarModulo(banco.db, { nome: `Iniciante ${sufixo()}` });
  const turmaA = await criarTurma(banco.db, {
    ritmoId: ritmo.id,
    moduloId: modulo.id,
    dias: [2, 4],
  });
  const turmaB = await criarTurma(banco.db, { dias: [5] });
  const ana = await aluno("Ana Souza", [turmaA.id]);
  const bruno = await aluno(
    "Bruno Lima",
    [turmaA.id],
    "2026-09-01",
    "2026-09-30",
  );
  const carla = await aluno("Carla Dias", [turmaA.id]);
  const davi = await aluno("Davi Reis", [turmaA.id]);
  const eva = await aluno("Eva Prado", [turmaA.id, turmaB.id]);
  await trancar(
    banco.db,
    { alunoId: carla.id, inicio: HOJE, feitoPor: adm.id },
    HOJE,
  );
  await encerrarAluno(banco.db, {
    alunoId: davi.id,
    data: HOJE,
    feitoPor: adm.id,
  });
  return { ritmo, modulo, turmaA, turmaB, ana, bruno, carla, davi, eva };
}

const lote = (
  escopo: Parameters<typeof previaLote>[1]["escopo"],
  extra: { quantidade?: string | number; unidade?: string } = {},
) => ({ escopo, quantidade: 1, unidade: "aulas", ...extra });

describe("previaLote", () => {
  it("só vigentes com matrícula aberta; uma linha por aluno, com a conversão maior", async () => {
    const c = await cenario();
    const r = await previaLote(
      banco.db,
      lote({ tipo: "turmas", turmaIds: [c.turmaA.id, c.turmaB.id] }),
      HOJE,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor.linhas).toEqual([
      {
        alunoId: c.ana.id,
        nome: "Ana Souza",
        fimAntes: "2026-11-30",
        fimDepois: "2026-12-04",
        dias: 4,
        turmaConversaoId: c.turmaA.id,
      },
      {
        alunoId: c.eva.id,
        nome: "Eva Prado",
        fimAntes: "2026-11-30",
        fimDepois: "2026-12-07",
        dias: 7,
        turmaConversaoId: c.turmaB.id,
      },
    ]);
  });

  it("ignora quem saiu da turma (matrícula fechada)", async () => {
    const c = await cenario();
    const fora = await aluno("Fábio", [c.turmaA.id]);
    await banco.db
      .update(matriculas)
      .set({ saida: "2026-11-10" })
      .where(eq(matriculas.alunoId, fora.id));
    const r = await previaLote(
      banco.db,
      lote({ tipo: "turmas", turmaIds: [c.turmaA.id] }),
      HOJE,
    );
    expect(r.ok && r.valor.linhas.map((l) => l.nome)).toEqual([
      "Ana Souza",
      "Eva Prado",
    ]);
  });

  it("estúdio todo em aulas é recusado", async () => {
    expect(await previaLote(banco.db, lote({ tipo: "estudio" }), HOJE)).toEqual(
      { ok: false, erros: { unidade: "No estúdio todo, informe em dias." } },
    );
  });

  it("estúdio todo em dias: todos os vigentes, com ou sem matrícula", async () => {
    const c = await cenario();
    const solto = await aluno("Zeca Sem Turma");
    const r = await previaLote(
      banco.db,
      lote({ tipo: "estudio" }, { quantidade: 3, unidade: "dias" }),
      HOJE,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ids = r.valor.linhas.map((l) => l.alunoId);
    expect(ids).toContain(c.ana.id);
    expect(ids).toContain(c.eva.id);
    expect(ids).toContain(solto.id);
    for (const fora of [c.bruno.id, c.carla.id, c.davi.id]) {
      expect(ids).not.toContain(fora);
    }
    const zeca = r.valor.linhas.find((l) => l.alunoId === solto.id);
    expect(zeca).toMatchObject({ dias: 3, turmaConversaoId: null });
  });

  it("valida turmas, quantidade e unidade", async () => {
    expect(
      await previaLote(banco.db, lote({ tipo: "turmas", turmaIds: [] }), HOJE),
    ).toEqual({
      ok: false,
      erros: { turmaIds: "Escolha ao menos uma turma ou o estúdio todo." },
    });
    expect(
      await previaLote(
        banco.db,
        lote({ tipo: "estudio" }, { quantidade: "0", unidade: "x" }),
        HOJE,
      ),
    ).toEqual({
      ok: false,
      erros: {
        quantidade: "Informe um número inteiro maior que zero.",
        unidade: "Escolha dias ou aulas.",
      },
    });
  });

  it("turma inexistente, malformada ou inativa: Escolha turmas ativas.", async () => {
    const inativa = await criarTurma(banco.db, { ativa: false });
    const ativa = await criarTurma(banco.db);
    const esperado = {
      ok: false,
      erros: { turmaIds: "Escolha turmas ativas." },
    };
    for (const ids of [
      [inativa.id],
      [ativa.id, inativa.id],
      ["nao-e-uuid"],
      ["00000000-0000-4000-8000-000000000000"],
    ]) {
      expect(
        await previaLote(
          banco.db,
          lote({ tipo: "turmas", turmaIds: ids }),
          HOJE,
        ),
      ).toEqual(esperado);
    }
  });
});

describe("confirmarLote", () => {
  it("grava lote, turmas e uma extensão por aluno ligada ao lote", async () => {
    const c = await cenario();
    const r = await confirmarLote(
      banco.db,
      {
        ...lote({ tipo: "turmas", turmaIds: [c.turmaA.id, c.turmaB.id] }),
        motivo: "  Feriado 15/11 ",
        feitoPor: adm.id,
      },
      HOJE,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor.alunos).toBe(2);
    const [l] = await banco.db
      .select()
      .from(lotesExtensao)
      .where(eq(lotesExtensao.id, r.valor.loteId));
    expect(l).toMatchObject({
      todoEstudio: false,
      quantidadeDigitada: 1,
      unidadeDigitada: "aulas",
      motivo: "Feriado 15/11",
      criadoPor: adm.id,
      anuladoEm: null,
    });
    const turmasDoLote = await banco.db
      .select()
      .from(loteTurmas)
      .where(eq(loteTurmas.loteId, r.valor.loteId));
    expect(turmasDoLote.map((t) => t.turmaId).sort()).toEqual(
      [c.turmaA.id, c.turmaB.id].sort(),
    );
    const linhas = await banco.db
      .select()
      .from(ajustesPeriodo)
      .where(eq(ajustesPeriodo.loteId, r.valor.loteId));
    expect(linhas).toHaveLength(2);
    const porPeriodo = new Map(linhas.map((x) => [x.periodoId, x]));
    expect(porPeriodo.get(c.ana.periodo.id)).toMatchObject({
      tipo: "extensao",
      dias: 4,
      quantidadeDigitada: 1,
      unidadeDigitada: "aulas",
      turmaConversaoId: c.turmaA.id,
      motivo: "Feriado 15/11",
      criadoPor: adm.id,
    });
    expect(porPeriodo.get(c.eva.periodo.id)).toMatchObject({
      dias: 7,
      turmaConversaoId: c.turmaB.id,
    });
  });

  it("estúdio todo grava todo_estudio sem turmas", async () => {
    await cenario();
    const r = await confirmarLote(
      banco.db,
      {
        ...lote({ tipo: "estudio" }, { quantidade: 3, unidade: "dias" }),
        motivo: "Recesso",
        feitoPor: adm.id,
      },
      HOJE,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [l] = await banco.db
      .select()
      .from(lotesExtensao)
      .where(eq(lotesExtensao.id, r.valor.loteId));
    expect(l.todoEstudio).toBe(true);
    expect(
      await banco.db
        .select()
        .from(loteTurmas)
        .where(eq(loteTurmas.loteId, r.valor.loteId)),
    ).toHaveLength(0);
  });

  it("exige motivo e prévia com alguém; não grava nada em caso de erro", async () => {
    const c = await cenario();
    const antes = await banco.db.select().from(lotesExtensao);
    expect(
      await confirmarLote(
        banco.db,
        {
          ...lote({ tipo: "turmas", turmaIds: [c.turmaA.id] }),
          motivo: " ",
          feitoPor: adm.id,
        },
        HOJE,
      ),
    ).toEqual({ ok: false, erros: { motivo: "Informe o motivo." } });
    const vazia = await criarTurma(banco.db);
    expect(
      await confirmarLote(
        banco.db,
        {
          ...lote({ tipo: "turmas", turmaIds: [vazia.id] }),
          motivo: "Feriado",
          feitoPor: adm.id,
        },
        HOJE,
      ),
    ).toEqual({
      ok: false,
      erros: { _: "Nenhum aluno vigente nessas turmas." },
    });
    expect(await banco.db.select().from(lotesExtensao)).toHaveLength(
      antes.length,
    );
  });

  it("a extensão vai para o último período (renovação antecipada)", async () => {
    const c = await cenario();
    const novo = await criarPeriodo(banco.db, {
      alunoId: c.ana.id,
      inicio: "2026-12-01",
      fim: "2026-12-31",
      criadoPor: adm.id,
      planoId: plano.id,
    });
    const r = await confirmarLote(
      banco.db,
      {
        ...lote({ tipo: "turmas", turmaIds: [c.turmaA.id] }),
        motivo: "Feriado",
        feitoPor: adm.id,
      },
      HOJE,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [linha] = await banco.db
      .select()
      .from(ajustesPeriodo)
      .where(eq(ajustesPeriodo.periodoId, novo.id));
    expect(linha.loteId).toBe(r.valor.loteId);
  });
});

describe("listarLotes e anularLote", () => {
  it("lista com rótulos das turmas, contagem e situação", async () => {
    const c = await cenario();
    const r = await confirmarLote(
      banco.db,
      {
        ...lote({ tipo: "turmas", turmaIds: [c.turmaA.id] }),
        motivo: "Feriado",
        feitoPor: adm.id,
      },
      HOJE,
    );
    if (!r.ok) throw new Error("falhou");
    const lista = await listarLotes(banco.db);
    const item = lista.find((l) => l.id === r.valor.loteId);
    expect(item).toMatchObject({
      criadoPor: expect.any(String),
      todoEstudio: false,
      quantidadeDigitada: 1,
      unidadeDigitada: "aulas",
      motivo: "Feriado",
      alunos: 2,
      anulado: false,
    });
    expect(item?.turmas).toEqual([
      `${c.ritmo.nome} ${c.modulo.nome} · ter e qui 19h`,
    ]);
    expect(item?.criadoEm).toBeInstanceOf(Date);
  });

  it("anula só as linhas vivas, mesmo de aluno encerrado; segunda vez recusa", async () => {
    const c = await cenario();
    const r = await confirmarLote(
      banco.db,
      {
        ...lote({ tipo: "turmas", turmaIds: [c.turmaA.id, c.turmaB.id] }),
        motivo: "Feriado",
        feitoPor: adm.id,
      },
      HOJE,
    );
    if (!r.ok) throw new Error("falhou");
    const linhas = await banco.db
      .select()
      .from(ajustesPeriodo)
      .where(eq(ajustesPeriodo.loteId, r.valor.loteId));
    const daAna = linhas.find((l) => l.periodoId === c.ana.periodo.id);
    if (!daAna) throw new Error("sem linha");
    expect(
      (
        await anularAjuste(banco.db, {
          ajusteId: daAna.id,
          motivo: "Ana não tinha aula",
          feitoPor: adm.id,
        })
      ).ok,
    ).toBe(true);
    await encerrarAluno(banco.db, {
      alunoId: c.eva.id,
      data: HOJE,
      feitoPor: adm.id,
    });

    expect(
      await anularLote(banco.db, {
        loteId: r.valor.loteId,
        motivo: " ",
        feitoPor: adm.id,
      }),
    ).toEqual({ ok: false, erros: { motivo: "Informe o motivo." } });
    expect(
      await anularLote(banco.db, {
        loteId: r.valor.loteId,
        motivo: "Feriado cancelado",
        feitoPor: adm.id,
      }),
    ).toEqual({ ok: true, valor: { anulados: 1 } });

    const depois = await banco.db
      .select()
      .from(ajustesPeriodo)
      .where(eq(ajustesPeriodo.loteId, r.valor.loteId));
    expect(depois.every((l) => l.anuladoEm !== null)).toBe(true);
    expect(depois.find((l) => l.id === daAna.id)?.motivoAnulacao).toBe(
      "Ana não tinha aula",
    );
    const [l] = await banco.db
      .select()
      .from(lotesExtensao)
      .where(eq(lotesExtensao.id, r.valor.loteId));
    expect(l).toMatchObject({
      anuladoPor: adm.id,
      motivoAnulacao: "Feriado cancelado",
    });
    expect(l.anuladoEm).not.toBeNull();
    expect(
      (await listarLotes(banco.db)).find((x) => x.id === r.valor.loteId)
        ?.anulado,
    ).toBe(true);
    expect(
      await anularLote(banco.db, {
        loteId: r.valor.loteId,
        motivo: "De novo",
        feitoPor: adm.id,
      }),
    ).toEqual({ ok: false, erros: { _: "Isso já foi anulado." } });
    const [p] = await banco.db
      .select()
      .from(periodosContratados)
      .where(eq(periodosContratados.id, c.eva.periodo.id));
    expect(p.anuladoEm).toBeNull();
  });

  it("lote inexistente ou id inválido", async () => {
    for (const loteId of ["x", "00000000-0000-4000-8000-000000000000"]) {
      expect(
        await anularLote(banco.db, { loteId, motivo: "m", feitoPor: adm.id }),
      ).toEqual({ ok: false, erros: { _: "Lote não encontrado." } });
    }
  });
});
