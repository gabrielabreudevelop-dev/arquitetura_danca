import { and, eq, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  aulas,
  presencasAula,
  situacoesBolsista,
} from "@/servidor/banco/esquema";
import {
  desfazerNaoHouve,
  MENSAGEM_CHAMADA_MUDOU,
  MENSAGEM_CHAMADA_VAZIA,
  marcarNaoHouve,
  obterChamada,
  salvarChamada,
  turmasDoDia,
} from "@/servidor/bolsistas/chamada";
import { criarBancoDeTeste } from "../apoio/banco";
import {
  criarAdministracao,
  criarAluno,
  criarAula,
  criarBolsista,
  criarTurma,
  marcarPresenca,
} from "../apoio/fabricas";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
let adm: Awaited<ReturnType<typeof criarAdministracao>>;
const HOJE = "2026-11-26"; // quinta
const TER = "2026-11-24";
const QUI = "2026-11-26";
const QUA = "2026-11-25";

beforeAll(async () => {
  banco = await criarBancoDeTeste();
  adm = await criarAdministracao(banco.db);
});
afterAll(async () => {
  await banco.encerrar();
});

const turmaTerQui = () => criarTurma(banco.db, { dias: [2, 4] });
const bolsista = (
  o: Parameters<typeof criarBolsista>[1] extends infer T
    ? Partial<NonNullable<T>>
    : never = {},
) => criarBolsista(banco.db, { criadoPor: adm.id, ...o });

async function obter(turmaId: string, data: string) {
  const r = await obterChamada(banco.db, { turmaId, data }, HOJE);
  if (!r.ok) throw new Error(JSON.stringify(r.erros));
  return r.valor;
}
const salvar = (
  turmaId: string,
  data: string,
  presentes: string[],
  versao: number,
  extra: { confirmarVazia?: boolean } = {},
) =>
  salvarChamada(
    banco.db,
    { turmaId, data, presentes, versao, feitoPor: adm.id, ...extra },
    HOJE,
  );
const viva = (aulaId: string) =>
  banco.db
    .select()
    .from(presencasAula)
    .where(
      and(eq(presencasAula.aulaId, aulaId), isNull(presencasAula.desmarcadaEm)),
    );

describe("obterChamada", () => {
  it("lista combinados pelo acordo vigente na data", async () => {
    const turma = await turmaTerQui();
    const deTer = await bolsista({ dias: [2] });
    const deQui = await bolsista({ dias: [4] });
    const ter = await obter(turma.id, TER);
    const qui = await obter(turma.id, QUI);
    const ids = (l: { pessoaId: string }[]) => l.map((x) => x.pessoaId);
    expect(ids(ter.combinados)).toContain(deTer.id);
    expect(ids(ter.combinados)).not.toContain(deQui.id);
    expect(ids(qui.combinados)).toContain(deQui.id);
    expect(ids(qui.combinados)).not.toContain(deTer.id);
    expect(ter.aulaId).toBeNull();
    expect(ter.versao).toBe(0);
    expect(ter.situacao).toBe("sem_chamada");
    expect(ids(ter.disponiveis)).toContain(deQui.id);
  });

  it("disponíveis trazem a preferência, para a contagem na tela", async () => {
    const turma = await turmaTerQui();
    const b = await bolsista({ dias: [4], preferencia: "conduzir" });
    const ter = await obter(turma.id, TER);
    expect(ter.disponiveis.find((x) => x.pessoaId === b.id)).toEqual({
      pessoaId: b.id,
      nome: expect.any(String),
      preferencia: "conduzir",
    });
  });

  it("não lista inativos na data", async () => {
    const turma = await turmaTerQui();
    const b = await bolsista({ dias: [2] });
    await banco.db.insert(situacoesBolsista).values({
      pessoaId: b.id,
      tipo: "inativacao",
      data: "2026-11-10",
      criadoPor: adm.id,
    });
    const r = await obter(turma.id, TER);
    const todos = [...r.combinados, ...r.extras, ...r.disponiveis].map(
      (x) => x.pessoaId,
    );
    expect(todos).not.toContain(b.id);
  });

  it("extras: presença viva de quem não era combinado, inclusive inativo", async () => {
    const turma = await turmaTerQui();
    const extra = await bolsista({ dias: [4] });
    const inativo = await bolsista({ dias: [2] });
    const aula = await criarAula(banco.db, {
      turmaId: turma.id,
      data: TER,
      criadoPor: adm.id,
    });
    await marcarPresenca(banco.db, {
      aulaId: aula.id,
      pessoaId: extra.id,
      por: adm.id,
    });
    await marcarPresenca(banco.db, {
      aulaId: aula.id,
      pessoaId: inativo.id,
      por: adm.id,
    });
    await banco.db.insert(situacoesBolsista).values({
      pessoaId: inativo.id,
      tipo: "inativacao",
      data: "2026-11-20",
      criadoPor: adm.id,
    });
    const r = await obter(turma.id, TER);
    const ex = r.extras.map((x) => x.pessoaId);
    expect(ex).toContain(extra.id);
    expect(ex).toContain(inativo.id);
    expect(r.extras.every((x) => x.presente)).toBe(true);
    expect(r.aulaId).toBe(aula.id);
    expect(r.situacao).toBe("realizada");
    expect(r.versao).toBe(1);
  });

  it("conta por preferência quem veio", async () => {
    const turma = await turmaTerQui();
    const a = await bolsista({ preferencia: "conduzir" });
    const b = await bolsista({ preferencia: "conduzir" });
    const c = await bolsista({ preferencia: "ser_conduzido" });
    const d = await bolsista({ preferencia: "os_dois" });
    const e = await bolsista({ preferencia: "os_dois" });
    const aula = await criarAula(banco.db, {
      turmaId: turma.id,
      data: TER,
      criadoPor: adm.id,
    });
    for (const p of [a, b, c, d])
      await marcarPresenca(banco.db, {
        aulaId: aula.id,
        pessoaId: p.id,
        por: adm.id,
      });
    void e;
    const r = await obter(turma.id, TER);
    expect(r.contagem).toEqual({
      vieram: 4,
      conduzir: 2,
      ser_conduzido: 1,
      os_dois: 1,
    });
  });

  it("valida data, turma e dia da semana", async () => {
    const turma = await turmaTerQui();
    const erros = async (turmaId: string, data: string) => {
      const r = await obterChamada(banco.db, { turmaId, data }, HOJE);
      return r.ok ? {} : r.erros;
    };
    expect((await erros(turma.id, "2026-11-27")).data).toBe(
      "Não dá para fazer chamada de um dia que ainda não chegou.",
    );
    expect((await erros(turma.id, "2026-02-30")).data).toBe(
      "Informe uma data válida.",
    );
    expect((await erros(turma.id, QUA)).data).toBe(
      "Essa turma não tem aula nesse dia da semana.",
    );
    expect((await erros("não-é-uuid", TER)).turmaId).toBe(
      "Turma não encontrada.",
    );
    const inativa = await criarTurma(banco.db, { dias: [2], ativa: false });
    expect((await erros(inativa.id, TER)).turmaId).toBe(
      "Escolha uma turma ativa.",
    );
  });
});

describe("salvarChamada", () => {
  it("cria a aula e as presenças; salvar sem um desmarca e remarcar cria linha nova", async () => {
    const turma = await turmaTerQui();
    const a = await bolsista({ dias: [2] });
    const b = await bolsista({ dias: [2] });
    const r1 = await salvar(turma.id, TER, [a.id, b.id], 0);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.valor.versao).toBe(1);
    const aulaId = r1.valor.aulaId;
    const [aula] = await banco.db
      .select()
      .from(aulas)
      .where(eq(aulas.id, aulaId));
    expect(aula.situacao).toBe("realizada");
    expect(aula.chamadaSalvaPor).toBe(adm.id);
    expect(aula.chamadaSalvaEm).not.toBeNull();
    expect((await viva(aulaId)).length).toBe(2);

    // Cada salvamento grava quem salvou a chamada por último.
    const outro = await criarAdministracao(banco.db);
    const r2 = await salvarChamada(
      banco.db,
      {
        turmaId: turma.id,
        data: TER,
        presentes: [a.id],
        versao: 1,
        feitoPor: outro.id,
      },
      HOJE,
    );
    expect(r2.ok && r2.valor.versao).toBe(2);
    const [depois] = await banco.db
      .select()
      .from(aulas)
      .where(eq(aulas.id, aulaId));
    expect(depois.chamadaSalvaPor).toBe(outro.id);
    expect(depois.chamadaSalvaEm?.getTime()).toBeGreaterThanOrEqual(
      aula.chamadaSalvaEm?.getTime() ?? Number.POSITIVE_INFINITY,
    );
    const todas = await banco.db
      .select()
      .from(presencasAula)
      .where(eq(presencasAula.pessoaId, b.id));
    expect(todas).toHaveLength(1);
    expect(todas[0].desmarcadaEm).not.toBeNull();
    expect(todas[0].desmarcadaPor).toBe(outro.id);

    const r3 = await salvar(turma.id, TER, [a.id, b.id], 2);
    expect(r3.ok && r3.valor.versao).toBe(3);
    const deB = await banco.db
      .select()
      .from(presencasAula)
      .where(eq(presencasAula.pessoaId, b.id));
    expect(deB).toHaveLength(2);
    expect((await viva(aulaId)).length).toBe(2);
  });

  it("versão velha recusa e não muda nada", async () => {
    const turma = await turmaTerQui();
    const a = await bolsista();
    const b = await bolsista();
    const r1 = await salvar(turma.id, TER, [a.id], 0);
    expect(r1.ok).toBe(true);
    const velha = await salvar(turma.id, TER, [b.id], 0);
    expect(velha.ok).toBe(false);
    if (!velha.ok) expect(velha.erros._).toBe(MENSAGEM_CHAMADA_MUDOU);
    const velha2 = await salvar(turma.id, TER, [b.id], 5);
    expect(velha2.ok).toBe(false);
    if (!velha2.ok) expect(velha2.erros._).toBe(MENSAGEM_CHAMADA_MUDOU);
    if (r1.ok) {
      const v = await viva(r1.valor.aulaId);
      expect(v.map((p) => p.pessoaId)).toEqual([a.id]);
    }
  });

  it("duas chamadas simultâneas com a mesma versão: uma ok, outra recusada", async () => {
    const turma = await turmaTerQui();
    const a = await bolsista();
    const b = await bolsista();
    const [x, y] = await Promise.all([
      salvar(turma.id, TER, [a.id], 0),
      salvar(turma.id, TER, [b.id], 0),
    ]);
    expect([x.ok, y.ok].sort()).toEqual([false, true]);
    const falha = x.ok ? y : x;
    if (!falha.ok) expect(falha.erros._).toBe(MENSAGEM_CHAMADA_MUDOU);
    // Só a presença da transação vencedora existe (nem viva nem desmarcada).
    const vencedor = x.ok ? a : b;
    const perdedor = x.ok ? b : a;
    const ganhou = x.ok ? x : y;
    if (!ganhou.ok) throw new Error("nenhuma chamada salva");
    const todas = await banco.db
      .select()
      .from(presencasAula)
      .where(eq(presencasAula.aulaId, ganhou.valor.aulaId));
    expect(todas.map((p) => p.pessoaId)).toEqual([vencedor.id]);
    expect(todas.some((p) => p.pessoaId === perdedor.id)).toBe(false);

    const atual = await obter(turma.id, TER);
    const [p, q] = await Promise.all([
      salvar(turma.id, TER, [a.id, b.id], atual.versao),
      salvar(turma.id, TER, [], atual.versao, { confirmarVazia: true }),
    ]);
    expect([p.ok, q.ok].sort()).toEqual([false, true]);
    const perdeu = p.ok ? q : p;
    if (!perdeu.ok) expect(perdeu.erros._).toBe(MENSAGEM_CHAMADA_MUDOU);
    const vivas = (await viva(ganhou.valor.aulaId)).map((v) => v.pessoaId);
    // Ou valeu a lista com os dois, ou a vazia: nunca uma mistura das duas.
    if (p.ok) expect(vivas.sort()).toEqual([a.id, b.id].sort());
    else expect(vivas).toEqual([]);
  });

  it("acrescentar um disponível vira extra presente", async () => {
    const turma = await turmaTerQui();
    const combinado = await bolsista({ dias: [2] });
    const disponivel = await bolsista({ dias: [4] });
    const antes = await obter(turma.id, TER);
    expect(antes.disponiveis.map((d) => d.pessoaId)).toContain(disponivel.id);
    const r = await salvar(turma.id, TER, [combinado.id, disponivel.id], 0);
    expect(r.ok).toBe(true);
    const depois = await obter(turma.id, TER);
    expect(depois.extras.find((x) => x.pessoaId === disponivel.id)).toEqual({
      pessoaId: disponivel.id,
      nome: expect.any(String),
      preferencia: "os_dois",
      presente: true,
    });
    expect(depois.disponiveis.map((d) => d.pessoaId)).not.toContain(
      disponivel.id,
    );
    expect(
      depois.combinados.find((x) => x.pessoaId === combinado.id)?.presente,
    ).toBe(true);
  });

  it("lista vazia exige confirmação na primeira chamada, sem criar a aula", async () => {
    const turma = await turmaTerQui();
    const r = await salvar(turma.id, TER, [], 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros._).toBe(MENSAGEM_CHAMADA_VAZIA);
    const l = await banco.db
      .select()
      .from(aulas)
      .where(eq(aulas.turmaId, turma.id));
    expect(l).toHaveLength(0);

    const ok = await salvar(turma.id, TER, [], 0, { confirmarVazia: true });
    expect(ok.ok).toBe(true);
    const [aula] = await banco.db
      .select()
      .from(aulas)
      .where(eq(aulas.turmaId, turma.id));
    expect(aula.situacao).toBe("realizada");
    expect(await viva(aula.id)).toHaveLength(0);

    // resalvar uma chamada já vazia confirmada não pede confirmação de novo
    const de = await salvar(turma.id, TER, [], 1);
    expect(de.ok).toBe(true);
  });

  it("esvaziar quem estava presente exige confirmação", async () => {
    const turma = await turmaTerQui();
    const a = await bolsista();
    const r1 = await salvar(turma.id, TER, [a.id], 0);
    expect(r1.ok).toBe(true);
    const r2 = await salvar(turma.id, TER, [], 1);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.erros._).toBe(MENSAGEM_CHAMADA_VAZIA);
    const r3 = await salvar(turma.id, TER, [], 1, { confirmarVazia: true });
    expect(r3.ok).toBe(true);
    if (r1.ok) expect(await viva(r1.valor.aulaId)).toHaveLength(0);
  });

  it("só bolsistas, e só ativos para quem entra", async () => {
    const turma = await turmaTerQui();
    const aluno = await criarAluno(banco.db);
    const r = await salvar(turma.id, TER, [aluno.id], 0);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.erros.presentes).toBe("Só bolsistas podem receber presença.");
    const lixo = await salvar(turma.id, TER, ["x"], 0);
    expect(lixo.ok).toBe(false);
    if (!lixo.ok)
      expect(lixo.erros.presentes).toBe("Só bolsistas podem receber presença.");

    const inativo = await bolsista();
    await banco.db.insert(situacoesBolsista).values({
      pessoaId: inativo.id,
      tipo: "inativacao",
      data: "2026-11-20",
      criadoPor: adm.id,
    });
    const r2 = await salvar(turma.id, TER, [inativo.id], 0);
    expect(r2.ok).toBe(false);
    if (!r2.ok)
      expect(r2.erros.presentes).toBe(
        "Só bolsistas ativos nesse dia podem receber presença.",
      );
    const nada = await banco.db
      .select()
      .from(aulas)
      .where(eq(aulas.turmaId, turma.id));
    expect(nada).toHaveLength(0);
  });

  it("presença viva de inativo que continua na lista é mantida", async () => {
    const turma = await turmaTerQui();
    const inativo = await bolsista();
    const outro = await bolsista();
    const aula = await criarAula(banco.db, {
      turmaId: turma.id,
      data: TER,
      criadoPor: adm.id,
    });
    await marcarPresenca(banco.db, {
      aulaId: aula.id,
      pessoaId: inativo.id,
      por: adm.id,
    });
    await banco.db.insert(situacoesBolsista).values({
      pessoaId: inativo.id,
      tipo: "inativacao",
      data: "2026-11-20",
      criadoPor: adm.id,
    });
    const r = await salvar(turma.id, TER, [inativo.id, outro.id], 1);
    expect(r.ok).toBe(true);
    expect(await viva(aula.id)).toHaveLength(2);
  });

  it("aula nao_houve recusa", async () => {
    const turma = await turmaTerQui();
    const a = await bolsista();
    await criarAula(banco.db, {
      turmaId: turma.id,
      data: TER,
      situacao: "nao_houve",
      motivo: "feriado",
      criadoPor: adm.id,
    });
    const r = await salvar(turma.id, TER, [a.id], 1);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.erros._).toBe(
        "Esta aula está marcada como “não houve aula”. Desfaça antes.",
      );
  });

  it("valida data e turma", async () => {
    const turma = await turmaTerQui();
    const e = async (t: string, d: string) => {
      const r = await salvar(t, d, [], 0, { confirmarVazia: true });
      return r.ok ? {} : r.erros;
    };
    expect((await e(turma.id, "2026-11-27")).data).toBe(
      "Não dá para fazer chamada de um dia que ainda não chegou.",
    );
    expect((await e(turma.id, "2026-02-30")).data).toBe(
      "Informe uma data válida.",
    );
    expect((await e(turma.id, QUA)).data).toBe(
      "Essa turma não tem aula nesse dia da semana.",
    );
    expect((await e("x", TER)).turmaId).toBe("Turma não encontrada.");
  });
});

describe("não houve aula", () => {
  it("recusa com presença viva", async () => {
    const turma = await turmaTerQui();
    const a = await bolsista();
    const r1 = await salvar(turma.id, TER, [a.id], 0);
    expect(r1.ok).toBe(true);
    const r = await marcarNaoHouve(
      banco.db,
      { turmaId: turma.id, data: TER, motivo: "chuva", feitoPor: adm.id },
      HOJE,
    );
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.erros._).toBe(
        "Desmarque as presenças antes de marcar “não houve aula”.",
      );
  });

  it("motivo vazio recusa", async () => {
    const turma = await turmaTerQui();
    const r = await marcarNaoHouve(
      banco.db,
      { turmaId: turma.id, data: TER, motivo: "   ", feitoPor: adm.id },
      HOJE,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.motivo).toBe("Informe o motivo.");
  });

  it("cria a aula se não existir, e desfazer volta a ficar sem chamada", async () => {
    const turma = await turmaTerQui();
    const r = await marcarNaoHouve(
      banco.db,
      { turmaId: turma.id, data: TER, motivo: " feriado ", feitoPor: adm.id },
      HOJE,
    );
    expect(r.ok).toBe(true);
    const c = await obter(turma.id, TER);
    expect(c.situacao).toBe("nao_houve");
    expect(c.motivo).toBe("feriado");
    expect(c.versao).toBe(1);

    const d = await desfazerNaoHouve(
      banco.db,
      { turmaId: turma.id, data: TER, feitoPor: adm.id },
      HOJE,
    );
    expect(d.ok).toBe(true);
    const c2 = await obter(turma.id, TER);
    expect(c2.situacao).toBe("sem_chamada");
    expect(c2.motivo).toBeNull();
    expect(c2.versao).toBe(2);
    const [aula] = await banco.db
      .select()
      .from(aulas)
      .where(eq(aulas.turmaId, turma.id));
    expect(aula.chamadaSalvaEm).toBeNull();
    expect(aula.chamadaSalvaPor).toBeNull();

    const dia = await turmasDoDia(banco.db, TER, HOJE);
    expect(
      dia.ok && dia.valor.find((t) => t.turmaId === turma.id)?.situacao,
    ).toBe("sem_chamada");
  });

  it("depois de marcar e desfazer, a primeira chamada vazia ainda pede confirmação", async () => {
    const turma = await turmaTerQui();
    const m = await marcarNaoHouve(
      banco.db,
      { turmaId: turma.id, data: TER, motivo: "feriado", feitoPor: adm.id },
      HOJE,
    );
    expect(m.ok).toBe(true);
    const d = await desfazerNaoHouve(
      banco.db,
      { turmaId: turma.id, data: TER, feitoPor: adm.id },
      HOJE,
    );
    expect(d.ok && d.valor.versao).toBe(2);
    const vazia = await salvar(turma.id, TER, [], 2);
    expect(vazia.ok).toBe(false);
    if (!vazia.ok) expect(vazia.erros._).toBe(MENSAGEM_CHAMADA_VAZIA);

    const confirmada = await salvar(turma.id, TER, [], 2, {
      confirmarVazia: true,
    });
    expect(confirmada.ok && confirmada.valor.versao).toBe(3);
    const c = await obter(turma.id, TER);
    expect(c.situacao).toBe("realizada");
    // Chamada vazia já salva e confirmada: resalvar vazia não pergunta de novo.
    const de = await salvar(turma.id, TER, [], 3);
    expect(de.ok).toBe(true);
  });

  it("marcar em aula existente sem presença incrementa a versão", async () => {
    const turma = await turmaTerQui();
    const a = await bolsista();
    const r1 = await salvar(turma.id, TER, [a.id], 0);
    expect(r1.ok).toBe(true);
    const r2 = await salvar(turma.id, TER, [], 1, { confirmarVazia: true });
    expect(r2.ok).toBe(true);
    const r = await marcarNaoHouve(
      banco.db,
      { turmaId: turma.id, data: TER, motivo: "chuva", feitoPor: adm.id },
      HOJE,
    );
    expect(r.ok && r.valor.versao).toBe(3);
    const [aula] = await banco.db
      .select()
      .from(aulas)
      .where(eq(aulas.turmaId, turma.id));
    expect(aula.alteradoPor).toBe(adm.id);
    expect(aula.alteradoEm).not.toBeNull();
    // Marcar "não houve" não mexe no registro da chamada salva.
    const salvaEm = aula.chamadaSalvaEm;
    expect(salvaEm).not.toBeNull();
    expect(aula.chamadaSalvaPor).toBe(adm.id);
    const outro = await criarAdministracao(banco.db);
    const d = await desfazerNaoHouve(
      banco.db,
      { turmaId: turma.id, data: TER, feitoPor: outro.id },
      HOJE,
    );
    expect(d.ok).toBe(true);
    const [depois] = await banco.db
      .select()
      .from(aulas)
      .where(eq(aulas.turmaId, turma.id));
    expect(depois.chamadaSalvaEm).toEqual(salvaEm);
    expect(depois.chamadaSalvaPor).toBe(adm.id);
    expect(depois.alteradoPor).toBe(outro.id);
  });

  it("desfazer sem estar marcada recusa", async () => {
    const turma = await turmaTerQui();
    const d = await desfazerNaoHouve(
      banco.db,
      { turmaId: turma.id, data: TER, feitoPor: adm.id },
      HOJE,
    );
    expect(d.ok).toBe(false);
    if (!d.ok)
      expect(d.erros._).toBe(
        "Esta aula não está marcada como “não houve aula”.",
      );
  });
});

describe("turmasDoDia", () => {
  it("lista turmas ativas do dia por horário, com situação e presentes", async () => {
    const cedo = await criarTurma(banco.db, {
      dias: [0],
      horarioInicio: "08:00",
      horarioFim: "09:00",
    });
    const tarde = await criarTurma(banco.db, {
      dias: [0],
      horarioInicio: "17:00",
      horarioFim: "18:00",
    });
    const noite = await criarTurma(banco.db, {
      dias: [0],
      horarioInicio: "20:00",
      horarioFim: "21:00",
    });
    const inativaSem = await criarTurma(banco.db, { dias: [0], ativa: false });
    const inativaCom = await criarTurma(banco.db, {
      dias: [0],
      ativa: false,
      horarioInicio: "10:00",
      horarioFim: "11:00",
    });
    const outroDia = await criarTurma(banco.db, { dias: [1] });
    const dom = "2026-11-22";
    const a = await bolsista();
    const aulaTarde = await criarAula(banco.db, {
      turmaId: tarde.id,
      data: dom,
      criadoPor: adm.id,
    });
    await marcarPresenca(banco.db, {
      aulaId: aulaTarde.id,
      pessoaId: a.id,
      por: adm.id,
    });
    await criarAula(banco.db, {
      turmaId: noite.id,
      data: dom,
      situacao: "nao_houve",
      motivo: "chuva",
      criadoPor: adm.id,
    });
    await criarAula(banco.db, {
      turmaId: inativaCom.id,
      data: dom,
      criadoPor: adm.id,
    });

    const r = await turmasDoDia(banco.db, dom, HOJE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const mapa = new Map(r.valor.map((t) => [t.turmaId, t]));
    expect(mapa.has(inativaSem.id)).toBe(false);
    expect(mapa.has(outroDia.id)).toBe(false);
    expect(mapa.get(cedo.id)?.situacao).toBe("sem_chamada");
    expect(mapa.get(tarde.id)).toMatchObject({
      situacao: "realizada",
      presentes: 1,
    });
    expect(mapa.get(noite.id)).toMatchObject({
      situacao: "nao_houve",
      motivo: "chuva",
      presentes: 0,
    });
    expect(mapa.has(inativaCom.id)).toBe(true);
    const ordem = r.valor.map((t) => t.turmaId);
    expect(ordem.indexOf(cedo.id)).toBeLessThan(ordem.indexOf(inativaCom.id));
    expect(ordem.indexOf(inativaCom.id)).toBeLessThan(ordem.indexOf(tarde.id));
    expect(ordem.indexOf(tarde.id)).toBeLessThan(ordem.indexOf(noite.id));
    expect(mapa.get(cedo.id)?.rotulo).toContain("8h");
  });

  it("data inválida ou futura dá erros.data", async () => {
    const f = await turmasDoDia(banco.db, "2026-11-27", HOJE);
    expect(!f.ok && f.erros.data).toBe(
      "Não dá para fazer chamada de um dia que ainda não chegou.",
    );
    const i = await turmasDoDia(banco.db, "2026-02-30", HOJE);
    expect(!i.ok && i.erros.data).toBe("Informe uma data válida.");
  });
});
