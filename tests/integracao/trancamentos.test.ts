import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encerrarAluno, MENSAGEM_ENCERRADO } from "@/servidor/alunos/cadastro";
import { calcularEstado, fimEfetivo } from "@/servidor/alunos/estado";
import { carregarPeriodosDoAluno } from "@/servidor/alunos/periodos";
import {
  anularTrancamento,
  destrancar,
  trancar,
} from "@/servidor/alunos/trancamentos";
import { ajustesPeriodo, trancamentos } from "@/servidor/banco/esquema";
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

const HOJE = "2026-11-22";

beforeAll(async () => {
  banco = await criarBancoDeTeste();
  adm = await criarAdministracao(banco.db);
  plano = await criarPlano(banco.db);
});
afterAll(async () => {
  await banco.encerrar();
});

async function alunoComPeriodo(inicio = "2026-11-01", fim = "2026-11-30") {
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

const tentarTrancar = (
  alunoId: string,
  inicio: string,
  volta?: string,
  motivo?: string,
) =>
  trancar(banco.db, { alunoId, inicio, volta, motivo, feitoPor: adm.id }, HOJE);

async function trancarOk(alunoId: string, inicio: string, volta?: string) {
  const r = await tentarTrancar(alunoId, inicio, volta);
  if (!r.ok) throw new Error(JSON.stringify(r.erros));
  return r.valor.trancamentoId;
}

const ajustesDe = async (trancamentoId: string) =>
  banco.db
    .select()
    .from(ajustesPeriodo)
    .where(eq(ajustesPeriodo.trancamentoId, trancamentoId));

const trancamento = async (id: string) => {
  const [t] = await banco.db
    .select()
    .from(trancamentos)
    .where(eq(trancamentos.id, id));
  return t;
};

async function resumo(alunoId: string, hoje = HOJE) {
  const { periodos, trancamentos: ts } = await carregarPeriodosDoAluno(
    banco.db,
    alunoId,
  );
  return calcularEstado({ encerrado: false, periodos, trancamentos: ts }, hoje);
}

describe("trancar com volta conhecida", () => {
  it("gera o ajuste de dias no último período e empurra o fim", async () => {
    const { aluno, periodo } = await alunoComPeriodo();
    const id = await trancarOk(aluno.id, "2026-11-25", "2026-12-14");
    const t = await trancamento(id);
    expect(t).toMatchObject({
      periodoId: periodo.id,
      inicio: "2026-11-25",
      volta: "2026-12-14",
      criadoPor: adm.id,
    });
    const linhas = await ajustesDe(id);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      tipo: "trancamento",
      dias: 19,
      quantidadeDigitada: 19,
      unidadeDigitada: "dias",
      periodoId: periodo.id,
      criadoPor: adm.id,
    });
    const r = await resumo(aluno.id);
    expect(r.ultimo?.fimEfetivo).toBe("2026-12-19");
    expect(r.estado).toBe("vigente");
  });

  it("guarda o motivo, quando informado", async () => {
    const { aluno } = await alunoComPeriodo();
    const id = await trancarOk(aluno.id, "2026-11-25", "2026-12-05");
    expect((await trancamento(id)).motivo).toBeNull();
    const { aluno: outro } = await alunoComPeriodo();
    const r = await tentarTrancar(
      outro.id,
      "2026-11-25",
      "2026-12-05",
      " viagem ",
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect((await trancamento(r.valor.trancamentoId)).motivo).toBe("viagem");
    }
  });

  it("recusa volta que não é depois do início", async () => {
    const { aluno } = await alunoComPeriodo();
    for (const volta of ["2026-11-25", "2026-11-24"]) {
      expect(await tentarTrancar(aluno.id, "2026-11-25", volta)).toEqual({
        ok: false,
        erros: { volta: "A volta precisa ser depois do início." },
      });
    }
  });

  it("recusa datas inválidas", async () => {
    const { aluno } = await alunoComPeriodo();
    expect(await tentarTrancar(aluno.id, "2026-13-01")).toEqual({
      ok: false,
      erros: { inicio: "Informe uma data válida." },
    });
    expect(await tentarTrancar(aluno.id, "2026-11-25", "abc")).toEqual({
      ok: false,
      erros: { volta: "Informe uma data válida." },
    });
  });
});

describe("trancar aberto e destrancar", () => {
  it("fica trancado sem ajuste e destranca com volta, gerando o ajuste", async () => {
    const { aluno } = await alunoComPeriodo();
    const id = await trancarOk(aluno.id, "2026-11-22");
    expect(await ajustesDe(id)).toHaveLength(0);
    expect((await resumo(aluno.id)).estado).toBe("trancado");

    const r = await destrancar(banco.db, {
      trancamentoId: id,
      volta: "2026-12-02",
      feitoPor: adm.id,
    });
    expect(r).toEqual({ ok: true, valor: { dias: 10 } });
    const t = await trancamento(id);
    expect(t.volta).toBe("2026-12-02");
    expect(t.destrancadoEm).not.toBeNull();
    expect(t.destrancadoPor).toBe(adm.id);
    const linhas = await ajustesDe(id);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ tipo: "trancamento", dias: 10 });
    const { periodos } = await carregarPeriodosDoAluno(banco.db, aluno.id);
    expect(fimEfetivo(periodos[0])).toBe("2026-12-10");
  });

  it("não destranca duas vezes nem um trancamento com volta conhecida", async () => {
    const { aluno } = await alunoComPeriodo();
    const id = await trancarOk(aluno.id, "2026-11-22");
    const dados = { trancamentoId: id, volta: "2026-12-02", feitoPor: adm.id };
    expect((await destrancar(banco.db, dados)).ok).toBe(true);
    const encerrado = {
      ok: false,
      erros: { _: "Este trancamento já foi encerrado." },
    };
    expect(await destrancar(banco.db, dados)).toEqual(encerrado);
    const { aluno: outro } = await alunoComPeriodo();
    const fechado = await trancarOk(outro.id, "2026-11-22", "2026-11-28");
    expect(
      await destrancar(banco.db, { ...dados, trancamentoId: fechado }),
    ).toEqual(encerrado);
  });

  it("exige volta depois do início e data válida", async () => {
    const { aluno } = await alunoComPeriodo();
    const id = await trancarOk(aluno.id, "2026-11-22");
    for (const volta of ["2026-11-22", "2026-11-20"]) {
      expect(
        await destrancar(banco.db, {
          trancamentoId: id,
          volta,
          feitoPor: adm.id,
        }),
      ).toEqual({
        ok: false,
        erros: { volta: "A volta precisa ser depois do início." },
      });
    }
    expect(
      await destrancar(banco.db, {
        trancamentoId: id,
        volta: "",
        feitoPor: adm.id,
      }),
    ).toEqual({ ok: false, erros: { volta: "Informe uma data válida." } });
    expect((await trancamento(id)).volta).toBeNull();
  });

  it("recusa trancamento inexistente ou anulado", async () => {
    const naoAchou = {
      ok: false,
      erros: { _: "Trancamento não encontrado." },
    };
    expect(
      await destrancar(banco.db, {
        trancamentoId: "nao-e-uuid",
        volta: "2026-12-02",
        feitoPor: adm.id,
      }),
    ).toEqual(naoAchou);
    expect(
      await destrancar(banco.db, {
        trancamentoId: "00000000-0000-4000-8000-000000000000",
        volta: "2026-12-02",
        feitoPor: adm.id,
      }),
    ).toEqual(naoAchou);
    const { aluno } = await alunoComPeriodo();
    const id = await trancarOk(aluno.id, "2026-11-22");
    await anularTrancamento(banco.db, {
      trancamentoId: id,
      motivo: "engano",
      feitoPor: adm.id,
    });
    expect(
      await destrancar(banco.db, {
        trancamentoId: id,
        volta: "2026-12-02",
        feitoPor: adm.id,
      }),
    ).toEqual({ ok: false, erros: { _: "Este trancamento foi anulado." } });
  });

  it("destranca aluno encerrado", async () => {
    const { aluno } = await alunoComPeriodo();
    const id = await trancarOk(aluno.id, "2026-11-22");
    await encerrarAluno(banco.db, {
      alunoId: aluno.id,
      data: HOJE,
      feitoPor: adm.id,
    });
    const r = await destrancar(banco.db, {
      trancamentoId: id,
      volta: "2026-12-02",
      feitoPor: adm.id,
    });
    expect(r).toEqual({ ok: true, valor: { dias: 10 } });
  });
});

describe("regras de trancar", () => {
  it("recusa um segundo enquanto há um aberto", async () => {
    const { aluno } = await alunoComPeriodo();
    await trancarOk(aluno.id, "2026-11-22");
    expect(await tentarTrancar(aluno.id, "2026-11-28")).toEqual({
      ok: false,
      erros: { _: "Já existe um trancamento aberto." },
    });
  });

  it("recusa trancamento que se sobrepõe a outro fechado", async () => {
    const { aluno } = await alunoComPeriodo();
    await trancarOk(aluno.id, "2026-11-10", "2026-11-20");
    const erro = {
      ok: false,
      erros: { inicio: "Já existe um trancamento nesse intervalo." },
    };
    expect(await tentarTrancar(aluno.id, "2026-11-15", "2026-11-18")).toEqual(
      erro,
    );
    expect(await tentarTrancar(aluno.id, "2026-11-05", "2026-11-12")).toEqual(
      erro,
    );
    expect(await tentarTrancar(aluno.id, "2026-11-19")).toEqual(erro);
    expect(await tentarTrancar(aluno.id, "2026-11-05", "2026-11-25")).toEqual(
      erro,
    );
    // Encostar na volta não sobrepõe: a volta é o primeiro dia de aula.
    expect((await tentarTrancar(aluno.id, "2026-11-20", "2026-11-22")).ok).toBe(
      true,
    );
  });

  it("ignora trancamento anulado ao checar sobreposição", async () => {
    const { aluno } = await alunoComPeriodo();
    const id = await trancarOk(aluno.id, "2026-11-10", "2026-11-20");
    await anularTrancamento(banco.db, {
      trancamentoId: id,
      motivo: "engano",
      feitoPor: adm.id,
    });
    expect((await tentarTrancar(aluno.id, "2026-11-12", "2026-11-14")).ok).toBe(
      true,
    );
  });

  it("exige início dentro do último período", async () => {
    const { aluno } = await alunoComPeriodo();
    const erro = {
      ok: false,
      erros: {
        inicio: "O início precisa estar dentro do período (01/11 a 30/11).",
      },
    };
    expect(await tentarTrancar(aluno.id, "2026-10-31")).toEqual(erro);
    expect(await tentarTrancar(aluno.id, "2026-12-01")).toEqual(erro);
    expect((await tentarTrancar(aluno.id, "2026-11-30")).ok).toBe(true);
  });

  it("usa o fim efetivo do período (com ajustes) como limite", async () => {
    const { aluno, periodo } = await alunoComPeriodo();
    await banco.db.insert(ajustesPeriodo).values({
      periodoId: periodo.id,
      tipo: "extensao",
      dias: 5,
      quantidadeDigitada: 5,
      unidadeDigitada: "dias",
      motivo: "feriado",
      criadoPor: adm.id,
    });
    expect((await tentarTrancar(aluno.id, "2026-12-05")).ok).toBe(true);
  });

  it("vale para o último período, inclusive o que ainda vai começar", async () => {
    const { aluno } = await alunoComPeriodo("2026-10-01", "2026-10-31");
    await criarPeriodo(banco.db, {
      alunoId: aluno.id,
      inicio: "2026-12-01",
      fim: "2026-12-31",
      criadoPor: adm.id,
      planoId: plano.id,
    });
    const erro = await tentarTrancar(aluno.id, "2026-11-25");
    expect(erro).toEqual({
      ok: false,
      erros: {
        inicio: "O início precisa estar dentro do período (01/12 a 31/12).",
      },
    });
    expect((await tentarTrancar(aluno.id, "2026-12-10", "2026-12-12")).ok).toBe(
      true,
    );
  });

  it("recusa aluno vencido ou sem período", async () => {
    const mensagem = {
      ok: false,
      erros: {
        _: "Só é possível trancar um período vigente ou que vai começar.",
      },
    };
    const { aluno } = await alunoComPeriodo("2026-09-01", "2026-09-30");
    expect(await tentarTrancar(aluno.id, "2026-09-10")).toEqual(mensagem);
    const semPeriodo = await criarAluno(banco.db);
    expect(await tentarTrancar(semPeriodo.id, HOJE)).toEqual(mensagem);
  });

  it("recusa aluno encerrado", async () => {
    const { aluno } = await alunoComPeriodo();
    await encerrarAluno(banco.db, {
      alunoId: aluno.id,
      data: HOJE,
      feitoPor: adm.id,
    });
    expect(await tentarTrancar(aluno.id, HOJE)).toEqual({
      ok: false,
      erros: { _: MENSAGEM_ENCERRADO },
    });
  });

  it("recusa aluno inexistente", async () => {
    expect(await tentarTrancar("nao-e-uuid", HOJE)).toEqual({
      ok: false,
      erros: { _: "Aluno não encontrado." },
    });
  });
});

describe("anularTrancamento", () => {
  const anular = (trancamentoId: string, motivo = "lançado por engano") =>
    anularTrancamento(banco.db, { trancamentoId, motivo, feitoPor: adm.id });

  it("anula o trancamento fechado e o ajuste; o fim volta", async () => {
    const { aluno } = await alunoComPeriodo();
    const id = await trancarOk(aluno.id, "2026-11-25", "2026-12-14");
    expect(await anular(id)).toEqual({ ok: true, valor: null });
    const t = await trancamento(id);
    expect(t).toMatchObject({
      anuladoPor: adm.id,
      motivoAnulacao: "lançado por engano",
    });
    expect(t.anuladoEm).not.toBeNull();
    const [linha] = await ajustesDe(id);
    expect(linha).toMatchObject({
      anuladoPor: adm.id,
      motivoAnulacao: "lançado por engano",
    });
    expect(linha.anuladoEm).not.toBeNull();
    expect((await resumo(aluno.id)).ultimo?.fimEfetivo).toBe("2026-11-30");
  });

  it("anula o trancamento aberto e o estado deixa de ser trancado", async () => {
    const { aluno } = await alunoComPeriodo();
    const id = await trancarOk(aluno.id, "2026-11-22");
    expect((await resumo(aluno.id)).estado).toBe("trancado");
    expect(await anular(id)).toEqual({ ok: true, valor: null });
    expect((await resumo(aluno.id)).estado).toBe("vigente");
  });

  it("anula também depois de destrancado", async () => {
    const { aluno } = await alunoComPeriodo();
    const id = await trancarOk(aluno.id, "2026-11-22");
    await destrancar(banco.db, {
      trancamentoId: id,
      volta: "2026-12-02",
      feitoPor: adm.id,
    });
    expect(await anular(id)).toEqual({ ok: true, valor: null });
    expect((await resumo(aluno.id)).ultimo?.fimEfetivo).toBe("2026-11-30");
  });

  it("exige motivo, recusa repetição e inexistente", async () => {
    const { aluno } = await alunoComPeriodo();
    const id = await trancarOk(aluno.id, "2026-11-22");
    expect(await anular(id, "  ")).toEqual({
      ok: false,
      erros: { motivo: "Informe o motivo." },
    });
    expect((await anular(id)).ok).toBe(true);
    expect(await anular(id)).toEqual({
      ok: false,
      erros: { _: "Isso já foi anulado." },
    });
    expect(await anular("nao-e-uuid")).toEqual({
      ok: false,
      erros: { _: "Trancamento não encontrado." },
    });
  });

  it("vale para aluno encerrado", async () => {
    const { aluno } = await alunoComPeriodo();
    const id = await trancarOk(aluno.id, "2026-11-25", "2026-12-14");
    await encerrarAluno(banco.db, {
      alunoId: aluno.id,
      data: HOJE,
      feitoPor: adm.id,
    });
    expect(await anular(id)).toEqual({ ok: true, valor: null });
  });

  it("o ajuste do trancamento não é anulável sozinho", async () => {
    const { aluno } = await alunoComPeriodo();
    const id = await trancarOk(aluno.id, "2026-11-25", "2026-12-14");
    const [linha] = await ajustesDe(id);
    const { anularAjuste } = await import("@/servidor/alunos/periodos");
    const r = await anularAjuste(banco.db, {
      ajusteId: linha.id,
      motivo: "x",
      feitoPor: adm.id,
    });
    expect(r).toEqual({
      ok: false,
      erros: {
        _: "Este lançamento faz parte de um trancamento. Anule o trancamento.",
      },
    });
  });
});

describe("destrancar e sobreposição", () => {
  it("recusa volta que invade um trancamento posterior", async () => {
    const { aluno } = await alunoComPeriodo();
    const aberto = await trancarOk(aluno.id, "2026-11-05");
    // Aberto bloqueia novos; força um fechado posterior direto no banco.
    const [t] = await banco.db
      .select({ periodoId: trancamentos.periodoId })
      .from(trancamentos)
      .where(eq(trancamentos.id, aberto));
    await banco.db.insert(trancamentos).values({
      periodoId: t.periodoId,
      inicio: "2026-11-15",
      volta: "2026-11-18",
      criadoPor: adm.id,
    });
    expect(
      await destrancar(banco.db, {
        trancamentoId: aberto,
        volta: "2026-11-16",
        feitoPor: adm.id,
      }),
    ).toEqual({
      ok: false,
      erros: { volta: "Já existe um trancamento nesse intervalo." },
    });
  });
});
