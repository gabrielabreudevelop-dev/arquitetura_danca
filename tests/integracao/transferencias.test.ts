import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encerrarAluno, MENSAGEM_ENCERRADO } from "@/servidor/alunos/cadastro";
import { calcularEstado, fimEfetivo } from "@/servidor/alunos/estado";
import { carregarPeriodosDoAluno } from "@/servidor/alunos/periodos";
import { trancar } from "@/servidor/alunos/trancamentos";
import {
  anularTransferencia,
  transferir,
} from "@/servidor/alunos/transferencias";
import {
  ajustesPeriodo,
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

const HOJE = "2026-11-22";

beforeAll(async () => {
  banco = await criarBancoDeTeste();
  adm = await criarAdministracao(banco.db);
  plano = await criarPlano(banco.db);
});
afterAll(async () => {
  await banco.encerrar();
});

async function alunoComPeriodo(
  nome: string,
  inicio = "2026-11-01",
  fim = "2026-11-30",
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

const mover = (
  de: string,
  para: string,
  extra: Partial<Parameters<typeof transferir>[1]> = {},
) =>
  transferir(
    banco.db,
    {
      deAlunoId: de,
      paraAlunoId: para,
      quantidade: 5,
      unidade: "dias",
      motivo: "Viagem",
      feitoPor: adm.id,
      ...extra,
    },
    HOJE,
  );

async function moverOk(
  de: string,
  para: string,
  extra: Partial<Parameters<typeof transferir>[1]> = {},
) {
  const r = await mover(de, para, extra);
  if (!r.ok) throw new Error(JSON.stringify(r.erros));
  return r.valor;
}

const linhasDe = (transferenciaId: string) =>
  banco.db
    .select()
    .from(ajustesPeriodo)
    .where(eq(ajustesPeriodo.transferenciaId, transferenciaId));

const transferencia = async (id: string) => {
  const [t] = await banco.db
    .select()
    .from(transferencias)
    .where(eq(transferencias.id, id));
  return t;
};

const periodo = async (id: string) => {
  const [p] = await banco.db
    .select()
    .from(periodosContratados)
    .where(eq(periodosContratados.id, id));
  return p;
};

async function fimDoUltimo(alunoId: string) {
  const { periodos } = await carregarPeriodosDoAluno(banco.db, alunoId);
  const r = calcularEstado(
    { encerrado: false, periodos, trancamentos: [] },
    HOJE,
  );
  return r.ultimo?.fimEfetivo ?? null;
}

describe("transferir", () => {
  it("para quem está vigente: saída em quem cede e entrada em quem recebe, ligadas", async () => {
    const ana = await alunoComPeriodo("Ana Souza");
    const joao = await alunoComPeriodo(
      "João Souza",
      "2026-11-10",
      "2026-12-10",
    );
    const { transferenciaId, dias } = await moverOk(
      ana.aluno.id,
      joao.aluno.id,
    );
    expect(dias).toBe(5);
    const linhas = await linhasDe(transferenciaId);
    expect(linhas).toHaveLength(2);
    const saida = linhas.find((l) => l.tipo === "transferencia_saida");
    const entrada = linhas.find((l) => l.tipo === "transferencia_entrada");
    expect(saida).toMatchObject({
      periodoId: ana.periodo.id,
      dias: -5,
      motivo: "Viagem",
    });
    expect(entrada).toMatchObject({
      periodoId: joao.periodo.id,
      dias: 5,
      motivo: "Viagem",
    });
    expect(await fimDoUltimo(ana.aluno.id)).toBe("2026-11-25");
    expect(await fimDoUltimo(joao.aluno.id)).toBe("2026-12-15");
    expect(await transferencia(transferenciaId)).toMatchObject({
      periodoOrigemId: ana.periodo.id,
      periodoDestinoId: joao.periodo.id,
      dias: 5,
      motivo: "Viagem",
    });
  });

  it("para quem não tem período: cria o período da transferência, a partir do início escolhido", async () => {
    const ana = await alunoComPeriodo("Ana Souza");
    const bia = await criarAluno(banco.db, { nome: "Bia" });
    const { transferenciaId } = await moverOk(ana.aluno.id, bia.id, {
      inicioRecebedor: "2026-11-24",
    });
    const t = await transferencia(transferenciaId);
    const novo = await periodo(t.periodoDestinoId);
    expect(novo).toMatchObject({
      alunoId: bia.id,
      origem: "transferencia",
      planoId: null,
      inicio: "2026-11-24",
      fim: "2026-11-28",
    });
    const linhas = await linhasDe(transferenciaId);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ tipo: "transferencia_saida", dias: -5 });
  });

  it("sem início do recebedor, o período novo começa hoje", async () => {
    const ana = await alunoComPeriodo("Ana Souza");
    const bia = await criarAluno(banco.db, { nome: "Bia" });
    const { transferenciaId } = await moverOk(ana.aluno.id, bia.id);
    const t = await transferencia(transferenciaId);
    expect(await periodo(t.periodoDestinoId)).toMatchObject({
      inicio: HOJE,
      fim: "2026-11-26",
    });
  });

  it("recebedor com período vencido: cria período novo; o início não pode encostar no anterior", async () => {
    const ana = await alunoComPeriodo("Ana Souza");
    const caio = await alunoComPeriodo("Caio", "2026-09-01", "2026-10-31");
    const { transferenciaId } = await moverOk(ana.aluno.id, caio.aluno.id);
    expect(
      (await periodo((await transferencia(transferenciaId)).periodoDestinoId))
        .inicio,
    ).toBe(HOJE);

    const ana2 = await alunoComPeriodo("Ana Souza");
    const dani = await alunoComPeriodo("Dani", "2026-09-01", "2026-10-31");
    const r = await mover(ana2.aluno.id, dani.aluno.id, {
      inicioRecebedor: "2026-10-31",
    });
    expect(r).toEqual({
      ok: false,
      erros: {
        inicioRecebedor:
          "O período atual vai até 31/10. O novo precisa começar a partir de 01/11.",
      },
    });
  });

  it("recebedor trancado recebe na entrada do último período", async () => {
    const ana = await alunoComPeriodo("Ana Souza");
    const edu = await alunoComPeriodo("Edu", "2026-11-01", "2026-12-30");
    const t = await trancar(
      banco.db,
      { alunoId: edu.aluno.id, inicio: HOJE, feitoPor: adm.id },
      HOJE,
    );
    expect(t.ok).toBe(true);
    const { transferenciaId } = await moverOk(ana.aluno.id, edu.aluno.id);
    expect((await transferencia(transferenciaId)).periodoDestinoId).toBe(
      edu.periodo.id,
    );
    expect(await linhasDe(transferenciaId)).toHaveLength(2);
  });

  it("limita ao que resta do último período", async () => {
    const ana = await alunoComPeriodo("Ana Souza");
    const joao = await alunoComPeriodo("João Souza");
    const r = await mover(ana.aluno.id, joao.aluno.id, { quantidade: 10 });
    expect(r).toEqual({
      ok: false,
      erros: { quantidade: "Ana pode ceder até 9 dias." },
    });
  });

  it("com renovação futura, o limite é o do último período", async () => {
    const ana = await alunoComPeriodo("Ana Souza");
    await criarPeriodo(banco.db, {
      alunoId: ana.aluno.id,
      inicio: "2026-12-01",
      fim: "2026-12-10",
      criadoPor: adm.id,
      planoId: plano.id,
    });
    const joao = await alunoComPeriodo("João Souza");
    const r11 = await mover(ana.aluno.id, joao.aluno.id, { quantidade: 11 });
    expect(r11).toEqual({
      ok: false,
      erros: { quantidade: "Ana pode ceder até 10 dias." },
    });
    const r = await mover(ana.aluno.id, joao.aluno.id, { quantidade: 10 });
    expect(r.ok).toBe(true);
    expect(await fimDoUltimo(ana.aluno.id)).toBe("2026-12-01");
  });

  it("em aulas: 1 aula de uma turma de ter e qui vale 4 dias", async () => {
    const ana = await alunoComPeriodo("Ana Souza");
    const turma = await criarTurma(banco.db);
    await criarMatricula(banco.db, {
      alunoId: ana.aluno.id,
      turmaId: turma.id,
      entrada: "2026-11-02",
      criadoPor: adm.id,
    });
    const joao = await alunoComPeriodo("João Souza");
    const r = await mover(ana.aluno.id, joao.aluno.id, {
      quantidade: 1,
      unidade: "aulas",
    });
    expect(r.ok && r.valor.dias).toBe(4);
    if (!r.ok) return;
    const saida = (await linhasDe(r.valor.transferenciaId)).find(
      (l) => l.tipo === "transferencia_saida",
    );
    expect(saida).toMatchObject({
      dias: -4,
      quantidadeDigitada: 1,
      unidadeDigitada: "aulas",
      turmaConversaoId: turma.id,
    });
  });

  it.each([
    ["vencida", "2026-09-01", "2026-10-31"],
    ["que começa depois", "2026-12-05", "2026-12-31"],
  ])("cedente com período %s: bloqueia", async (_nome, inicio, fim) => {
    const ana = await alunoComPeriodo("Ana Souza", inicio, fim);
    const joao = await alunoComPeriodo("João Souza");
    expect(await mover(ana.aluno.id, joao.aluno.id)).toEqual({
      ok: false,
      erros: {
        _: "Só é possível transferir de um período vigente e não trancado.",
      },
    });
  });

  it("cedente sem período ou trancado: bloqueia", async () => {
    const joao = await alunoComPeriodo("João Souza");
    const sem = await criarAluno(banco.db, { nome: "Ana Souza" });
    const mensagem = {
      _: "Só é possível transferir de um período vigente e não trancado.",
    };
    expect(await mover(sem.id, joao.aluno.id)).toEqual({
      ok: false,
      erros: mensagem,
    });
    const ana = await alunoComPeriodo("Ana Souza");
    await trancar(
      banco.db,
      { alunoId: ana.aluno.id, inicio: HOJE, feitoPor: adm.id },
      HOJE,
    );
    expect(await mover(ana.aluno.id, joao.aluno.id)).toEqual({
      ok: false,
      erros: mensagem,
    });
  });

  it("não transfere para a mesma pessoa", async () => {
    const ana = await alunoComPeriodo("Ana Souza");
    expect(await mover(ana.aluno.id, ana.aluno.id)).toEqual({
      ok: false,
      erros: { paraAlunoId: "Escolha outra pessoa." },
    });
  });

  it("valida quantidade, unidade, motivo e data", async () => {
    const ana = await alunoComPeriodo("Ana Souza");
    const joao = await alunoComPeriodo("João Souza");
    const r = await mover(ana.aluno.id, joao.aluno.id, {
      quantidade: "0",
      unidade: "meses",
      motivo: "  ",
      inicioRecebedor: "31/11",
    });
    expect(r).toEqual({
      ok: false,
      erros: {
        quantidade: "Informe um número inteiro maior que zero.",
        unidade: "Escolha dias ou aulas.",
        motivo: "Informe o motivo.",
        inicioRecebedor: "Informe uma data válida.",
      },
    });
  });

  it("aluno encerrado, de qualquer lado, bloqueia", async () => {
    const ana = await alunoComPeriodo("Ana Souza");
    const joao = await alunoComPeriodo("João Souza");
    const enc = await alunoComPeriodo("Enc");
    await encerrarAluno(banco.db, {
      alunoId: enc.aluno.id,
      data: HOJE,
      feitoPor: adm.id,
    });
    expect(await mover(ana.aluno.id, enc.aluno.id)).toEqual({
      ok: false,
      erros: { _: MENSAGEM_ENCERRADO },
    });
    expect(await mover(enc.aluno.id, joao.aluno.id)).toEqual({
      ok: false,
      erros: { _: MENSAGEM_ENCERRADO },
    });
  });
});

describe("anularTransferencia", () => {
  const anular = (transferenciaId: string, motivo = "Engano") =>
    anularTransferencia(banco.db, {
      transferenciaId,
      motivo,
      feitoPor: adm.id,
    });

  it("com recebedor vigente: anula as duas linhas e a transferência", async () => {
    const ana = await alunoComPeriodo("Ana Souza");
    const joao = await alunoComPeriodo("João Souza");
    const { transferenciaId } = await moverOk(ana.aluno.id, joao.aluno.id);
    expect(await anular(transferenciaId)).toEqual({ ok: true, valor: null });
    const linhas = await linhasDe(transferenciaId);
    expect(linhas.every((l) => l.anuladoEm && l.anuladoPor === adm.id)).toBe(
      true,
    );
    expect(linhas.every((l) => l.motivoAnulacao === "Engano")).toBe(true);
    expect(await transferencia(transferenciaId)).toMatchObject({
      anuladoPor: adm.id,
      motivoAnulacao: "Engano",
    });
    expect(await fimDoUltimo(ana.aluno.id)).toBe("2026-11-30");
    expect(await fimDoUltimo(joao.aluno.id)).toBe("2026-11-30");
  });

  it("com período criado: anula a saída e o período", async () => {
    const ana = await alunoComPeriodo("Ana Souza");
    const bia = await criarAluno(banco.db, { nome: "Bia" });
    const { transferenciaId } = await moverOk(ana.aluno.id, bia.id);
    const destino = (await transferencia(transferenciaId)).periodoDestinoId;
    expect(await anular(transferenciaId)).toEqual({ ok: true, valor: null });
    expect((await periodo(destino)).anuladoEm).not.toBeNull();
    expect((await linhasDe(transferenciaId))[0].anuladoEm).not.toBeNull();
    expect(await fimDoUltimo(ana.aluno.id)).toBe("2026-11-30");
  });

  it("bloqueia se o período criado já tem outros lançamentos vivos", async () => {
    const ana = await alunoComPeriodo("Ana Souza");
    const bia = await criarAluno(banco.db, { nome: "Bia" });
    const { transferenciaId } = await moverOk(ana.aluno.id, bia.id);
    const destino = (await transferencia(transferenciaId)).periodoDestinoId;
    await banco.db.insert(ajustesPeriodo).values({
      periodoId: destino,
      tipo: "extensao",
      dias: 2,
      quantidadeDigitada: 2,
      unidadeDigitada: "dias",
      motivo: "Feriado",
      criadoPor: adm.id,
    });
    expect(await anular(transferenciaId)).toEqual({
      ok: false,
      erros: {
        _: "O período recebido já tem outros lançamentos. Anule-os antes.",
      },
    });
    expect((await transferencia(transferenciaId)).anuladoEm).toBeNull();
  });

  it("bloqueia se devolver os dias faria o período de Ana encostar no próximo", async () => {
    const ana = await alunoComPeriodo("Ana Souza");
    const joao = await alunoComPeriodo("João Souza");
    const { transferenciaId } = await moverOk(ana.aluno.id, joao.aluno.id);
    // Fim de Ana agora é 25/11; a renovação pode começar em 27/11.
    await criarPeriodo(banco.db, {
      alunoId: ana.aluno.id,
      inicio: "2026-11-27",
      fim: "2026-12-26",
      criadoPor: adm.id,
      planoId: plano.id,
    });
    expect(await anular(transferenciaId)).toEqual({
      ok: false,
      erros: {
        _: "Anular agora faria o período de Ana encostar no próximo. Anule ou corrija o próximo período antes.",
      },
    });
    expect((await transferencia(transferenciaId)).anuladoEm).toBeNull();
  });

  it("exige motivo, rejeita anular duas vezes e id inválido", async () => {
    const ana = await alunoComPeriodo("Ana Souza");
    const joao = await alunoComPeriodo("João Souza");
    const { transferenciaId } = await moverOk(ana.aluno.id, joao.aluno.id);
    expect(await anular(transferenciaId, " ")).toEqual({
      ok: false,
      erros: { motivo: "Informe o motivo." },
    });
    expect((await anular(transferenciaId)).ok).toBe(true);
    expect(await anular(transferenciaId)).toEqual({
      ok: false,
      erros: { _: "Isso já foi anulado." },
    });
    expect(await anular("nao-e-id")).toEqual({
      ok: false,
      erros: { _: "Transferência não encontrada." },
    });
  });

  it("vale mesmo com algum aluno encerrado", async () => {
    const ana = await alunoComPeriodo("Ana Souza");
    const joao = await alunoComPeriodo("João Souza");
    const { transferenciaId } = await moverOk(ana.aluno.id, joao.aluno.id);
    for (const id of [ana.aluno.id, joao.aluno.id]) {
      await encerrarAluno(banco.db, {
        alunoId: id,
        data: HOJE,
        feitoPor: adm.id,
      });
    }
    expect((await anular(transferenciaId)).ok).toBe(true);
  });

  it("a anulação da linha pela rota de ajuste continua bloqueada e o fim volta ao original", async () => {
    const ana = await alunoComPeriodo("Ana Souza");
    const joao = await alunoComPeriodo("João Souza");
    const { transferenciaId } = await moverOk(ana.aluno.id, joao.aluno.id);
    await anular(transferenciaId);
    const { periodos } = await carregarPeriodosDoAluno(banco.db, ana.aluno.id);
    expect(fimEfetivo(periodos[0])).toBe("2026-11-30");
  });
});
