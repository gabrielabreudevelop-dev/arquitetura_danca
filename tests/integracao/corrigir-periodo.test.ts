import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encerrarAluno, MENSAGEM_ENCERRADO } from "@/servidor/alunos/cadastro";
import {
  corrigirPeriodo,
  estender,
  periodoParaCorrigir,
} from "@/servidor/alunos/periodos";
import { periodosContratados } from "@/servidor/banco/esquema";
import { criarBancoDeTeste } from "../apoio/banco";
import {
  criarAdministracao,
  criarAluno,
  criarPeriodo,
  criarPlano,
} from "../apoio/fabricas";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
let adm: Awaited<ReturnType<typeof criarAdministracao>>;
let plano: Awaited<ReturnType<typeof criarPlano>>;

beforeAll(async () => {
  banco = await criarBancoDeTeste();
  adm = await criarAdministracao(banco.db);
  plano = await criarPlano(banco.db);
});
afterAll(async () => {
  await banco.encerrar();
});

const periodosDe = (alunoId: string) =>
  banco.db
    .select()
    .from(periodosContratados)
    .where(eq(periodosContratados.alunoId, alunoId))
    .orderBy(periodosContratados.inicio);

async function alunoComPeriodo(inicio = "2026-11-02", fim = "2026-12-01") {
  const aluno = await criarAluno(banco.db);
  const periodo = await criarPeriodo(banco.db, {
    alunoId: aluno.id,
    inicio,
    fim,
    criadoPor: adm.id,
    planoId: plano.id,
  });
  return { aluno, periodo };
}

const corrigir = (
  alunoId: string,
  periodoId: string,
  datas: { inicio: string; fim: string },
) =>
  corrigirPeriodo(banco.db, {
    alunoId,
    periodoId,
    planoId: plano.id,
    ...datas,
    feitoPor: adm.id,
  });

describe("corrigirPeriodo", () => {
  it("anula o antigo com o motivo “Correção” e registra o novo", async () => {
    const { aluno, periodo } = await alunoComPeriodo();
    const r = await corrigir(aluno.id, periodo.id, {
      inicio: "2026-11-05",
      fim: "2026-12-04",
    });
    expect(r.ok).toBe(true);
    const [antigo, novo] = await periodosDe(aluno.id);
    expect(antigo).toMatchObject({
      id: periodo.id,
      anuladoPor: adm.id,
      motivoAnulacao: "Correção",
    });
    expect(novo).toMatchObject({
      inicio: "2026-11-05",
      fim: "2026-12-04",
      planoId: plano.id,
      origem: "plano",
      anuladoEm: null,
    });
    if (r.ok) expect(r.valor.periodoId).toBe(novo.id);
  });

  it("aceita o novo começando antes do antigo (o antigo deixa de contar)", async () => {
    const { aluno, periodo } = await alunoComPeriodo();
    const r = await corrigir(aluno.id, periodo.id, {
      inicio: "2026-10-20",
      fim: "2026-11-19",
    });
    expect(r.ok).toBe(true);
  });

  it("período com lançamento vivo: erro da anulação e nada registrado", async () => {
    const { aluno, periodo } = await alunoComPeriodo();
    await estender(
      banco.db,
      {
        alunoId: aluno.id,
        quantidade: 5,
        unidade: "dias",
        motivo: "feriado",
        feitoPor: adm.id,
      },
      "2026-11-22",
    );
    expect(
      await corrigir(aluno.id, periodo.id, {
        inicio: "2026-11-05",
        fim: "2026-12-04",
      }),
    ).toEqual({
      ok: false,
      erros: {
        _: "Este período tem 1 lançamento: +5 dias (feriado). Anule-o antes.",
      },
    });
    const lista = await periodosDe(aluno.id);
    expect(lista).toHaveLength(1);
    expect(lista[0].anuladoEm).toBeNull();
  });

  it("registro recusado: desfaz a anulação", async () => {
    const { aluno, periodo } = await alunoComPeriodo(
      "2026-09-01",
      "2026-09-30",
    );
    await criarPeriodo(banco.db, {
      alunoId: aluno.id,
      inicio: "2026-10-01",
      fim: "2026-10-31",
      criadoPor: adm.id,
      planoId: plano.id,
    });
    expect(
      await corrigir(aluno.id, periodo.id, {
        inicio: "2026-09-05",
        fim: "2026-10-04",
      }),
    ).toEqual({
      ok: false,
      erros: {
        inicio:
          "O período atual vai até 31/10. O novo precisa começar a partir de 01/11.",
      },
    });
    const lista = await periodosDe(aluno.id);
    expect(lista).toHaveLength(2);
    expect(lista.every((p) => p.anuladoEm === null)).toBe(true);
  });

  it("campos inválidos: não anula nada", async () => {
    const { aluno, periodo } = await alunoComPeriodo();
    expect(
      await corrigir(aluno.id, periodo.id, {
        inicio: "2026-11-05",
        fim: "2026-11-01",
      }),
    ).toEqual({
      ok: false,
      erros: { fim: "O fim precisa ser depois do início." },
    });
    expect((await periodosDe(aluno.id))[0].anuladoEm).toBeNull();
  });

  it("aluno encerrado: recusa e não anula", async () => {
    const { aluno, periodo } = await alunoComPeriodo();
    await encerrarAluno(banco.db, {
      alunoId: aluno.id,
      data: "2026-11-22",
      feitoPor: adm.id,
    });
    expect(
      await corrigir(aluno.id, periodo.id, {
        inicio: "2026-11-05",
        fim: "2026-12-04",
      }),
    ).toEqual({ ok: false, erros: { _: MENSAGEM_ENCERRADO } });
    expect((await periodosDe(aluno.id))[0].anuladoEm).toBeNull();
  });

  it("período de outro aluno ou id inválido: não encontrado", async () => {
    const { periodo } = await alunoComPeriodo();
    const outro = await criarAluno(banco.db);
    const naoEncontrado = {
      ok: false,
      erros: { _: "Período não encontrado." },
    };
    expect(
      await corrigir(outro.id, periodo.id, {
        inicio: "2026-11-05",
        fim: "2026-12-04",
      }),
    ).toEqual(naoEncontrado);
    expect(
      await corrigir(outro.id, "nao-e-uuid", {
        inicio: "2026-11-05",
        fim: "2026-12-04",
      }),
    ).toEqual(naoEncontrado);
    expect(await periodosDe(outro.id)).toHaveLength(0);
  });
});

describe("periodoParaCorrigir", () => {
  it("devolve plano e datas do período do aluno", async () => {
    const { aluno, periodo } = await alunoComPeriodo();
    expect(await periodoParaCorrigir(banco.db, aluno.id, periodo.id)).toEqual({
      id: periodo.id,
      planoId: plano.id,
      inicio: "2026-11-02",
      fim: "2026-12-01",
    });
  });

  it("nulo para outro aluno, id inválido, anulado ou recebido em transferência", async () => {
    const { aluno, periodo } = await alunoComPeriodo();
    const outro = await criarAluno(banco.db);
    expect(await periodoParaCorrigir(banco.db, outro.id, periodo.id)).toBe(
      null,
    );
    expect(await periodoParaCorrigir(banco.db, aluno.id, "x")).toBe(null);

    const [recebido] = await banco.db
      .insert(periodosContratados)
      .values({
        alunoId: outro.id,
        inicio: "2026-11-02",
        fim: "2026-11-15",
        origem: "transferencia",
        criadoPor: adm.id,
      })
      .returning();
    expect(await periodoParaCorrigir(banco.db, outro.id, recebido.id)).toBe(
      null,
    );

    await banco.db
      .update(periodosContratados)
      .set({ anuladoEm: new Date(), anuladoPor: adm.id, motivoAnulacao: "x" })
      .where(eq(periodosContratados.id, periodo.id));
    expect(await periodoParaCorrigir(banco.db, aluno.id, periodo.id)).toBe(
      null,
    );
  });
});
