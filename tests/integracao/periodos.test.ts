import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encerrarAluno, MENSAGEM_ENCERRADO } from "@/servidor/alunos/cadastro";
import {
  anularAjuste,
  anularPeriodo,
  carregarPeriodosDoAluno,
  descreverAjusteCurto,
  estender,
  registrarPeriodo,
  sugestaoDePeriodo,
} from "@/servidor/alunos/periodos";
import {
  ajustesPeriodo,
  lotesExtensao,
  periodosContratados,
  planos,
  trancamentos,
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

const HOJE = "2026-11-22";

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
    .where(eq(periodosContratados.alunoId, alunoId));

const ajuste = async (id: string) => {
  const [a] = await banco.db
    .select()
    .from(ajustesPeriodo)
    .where(eq(ajustesPeriodo.id, id));
  return a;
};

/** Aluno com um período de `inicio` a `fim`. */
async function alunoComPeriodo(inicio: string, fim: string) {
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

async function estenderDias(alunoId: string, dias: number, motivo = "feriado") {
  const r = await estender(
    banco.db,
    { alunoId, quantidade: dias, unidade: "dias", motivo, feitoPor: adm.id },
    HOJE,
  );
  if (!r.ok) throw new Error(JSON.stringify(r.erros));
  return r.valor;
}

/** Período de novembro de um aluno novo chamado `nome`. */
async function periodoDe(nome: string) {
  const aluno = await criarAluno(banco.db, { nome });
  return criarPeriodo(banco.db, {
    alunoId: aluno.id,
    inicio: "2026-11-01",
    fim: "2026-11-30",
    criadoPor: adm.id,
    planoId: plano.id,
  });
}

/** Linha do livro de uma transferência de 14 dias (saída ou entrada). */
async function linhaDeTransferencia(
  periodoId: string,
  tipo: "transferencia_saida" | "transferencia_entrada",
  transferenciaId: string,
) {
  const [linha] = await banco.db
    .insert(ajustesPeriodo)
    .values({
      periodoId,
      tipo,
      dias: tipo === "transferencia_saida" ? -14 : 14,
      quantidadeDigitada: 14,
      unidadeDigitada: "dias",
      motivo: "mudou de cidade",
      transferenciaId,
      criadoPor: adm.id,
    })
    .returning();
  return linha;
}

async function novaTransferencia(origemId: string, destinoId: string) {
  const [t] = await banco.db
    .insert(transferencias)
    .values({
      periodoOrigemId: origemId,
      periodoDestinoId: destinoId,
      dias: 14,
      motivo: "mudou de cidade",
      criadoPor: adm.id,
    })
    .returning();
  return t;
}

/** O período `origemId` cede 14 dias a um aluno novo chamado `destinoNome`. */
async function transferir(origemId: string, destinoNome: string) {
  const destino = await periodoDe(destinoNome);
  const t = await novaTransferencia(origemId, destino.id);
  const saida = await linhaDeTransferencia(
    origemId,
    "transferencia_saida",
    t.id,
  );
  return { transferencia: t, saida, destino };
}

/** O período `destinoId` recebe 14 dias de um aluno novo chamado `origemNome`. */
async function receber(destinoId: string, origemNome: string) {
  const origem = await periodoDe(origemNome);
  const t = await novaTransferencia(origem.id, destinoId);
  const entrada = await linhaDeTransferencia(
    destinoId,
    "transferencia_entrada",
    t.id,
  );
  return { transferencia: t, entrada, origem };
}

describe("descreverAjusteCurto", () => {
  it("mostra sinal, dias e motivo", () => {
    expect(
      descreverAjusteCurto({ dias: 5, motivo: "feriado", tipo: "extensao" }),
    ).toBe("+5 dias (feriado)");
    expect(
      descreverAjusteCurto({ dias: 1, motivo: "feriado", tipo: "extensao" }),
    ).toBe("+1 dia (feriado)");
  });

  it("nomeia a outra pessoa nas transferências", () => {
    expect(
      descreverAjusteCurto({
        dias: -14,
        motivo: "mudou de cidade",
        tipo: "transferencia_saida",
        nomeOutraPessoa: "João Souza",
      }),
    ).toBe("−14 dias (transferidos para João Souza)");
    expect(
      descreverAjusteCurto({
        dias: 14,
        motivo: "mudou de cidade",
        tipo: "transferencia_entrada",
        nomeOutraPessoa: "Ana Souza",
      }),
    ).toBe("+14 dias (recebidos de Ana Souza)");
  });

  it("trancamento sem motivo", () => {
    expect(
      descreverAjusteCurto({ dias: 19, motivo: null, tipo: "trancamento" }),
    ).toBe("+19 dias (trancamento)");
  });
});

describe("registrarPeriodo", () => {
  it("registra com plano ativo, origem plano e quem registrou", async () => {
    const aluno = await criarAluno(banco.db);
    const r = await registrarPeriodo(banco.db, {
      alunoId: aluno.id,
      planoId: plano.id,
      inicio: "2026-12-01",
      fim: "2026-12-31",
      feitoPor: adm.id,
    });
    expect(r.ok).toBe(true);
    const [p] = await periodosDe(aluno.id);
    expect(p).toMatchObject({
      inicio: "2026-12-01",
      fim: "2026-12-31",
      planoId: plano.id,
      origem: "plano",
      criadoPor: adm.id,
      anuladoEm: null,
    });
    if (r.ok) expect(r.valor.periodoId).toBe(p.id);
  });

  it("recusa plano desativado", async () => {
    const aluno = await criarAluno(banco.db);
    const inativo = await criarPlano(banco.db, { ativo: false });
    const r = await registrarPeriodo(banco.db, {
      alunoId: aluno.id,
      planoId: inativo.id,
      inicio: "2026-12-01",
      fim: "2026-12-31",
      feitoPor: adm.id,
    });
    expect(r).toEqual({
      ok: false,
      erros: { planoId: "Escolha um plano ativo." },
    });
    expect(await periodosDe(aluno.id)).toHaveLength(0);
  });

  it("recusa fim antes do início", async () => {
    const aluno = await criarAluno(banco.db);
    const r = await registrarPeriodo(banco.db, {
      alunoId: aluno.id,
      planoId: plano.id,
      inicio: "2026-12-01",
      fim: "2026-11-30",
      feitoPor: adm.id,
    });
    expect(r).toEqual({
      ok: false,
      erros: { fim: "O fim precisa ser depois do início." },
    });
  });

  it("recusa aluno encerrado", async () => {
    const aluno = await criarAluno(banco.db);
    await encerrarAluno(banco.db, {
      alunoId: aluno.id,
      data: HOJE,
      feitoPor: adm.id,
    });
    const r = await registrarPeriodo(banco.db, {
      alunoId: aluno.id,
      planoId: plano.id,
      inicio: "2026-12-01",
      fim: "2026-12-31",
      feitoPor: adm.id,
    });
    expect(r).toEqual({ ok: false, erros: { _: MENSAGEM_ENCERRADO } });
  });

  describe("sobreposição com o fim efetivo do último", () => {
    async function alunoAte0812() {
      const { aluno } = await alunoComPeriodo("2026-11-02", "2026-12-01");
      await estenderDias(aluno.id, 7);
      return aluno;
    }
    const registrar = (alunoId: string, inicio: string, fim: string) =>
      registrarPeriodo(banco.db, {
        alunoId,
        planoId: plano.id,
        inicio,
        fim,
        feitoPor: adm.id,
      });

    it("recusa começar no último dia do período atual", async () => {
      const aluno = await alunoAte0812();
      const r = await registrar(aluno.id, "2026-12-08", "2027-01-07");
      expect(r).toEqual({
        ok: false,
        erros: {
          inicio:
            "O período atual vai até 08/12. O novo precisa começar a partir de 09/12.",
        },
      });
      expect(await periodosDe(aluno.id)).toHaveLength(1);
    });

    it("aceita começar no dia seguinte", async () => {
      const aluno = await alunoAte0812();
      const r = await registrar(aluno.id, "2026-12-09", "2027-01-08");
      expect(r.ok).toBe(true);
    });

    it("aceita começar depois de um intervalo", async () => {
      const aluno = await alunoAte0812();
      const r = await registrar(aluno.id, "2027-01-10", "2027-02-09");
      expect(r.ok).toBe(true);
    });
  });

  it("duas chamadas simultâneas: uma passa, a outra esbarra na sobreposição", async () => {
    const aluno = await criarAluno(banco.db);
    const dados = {
      alunoId: aluno.id,
      planoId: plano.id,
      inicio: "2026-12-01",
      fim: "2026-12-31",
      feitoPor: adm.id,
    };
    const resultados = await Promise.all([
      registrarPeriodo(banco.db, dados),
      registrarPeriodo(banco.db, dados),
    ]);
    expect(resultados.filter((r) => r.ok)).toHaveLength(1);
    expect(resultados.filter((r) => !r.ok)).toEqual([
      {
        ok: false,
        erros: {
          inicio:
            "O período atual vai até 31/12. O novo precisa começar a partir de 01/01.",
        },
      },
    ]);
    expect(await periodosDe(aluno.id)).toHaveLength(1);
  });
});

describe("sugestaoDePeriodo", () => {
  it("vigente: começa no dia seguinte ao fim efetivo, com o plano do último", async () => {
    const { aluno } = await alunoComPeriodo("2026-11-02", "2026-12-01");
    await estenderDias(aluno.id, 7);
    expect(await sugestaoDePeriodo(banco.db, aluno.id, HOJE)).toEqual({
      planoId: plano.id,
      inicio: "2026-12-09",
      inicioMinimo: "2026-12-09",
    });
  });

  it("termina hoje: começa amanhã", async () => {
    const { aluno } = await alunoComPeriodo("2026-10-23", HOJE);
    expect(await sugestaoDePeriodo(banco.db, aluno.id, HOJE)).toEqual({
      planoId: plano.id,
      inicio: "2026-11-23",
      inicioMinimo: "2026-11-23",
    });
  });

  it("vencido: começa hoje", async () => {
    const { aluno } = await alunoComPeriodo("2026-09-01", "2026-09-30");
    expect(await sugestaoDePeriodo(banco.db, aluno.id, HOJE)).toEqual({
      planoId: plano.id,
      inicio: HOJE,
      inicioMinimo: "2026-10-01",
    });
  });

  it("plano do último desativado: sem plano sugerido", async () => {
    const desativado = await criarPlano(banco.db);
    const aluno = await criarAluno(banco.db);
    await criarPeriodo(banco.db, {
      alunoId: aluno.id,
      inicio: "2026-11-02",
      fim: "2026-12-01",
      criadoPor: adm.id,
      planoId: desativado.id,
    });
    await banco.db
      .update(planos)
      .set({ ativo: false })
      .where(eq(planos.id, desativado.id));
    expect(await sugestaoDePeriodo(banco.db, aluno.id, HOJE)).toEqual({
      planoId: null,
      inicio: "2026-12-02",
      inicioMinimo: "2026-12-02",
    });
  });

  it("sem período: hoje e sem plano", async () => {
    const aluno = await criarAluno(banco.db);
    expect(await sugestaoDePeriodo(banco.db, aluno.id, HOJE)).toEqual({
      planoId: null,
      inicio: HOJE,
      inicioMinimo: null,
    });
  });
});

describe("estender", () => {
  const base = (alunoId: string) => ({
    alunoId,
    quantidade: 5 as string | number,
    unidade: "dias",
    motivo: "feriado",
    feitoPor: adm.id,
  });

  it("estende 5 dias", async () => {
    const { aluno, periodo } = await alunoComPeriodo(
      "2026-11-02",
      "2026-12-01",
    );
    const r = await estender(banco.db, base(aluno.id), HOJE);
    expect(r).toMatchObject({
      ok: true,
      valor: { dias: 5, fimAntes: "2026-12-01", fimDepois: "2026-12-06" },
    });
    if (!r.ok) return;
    expect(await ajuste(r.valor.ajusteId)).toMatchObject({
      periodoId: periodo.id,
      tipo: "extensao",
      dias: 5,
      quantidadeDigitada: 5,
      unidadeDigitada: "dias",
      turmaConversaoId: null,
      motivo: "feriado",
      criadoPor: adm.id,
    });
  });

  it("aceita a quantidade como texto", async () => {
    const { aluno } = await alunoComPeriodo("2026-11-02", "2026-12-01");
    const r = await estender(
      banco.db,
      { ...base(aluno.id), quantidade: " 3 " },
      HOJE,
    );
    expect(r).toMatchObject({ ok: true, valor: { dias: 3 } });
  });

  it("1 aula numa turma de ter e qui vale 4 dias", async () => {
    const { aluno } = await alunoComPeriodo("2026-11-02", "2026-12-01");
    const turma = await criarTurma(banco.db);
    await criarMatricula(banco.db, {
      alunoId: aluno.id,
      turmaId: turma.id,
      entrada: "2026-11-02",
      criadoPor: adm.id,
    });
    const r = await estender(
      banco.db,
      { ...base(aluno.id), quantidade: 1, unidade: "aulas" },
      HOJE,
    );
    expect(r).toMatchObject({
      ok: true,
      valor: { dias: 4, fimDepois: "2026-12-05" },
    });
    if (!r.ok) return;
    expect(await ajuste(r.valor.ajusteId)).toMatchObject({
      dias: 4,
      quantidadeDigitada: 1,
      unidadeDigitada: "aulas",
      turmaConversaoId: turma.id,
    });
  });

  it("em aulas com duas matrículas: pede a turma; com a turma, converte por ela", async () => {
    const { aluno } = await alunoComPeriodo("2026-11-02", "2026-12-01");
    const terQui = await criarTurma(banco.db);
    const sexta = await criarTurma(banco.db, { dias: [5] });
    for (const turma of [terQui, sexta]) {
      await criarMatricula(banco.db, {
        alunoId: aluno.id,
        turmaId: turma.id,
        entrada: "2026-11-02",
        criadoPor: adm.id,
      });
    }
    const emAulas = { ...base(aluno.id), quantidade: 1, unidade: "aulas" };
    expect(await estender(banco.db, emAulas, HOJE)).toEqual({
      ok: false,
      erros: { turmaId: "Escolha a turma das aulas." },
    });
    const r = await estender(banco.db, { ...emAulas, turmaId: sexta.id }, HOJE);
    expect(r).toMatchObject({ ok: true, valor: { dias: 7 } });
  });

  it("em aulas com turma que não é dele: pede a turma", async () => {
    const { aluno } = await alunoComPeriodo("2026-11-02", "2026-12-01");
    const minha = await criarTurma(banco.db);
    const outra = await criarTurma(banco.db);
    await criarMatricula(banco.db, {
      alunoId: aluno.id,
      turmaId: minha.id,
      entrada: "2026-11-02",
      criadoPor: adm.id,
    });
    const r = await estender(
      banco.db,
      { ...base(aluno.id), quantidade: 1, unidade: "aulas", turmaId: outra.id },
      HOJE,
    );
    expect(r).toEqual({
      ok: false,
      erros: { turmaId: "Escolha a turma das aulas." },
    });
  });

  it("em aulas numa turma sem dias na semana: só dias", async () => {
    const { aluno } = await alunoComPeriodo("2026-11-02", "2026-12-01");
    const semDias = await criarTurma(banco.db, { dias: [] });
    await criarMatricula(banco.db, {
      alunoId: aluno.id,
      turmaId: semDias.id,
      entrada: "2026-11-02",
      criadoPor: adm.id,
    });
    const r = await estender(
      banco.db,
      { ...base(aluno.id), quantidade: 1, unidade: "aulas" },
      HOJE,
    );
    expect(r).toEqual({
      ok: false,
      erros: { unidade: "Essa turma não tem dias na semana; informe em dias." },
    });
  });

  it("em aulas sem matrícula aberta: só dias", async () => {
    const { aluno } = await alunoComPeriodo("2026-11-02", "2026-12-01");
    const r = await estender(
      banco.db,
      { ...base(aluno.id), quantidade: 1, unidade: "aulas" },
      HOJE,
    );
    expect(r).toEqual({
      ok: false,
      erros: { unidade: "Sem turma, informe em dias." },
    });
  });

  it("sem período", async () => {
    const aluno = await criarAluno(banco.db);
    expect(await estender(banco.db, base(aluno.id), HOJE)).toEqual({
      ok: false,
      erros: { _: "Este aluno ainda não tem período." },
    });
  });

  it("motivo vazio e quantidade zero", async () => {
    const { aluno } = await alunoComPeriodo("2026-11-02", "2026-12-01");
    expect(
      await estender(
        banco.db,
        { ...base(aluno.id), motivo: "  ", quantidade: 0 },
        HOJE,
      ),
    ).toEqual({
      ok: false,
      erros: {
        motivo: "Informe o motivo.",
        quantidade: "Informe um número inteiro maior que zero.",
      },
    });
    for (const quantidade of ["", "2.5", "-1", "abc"]) {
      const r = await estender(
        banco.db,
        { ...base(aluno.id), quantidade },
        HOJE,
      );
      expect(r).toEqual({
        ok: false,
        erros: { quantidade: "Informe um número inteiro maior que zero." },
      });
    }
  });

  it("recusa aluno encerrado", async () => {
    const { aluno } = await alunoComPeriodo("2026-11-02", "2026-12-01");
    await encerrarAluno(banco.db, {
      alunoId: aluno.id,
      data: HOJE,
      feitoPor: adm.id,
    });
    expect(await estender(banco.db, base(aluno.id), HOJE)).toEqual({
      ok: false,
      erros: { _: MENSAGEM_ENCERRADO },
    });
  });

  it("vai para o último período: com renovação futura, o fim da renovação cresce", async () => {
    const { aluno } = await alunoComPeriodo("2026-11-02", "2026-12-01");
    const renovacao = await criarPeriodo(banco.db, {
      alunoId: aluno.id,
      inicio: "2026-12-02",
      fim: "2027-01-01",
      criadoPor: adm.id,
      planoId: plano.id,
    });
    const r = await estender(banco.db, base(aluno.id), HOJE);
    expect(r).toMatchObject({
      ok: true,
      valor: { fimAntes: "2027-01-01", fimDepois: "2027-01-06" },
    });
    if (!r.ok) return;
    expect((await ajuste(r.valor.ajusteId)).periodoId).toBe(renovacao.id);
  });
});

describe("carregarPeriodosDoAluno", () => {
  it("só períodos e trancamentos não anulados, com a soma dos ajustes vivos", async () => {
    const { aluno, periodo } = await alunoComPeriodo(
      "2026-11-02",
      "2026-12-01",
    );
    await estenderDias(aluno.id, 5);
    const anulado = await estenderDias(aluno.id, 3);
    await anularAjuste(banco.db, {
      ajusteId: anulado.ajusteId,
      motivo: "engano",
      feitoPor: adm.id,
    });
    const [t] = await banco.db
      .insert(trancamentos)
      .values({
        periodoId: periodo.id,
        inicio: "2026-11-25",
        criadoPor: adm.id,
      })
      .returning();
    const r = await carregarPeriodosDoAluno(banco.db, aluno.id);
    expect(r).toEqual({
      periodos: [
        {
          id: periodo.id,
          inicio: "2026-11-02",
          fim: "2026-12-01",
          diasAjustes: 5,
        },
      ],
      trancamentos: [
        { id: t.id, periodoId: periodo.id, inicio: "2026-11-25", volta: null },
      ],
    });
  });
});

describe("anularAjuste", () => {
  it("anula a extensão e o fim volta; de novo, já foi anulado", async () => {
    const { aluno } = await alunoComPeriodo("2026-11-02", "2026-12-01");
    const { ajusteId } = await estenderDias(aluno.id, 5);
    const r = await anularAjuste(banco.db, {
      ajusteId,
      motivo: "engano",
      feitoPor: adm.id,
    });
    expect(r).toEqual({ ok: true, valor: null });
    expect(await ajuste(ajusteId)).toMatchObject({
      anuladoPor: adm.id,
      motivoAnulacao: "engano",
    });
    expect((await ajuste(ajusteId)).anuladoEm).not.toBeNull();
    const { periodos } = await carregarPeriodosDoAluno(banco.db, aluno.id);
    expect(periodos[0].diasAjustes).toBe(0);

    expect(
      await anularAjuste(banco.db, {
        ajusteId,
        motivo: "engano",
        feitoPor: adm.id,
      }),
    ).toEqual({ ok: false, erros: { _: "Isso já foi anulado." } });
  });

  it("motivo vazio", async () => {
    const { aluno } = await alunoComPeriodo("2026-11-02", "2026-12-01");
    const { ajusteId } = await estenderDias(aluno.id, 5);
    expect(
      await anularAjuste(banco.db, { ajusteId, motivo: " ", feitoPor: adm.id }),
    ).toEqual({ ok: false, erros: { motivo: "Informe o motivo." } });
    expect((await ajuste(ajusteId)).anuladoEm).toBeNull();
  });

  it("lançamento de transferência: anule a transferência", async () => {
    const { periodo } = await alunoComPeriodo("2026-11-02", "2026-12-01");
    const { saida } = await transferir(periodo.id, "João Souza");
    expect(
      await anularAjuste(banco.db, {
        ajusteId: saida.id,
        motivo: "engano",
        feitoPor: adm.id,
      }),
    ).toEqual({
      ok: false,
      erros: {
        _: "Este lançamento faz parte de uma transferência. Anule a transferência.",
      },
    });
  });

  it("lançamento de trancamento: anule o trancamento", async () => {
    const { periodo } = await alunoComPeriodo("2026-11-02", "2026-12-01");
    const [t] = await banco.db
      .insert(trancamentos)
      .values({
        periodoId: periodo.id,
        inicio: "2026-11-10",
        volta: "2026-11-20",
        criadoPor: adm.id,
      })
      .returning();
    const [linha] = await banco.db
      .insert(ajustesPeriodo)
      .values({
        periodoId: periodo.id,
        tipo: "trancamento",
        dias: 10,
        quantidadeDigitada: 10,
        unidadeDigitada: "dias",
        trancamentoId: t.id,
        criadoPor: adm.id,
      })
      .returning();
    expect(
      await anularAjuste(banco.db, {
        ajusteId: linha.id,
        motivo: "engano",
        feitoPor: adm.id,
      }),
    ).toEqual({
      ok: false,
      erros: {
        _: "Este lançamento faz parte de um trancamento. Anule o trancamento.",
      },
    });
  });

  it("linha de um lote pode ser anulada sozinha", async () => {
    const { periodo } = await alunoComPeriodo("2026-11-02", "2026-12-01");
    const [lote] = await banco.db
      .insert(lotesExtensao)
      .values({
        todoEstudio: true,
        quantidadeDigitada: 2,
        unidadeDigitada: "dias",
        motivo: "feriado",
        criadoPor: adm.id,
      })
      .returning();
    const [linha] = await banco.db
      .insert(ajustesPeriodo)
      .values({
        periodoId: periodo.id,
        tipo: "extensao",
        dias: 2,
        quantidadeDigitada: 2,
        unidadeDigitada: "dias",
        motivo: "feriado",
        loteId: lote.id,
        criadoPor: adm.id,
      })
      .returning();
    expect(
      await anularAjuste(banco.db, {
        ajusteId: linha.id,
        motivo: "não veio no feriado",
        feitoPor: adm.id,
      }),
    ).toEqual({ ok: true, valor: null });
  });

  it("aluno encerrado: anula sem reabrir e o fim volta", async () => {
    const { aluno } = await alunoComPeriodo("2026-11-02", "2026-12-01");
    const { ajusteId } = await estenderDias(aluno.id, 5);
    await encerrarAluno(banco.db, {
      alunoId: aluno.id,
      data: HOJE,
      feitoPor: adm.id,
    });
    expect(
      await anularAjuste(banco.db, {
        ajusteId,
        motivo: "engano",
        feitoPor: adm.id,
      }),
    ).toEqual({ ok: true, valor: null });
    const { periodos } = await carregarPeriodosDoAluno(banco.db, aluno.id);
    expect(periodos[0].diasAjustes).toBe(0);
  });

  it("id desconhecido", async () => {
    for (const ajusteId of ["xyz", "00000000-0000-0000-0000-000000000000"]) {
      expect(
        await anularAjuste(banco.db, {
          ajusteId,
          motivo: "engano",
          feitoPor: adm.id,
        }),
      ).toEqual({ ok: false, erros: { _: "Lançamento não encontrado." } });
    }
  });
});

describe("anularPeriodo", () => {
  const anular = (periodoId: string, motivo = "engano") =>
    anularPeriodo(banco.db, { periodoId, motivo, feitoPor: adm.id });

  it("sem lançamentos vivos: anula e some dos períodos do aluno", async () => {
    const { aluno, periodo } = await alunoComPeriodo(
      "2026-11-02",
      "2026-12-01",
    );
    const { ajusteId } = await estenderDias(aluno.id, 5);
    await anularAjuste(banco.db, {
      ajusteId,
      motivo: "engano",
      feitoPor: adm.id,
    });
    expect(await anular(periodo.id)).toEqual({ ok: true, valor: null });
    const [p] = await periodosDe(aluno.id);
    expect(p).toMatchObject({ anuladoPor: adm.id, motivoAnulacao: "engano" });
    expect(await carregarPeriodosDoAluno(banco.db, aluno.id)).toEqual({
      periodos: [],
      trancamentos: [],
    });
    expect(await anular(periodo.id)).toEqual({
      ok: false,
      erros: { _: "Isso já foi anulado." },
    });
  });

  it("motivo vazio", async () => {
    const { periodo } = await alunoComPeriodo("2026-11-02", "2026-12-01");
    expect(await anular(periodo.id, "")).toEqual({
      ok: false,
      erros: { motivo: "Informe o motivo." },
    });
  });

  it("com uma extensão viva: lista o lançamento", async () => {
    const { aluno, periodo } = await alunoComPeriodo(
      "2026-11-02",
      "2026-12-01",
    );
    await estenderDias(aluno.id, 5);
    expect(await anular(periodo.id)).toEqual({
      ok: false,
      erros: {
        _: "Este período tem 1 lançamento: +5 dias (feriado). Anule-o antes.",
      },
    });
    expect((await periodosDe(aluno.id))[0].anuladoEm).toBeNull();
  });

  it("com dois lançamentos: plural, com a outra pessoa da transferência", async () => {
    const { aluno, periodo } = await alunoComPeriodo(
      "2026-11-02",
      "2026-12-01",
    );
    await estenderDias(aluno.id, 5);
    await transferir(periodo.id, "João Souza");
    expect(await anular(periodo.id)).toEqual({
      ok: false,
      erros: {
        _: "Este período tem 2 lançamentos: +5 dias (feriado) e −14 dias (transferidos para João Souza). Anule-os antes.",
      },
    });
  });

  it("com três lançamentos e um trancamento aberto", async () => {
    const { aluno, periodo } = await alunoComPeriodo(
      "2026-11-02",
      "2026-12-01",
    );
    await estenderDias(aluno.id, 5);
    await estenderDias(aluno.id, 1, "aula extra");
    await banco.db.insert(trancamentos).values({
      periodoId: periodo.id,
      inicio: "2026-11-25",
      criadoPor: adm.id,
    });
    expect(await anular(periodo.id)).toEqual({
      ok: false,
      erros: {
        _: "Este período tem 3 lançamentos: +5 dias (feriado), +1 dia (aula extra) e trancamento aberto desde 25/11. Anule-os antes.",
      },
    });
  });

  it("com dias recebidos numa transferência: nomeia quem cedeu", async () => {
    const { periodo } = await alunoComPeriodo("2026-11-02", "2026-12-01");
    await receber(periodo.id, "Ana Souza");
    expect(await anular(periodo.id)).toEqual({
      ok: false,
      erros: {
        _: "Este período tem 1 lançamento: +14 dias (recebidos de Ana Souza). Anule-o antes.",
      },
    });
  });

  it("aluno encerrado: anula o período sem lançamentos sem reabrir", async () => {
    const { aluno, periodo } = await alunoComPeriodo(
      "2026-11-02",
      "2026-12-01",
    );
    await encerrarAluno(banco.db, {
      alunoId: aluno.id,
      data: HOJE,
      feitoPor: adm.id,
    });
    expect(await anular(periodo.id)).toEqual({ ok: true, valor: null });
    expect(await carregarPeriodosDoAluno(banco.db, aluno.id)).toEqual({
      periodos: [],
      trancamentos: [],
    });
  });

  it("período que veio de uma transferência", async () => {
    const aluno = await criarAluno(banco.db);
    const [p] = await banco.db
      .insert(periodosContratados)
      .values({
        alunoId: aluno.id,
        inicio: "2026-11-22",
        fim: "2026-12-05",
        origem: "transferencia",
        criadoPor: adm.id,
      })
      .returning();
    expect(await anular(p.id)).toEqual({
      ok: false,
      erros: {
        _: "Este período veio de uma transferência. Anule a transferência.",
      },
    });
  });

  it("id desconhecido", async () => {
    expect(await anular("00000000-0000-0000-0000-000000000000")).toEqual({
      ok: false,
      erros: { _: "Período não encontrado." },
    });
  });
});
