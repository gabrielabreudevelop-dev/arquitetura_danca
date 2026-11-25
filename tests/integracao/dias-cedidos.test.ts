/**
 * R14: o fim efetivo não tem limite no início, e nenhuma anulação de linha
 * de dias positivos pode deixar o período terminar antes da véspera do
 * início (os dias dela já foram cedidos a outra pessoa).
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { calcularEstado } from "@/servidor/alunos/estado";
import { anularLote, confirmarLote } from "@/servidor/alunos/lotes";
import {
  anularAjuste,
  carregarPeriodosDoAluno,
  estender,
} from "@/servidor/alunos/periodos";
import { anularTrancamento, trancar } from "@/servidor/alunos/trancamentos";
import {
  anularTransferencia,
  transferir,
} from "@/servidor/alunos/transferencias";
import {
  ajustesPeriodo,
  lotesExtensao,
  periodosContratados,
  transferencias,
} from "@/servidor/banco/esquema";
import { criarBancoDeTeste } from "../apoio/banco";
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

beforeAll(async () => {
  banco = await criarBancoDeTeste();
  adm = await criarAdministracao(banco.db);
  plano = await criarPlano(banco.db);
});
afterAll(async () => {
  await banco.encerrar();
});

const sufixo = () => Math.random().toString(36).slice(2, 8);

async function alunoComPeriodo(
  nome: string,
  inicio = "2026-11-25",
  fim = "2026-12-24",
) {
  const aluno = await criarAluno(banco.db, { nome });
  const periodo = await criarPeriodo(banco.db, {
    alunoId: aluno.id,
    inicio,
    fim,
    criadoPor: adm.id,
    planoId: plano.id,
  });
  return { aluno, periodo };
}

async function ceder(de: string, para: string, dias: number) {
  const r = await transferir(
    banco.db,
    {
      deAlunoId: de,
      paraAlunoId: para,
      quantidade: dias,
      unidade: "dias",
      motivo: "Viagem",
      feitoPor: adm.id,
    },
    HOJE,
  );
  if (!r.ok) throw new Error(JSON.stringify(r.erros));
  return r.valor.transferenciaId;
}

async function resumoDe(alunoId: string) {
  const dados = await carregarPeriodosDoAluno(banco.db, alunoId);
  return calcularEstado({ encerrado: false, ...dados }, HOJE);
}

async function ajusteVivo(id: string) {
  const [l] = await banco.db
    .select({ anuladoEm: ajustesPeriodo.anuladoEm })
    .from(ajustesPeriodo)
    .where(eq(ajustesPeriodo.id, id));
  return l.anuladoEm === null;
}

const anular = { motivo: "Engano", feitoPor: "" };

beforeAll(() => {
  anular.feitoPor = adm.id;
});

describe("período vazio (todos os dias cedidos)", () => {
  it("cedendo 30 dias com hoje = início: vencido, até a véspera do início, como no histórico", async () => {
    const davi = await alunoComPeriodo(`Davi ${sufixo()}`);
    const carla = await criarAluno(banco.db, { nome: "Carla Souza" });
    await ceder(davi.aluno.id, carla.id, 30);
    const r = await resumoDe(davi.aluno.id);
    expect(r.estado).toBe("vencido");
    expect(r.ultimo?.fimEfetivo).toBe("2026-11-24");
  });
});

describe("anular linha positiva cujos dias já foram cedidos", () => {
  it("transferência recebida (entrada): recusa e diz qual transferência anular antes", async () => {
    const ana = await alunoComPeriodo(
      `Ana ${sufixo()}`,
      "2026-11-01",
      "2026-12-31",
    );
    const rita = await alunoComPeriodo(`Rita ${sufixo()}`);
    const carla = await criarAluno(banco.db, { nome: "Carla Souza" });
    const recebida = await ceder(ana.aluno.id, rita.aluno.id, 14);
    const cedida = await ceder(rita.aluno.id, carla.id, 40);

    const r = await anularTransferencia(banco.db, {
      transferenciaId: recebida,
      ...anular,
    });
    expect(r).toEqual({
      ok: false,
      erros: {
        _: "Os dias deste lançamento já foram cedidos. Anule antes a transferência para Carla Souza.",
      },
    });
    const [t] = await banco.db
      .select({ anuladoEm: transferencias.anuladoEm })
      .from(transferencias)
      .where(eq(transferencias.id, recebida));
    expect(t.anuladoEm).toBeNull();
    expect((await resumoDe(rita.aluno.id)).ultimo?.fimEfetivo).toBe(
      "2026-11-28",
    );

    // Na ordem certa, as duas anulações passam.
    expect(
      (
        await anularTransferencia(banco.db, {
          transferenciaId: cedida,
          ...anular,
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await anularTransferencia(banco.db, {
          transferenciaId: recebida,
          ...anular,
        })
      ).ok,
    ).toBe(true);
    expect((await resumoDe(rita.aluno.id)).ultimo?.fimEfetivo).toBe(
      "2026-12-24",
    );
  });

  it("período criado pela transferência, já cedido: recusa nomeando a transferência", async () => {
    const ana = await alunoComPeriodo(
      `Ana ${sufixo()}`,
      "2026-11-01",
      "2026-12-31",
    );
    const rita = await criarAluno(banco.db, { nome: `Rita ${sufixo()}` });
    const carla = await criarAluno(banco.db, { nome: "Carla Souza" });
    const recebida = await ceder(ana.aluno.id, rita.id, 20);
    await ceder(rita.id, carla.id, 20);
    const r = await anularTransferencia(banco.db, {
      transferenciaId: recebida,
      ...anular,
    });
    expect(r).toEqual({
      ok: false,
      erros: {
        _: "Os dias deste lançamento já foram cedidos. Anule antes a transferência para Carla Souza.",
      },
    });
  });

  it("extensão avulsa: recusa; deixar o período vazio (véspera do início) ainda pode", async () => {
    const rita = await alunoComPeriodo(`Rita ${sufixo()}`);
    const carla = await criarAluno(banco.db, { nome: "Carla Souza" });
    const ext = await estender(
      banco.db,
      {
        alunoId: rita.aluno.id,
        quantidade: 14,
        unidade: "dias",
        motivo: "Bônus",
        feitoPor: adm.id,
      },
      HOJE,
    );
    if (!ext.ok) throw new Error(JSON.stringify(ext.erros));
    await ceder(rita.aluno.id, carla.id, 40);
    const r = await anularAjuste(banco.db, {
      ajusteId: ext.valor.ajusteId,
      ...anular,
    });
    expect(r).toEqual({
      ok: false,
      erros: {
        _: "Os dias deste lançamento já foram cedidos. Anule antes a transferência para Carla Souza.",
      },
    });
    expect(await ajusteVivo(ext.valor.ajusteId)).toBe(true);

    // Limite exato: 24/12 + 10 − 30 = 04/12; sem os 10, 24/11, a véspera do início.
    const bia = await alunoComPeriodo(`Bia ${sufixo()}`);
    const ext2 = await estender(
      banco.db,
      {
        alunoId: bia.aluno.id,
        quantidade: 10,
        unidade: "dias",
        motivo: "Bônus",
        feitoPor: adm.id,
      },
      HOJE,
    );
    if (!ext2.ok) throw new Error(JSON.stringify(ext2.erros));
    await ceder(bia.aluno.id, carla.id, 30);
    expect(
      (
        await anularAjuste(banco.db, {
          ajusteId: ext2.valor.ajusteId,
          ...anular,
        })
      ).ok,
    ).toBe(true);
    const resumo = await resumoDe(bia.aluno.id);
    expect(resumo.ultimo?.fimEfetivo).toBe("2026-11-24");
    expect(resumo.estado).toBe("vencido");
  });

  it("duas transferências cedidas: o plural nomeia as duas", async () => {
    const rita = await alunoComPeriodo(`Rita ${sufixo()}`);
    const carla = await criarAluno(banco.db, { nome: "Carla Souza" });
    const joao = await criarAluno(banco.db, { nome: "João Lima" });
    const ext = await estender(
      banco.db,
      {
        alunoId: rita.aluno.id,
        quantidade: 14,
        unidade: "dias",
        motivo: "Bônus",
        feitoPor: adm.id,
      },
      HOJE,
    );
    if (!ext.ok) throw new Error(JSON.stringify(ext.erros));
    await ceder(rita.aluno.id, carla.id, 20);
    await ceder(rita.aluno.id, joao.id, 20);
    const r = await anularAjuste(banco.db, {
      ajusteId: ext.valor.ajusteId,
      ...anular,
    });
    expect(r).toEqual({
      ok: false,
      erros: {
        _: "Os dias deste lançamento já foram cedidos. Anule antes as transferências para Carla Souza e João Lima.",
      },
    });
  });

  it("trancamento fechado: recusa anular o trancamento", async () => {
    const rita = await alunoComPeriodo(`Rita ${sufixo()}`);
    const carla = await criarAluno(banco.db, { nome: "Carla Souza" });
    const t = await trancar(
      banco.db,
      {
        alunoId: rita.aluno.id,
        inicio: "2026-12-01",
        volta: "2026-12-11",
        feitoPor: adm.id,
      },
      HOJE,
    );
    if (!t.ok) throw new Error(JSON.stringify(t.erros));
    await ceder(rita.aluno.id, carla.id, 39);
    const r = await anularTrancamento(banco.db, {
      trancamentoId: t.valor.trancamentoId,
      ...anular,
    });
    expect(r).toEqual({
      ok: false,
      erros: {
        _: "Os dias deste lançamento já foram cedidos. Anule antes a transferência para Carla Souza.",
      },
    });
  });

  describe("lote", () => {
    async function loteComRitaEBia() {
      const turma = await criarTurma(banco.db);
      const rita = await alunoComPeriodo(`Rita Lima ${sufixo()}`);
      const bia = await alunoComPeriodo(`Bia Reis ${sufixo()}`);
      for (const a of [rita, bia]) {
        await criarMatricula(banco.db, {
          alunoId: a.aluno.id,
          turmaId: turma.id,
          entrada: "2026-11-01",
          criadoPor: adm.id,
        });
      }
      const lote = await confirmarLote(
        banco.db,
        {
          escopo: { tipo: "turmas", turmaIds: [turma.id] },
          quantidade: 14,
          unidade: "dias",
          motivo: "Feriado",
          feitoPor: adm.id,
        },
        HOJE,
      );
      if (!lote.ok) throw new Error(JSON.stringify(lote.erros));
      const linhas = await banco.db
        .select({
          id: ajustesPeriodo.id,
          alunoId: periodosContratados.alunoId,
        })
        .from(ajustesPeriodo)
        .innerJoin(
          periodosContratados,
          eq(periodosContratados.id, ajustesPeriodo.periodoId),
        )
        .where(eq(ajustesPeriodo.loteId, lote.valor.loteId));
      const linhaDe = (alunoId: string) =>
        linhas.find((l) => l.alunoId === alunoId)?.id ?? "";
      return { loteId: lote.valor.loteId, rita, bia, linhaDe };
    }

    it("linha de lote anulada sozinha: recusa", async () => {
      const { rita, linhaDe } = await loteComRitaEBia();
      const carla = await criarAluno(banco.db, { nome: "Carla Souza" });
      await ceder(rita.aluno.id, carla.id, 40);
      const r = await anularAjuste(banco.db, {
        ajusteId: linhaDe(rita.aluno.id),
        ...anular,
      });
      expect(r).toEqual({
        ok: false,
        erros: {
          _: "Os dias deste lançamento já foram cedidos. Anule antes a transferência para Carla Souza.",
        },
      });
    });

    it("anular o lote: recusa o lote inteiro, sem anular nada, dizendo qual aluno impede", async () => {
      const { loteId, rita, bia, linhaDe } = await loteComRitaEBia();
      const carla = await criarAluno(banco.db, { nome: "Carla Souza" });
      await ceder(rita.aluno.id, carla.id, 40);
      const r = await anularLote(banco.db, { loteId, ...anular });
      expect(r).toEqual({
        ok: false,
        erros: {
          _: `Os dias de ${rita.aluno.nome} neste lote já foram cedidos. Anule antes a transferência para Carla Souza.`,
        },
      });
      expect(await ajusteVivo(linhaDe(rita.aluno.id))).toBe(true);
      expect(await ajusteVivo(linhaDe(bia.aluno.id))).toBe(true);
      const [l] = await banco.db
        .select({ anuladoEm: lotesExtensao.anuladoEm })
        .from(lotesExtensao)
        .where(eq(lotesExtensao.id, loteId));
      expect(l.anuladoEm).toBeNull();
    });
  });
});
