import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { excluirAluno, tornarAluno } from "@/servidor/alunos/cadastro";
import {
  acordosBolsista,
  bolsistas,
  pessoaPapeis,
  pessoas,
  responsabilidades,
  situacoesBolsista,
} from "@/servidor/banco/esquema";
import {
  alterarDias,
  atualizarBolsista,
  cadastrarBolsista,
  type DadosBolsista,
  MENSAGEM_NAO_BOLSISTA,
  mudarSituacao,
  tornarBolsista,
} from "@/servidor/bolsistas/cadastro";
import { carregarBolsistas } from "@/servidor/bolsistas/carga";
import { normalizarWhatsapp } from "@/servidor/pessoas/normalizar";
import { criarBancoDeTeste } from "../apoio/banco";
import {
  criarAdministracao,
  criarAluno,
  criarBolsista,
} from "../apoio/fabricas";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
let adm: Awaited<ReturnType<typeof criarAdministracao>>;
const HOJE = "2026-11-22";

beforeAll(async () => {
  banco = await criarBancoDeTeste();
  adm = await criarAdministracao(banco.db);
});
afterAll(async () => {
  await banco.encerrar();
});

let contador = 0;
function zap() {
  contador += 1;
  return `(11) 97${String(contador).padStart(3, "0")}-${String(2000 + contador)}`;
}

const adulto = (): DadosBolsista => ({
  nome: "Caio Lima",
  nascimento: "1995-02-03",
  whatsapp: zap(),
  dias: [2, 4],
  preferencia: "conduzir",
});

async function criar(dados: DadosBolsista) {
  const r = await cadastrarBolsista(banco.db, dados, adm.id, HOJE);
  expect(r.ok).toBe(true);
  if (!r.ok || r.valor.tipo !== "criado") throw new Error("não criou");
  return r.valor.bolsistaId;
}

async function errosDe(dados: DadosBolsista) {
  const r = await cadastrarBolsista(banco.db, dados, adm.id, HOJE);
  expect(r.ok).toBe(false);
  return r.ok ? {} : r.erros;
}

const acordos = (id: string) =>
  banco.db
    .select()
    .from(acordosBolsista)
    .where(eq(acordosBolsista.pessoaId, id))
    .orderBy(asc(acordosBolsista.criadoEm));
const situacoes = (id: string) =>
  banco.db
    .select()
    .from(situacoesBolsista)
    .where(eq(situacoesBolsista.pessoaId, id))
    .orderBy(asc(situacoesBolsista.criadoEm));
async function papeis(id: string) {
  const l = await banco.db
    .select()
    .from(pessoaPapeis)
    .where(eq(pessoaPapeis.pessoaId, id));
  return l.map((p) => `${p.papel}:${p.ativo}`).sort();
}

describe("cadastrarBolsista", () => {
  it("grava pessoa, papel, ficha, situação e acordo", async () => {
    const id = await criar(adulto());
    expect(await papeis(id)).toEqual(["bolsista:true"]);
    const [b] = await banco.db
      .select()
      .from(bolsistas)
      .where(eq(bolsistas.pessoaId, id));
    expect(b.preferencia).toBe("conduzir");
    const [s] = await situacoes(id);
    expect(s).toMatchObject({
      tipo: "ativacao",
      data: HOJE,
      criadoPor: adm.id,
    });
    const [a] = await acordos(id);
    expect(a).toMatchObject({ dias: [2, 4], vigenteDesde: HOJE });
  });

  it("normaliza os dias: sem repetidos e ordenados", async () => {
    const id = await criar({ ...adulto(), dias: [4, 2, 2] });
    expect((await acordos(id))[0].dias).toEqual([2, 4]);
  });

  it("exige ao menos um dia, entre 0 e 6", async () => {
    for (const dias of [[], [7], [-1], [1.5]]) {
      expect((await errosDe({ ...adulto(), dias })).dias).toBe(
        "Escolha ao menos um dia.",
      );
    }
  });

  it("exige uma preferência válida", async () => {
    expect((await errosDe({ ...adulto(), preferencia: "x" })).preferencia).toBe(
      "Escolha uma preferência.",
    );
  });

  it("menor exige responsável (mensagens do cadastro de alunos)", async () => {
    const menor = { ...adulto(), nascimento: "2015-03-01", whatsapp: "" };
    expect((await errosDe(menor)).responsavel).toBe("Informe o responsável.");
    const id = await criar({
      ...menor,
      responsavel: { nome: "Mãe", whatsapp: zap() },
    });
    expect(await papeis(id)).toEqual(["bolsista:true"]);
  });

  it("e-mail de um aluno existente devolve pessoa-existente", async () => {
    const aluno = await criarAluno(banco.db, {
      email: `aluno-${zap().replace(/\D/g, "")}@exemplo.dev`,
    });
    const r = await cadastrarBolsista(
      banco.db,
      { ...adulto(), email: aluno.email ?? undefined },
      adm.id,
      HOJE,
    );
    expect(r).toEqual({
      ok: true,
      valor: {
        tipo: "pessoa-existente",
        pessoaId: aluno.id,
        nome: aluno.nome,
        jaBolsista: false,
      },
    });
  });

  it("e-mail de um bolsista existente devolve jaBolsista: true", async () => {
    const b = await criarBolsista(banco.db, { criadoPor: adm.id });
    await banco.db
      .update(pessoas)
      .set({ email: "bolsista-existente@exemplo.dev" })
      .where(eq(pessoas.id, b.id));
    const r = await cadastrarBolsista(
      banco.db,
      { ...adulto(), email: "Bolsista-Existente@exemplo.dev" },
      adm.id,
      HOJE,
    );
    expect(r.ok && r.valor).toMatchObject({
      tipo: "pessoa-existente",
      jaBolsista: true,
    });
  });

  it("WhatsApp de outra pessoa pede confirmação; confirmando, grava", async () => {
    const numero = zap();
    const outra = await criarAluno(banco.db, {
      whatsapp: normalizarWhatsapp(numero),
    });
    const dados = { ...adulto(), whatsapp: numero };
    const r = await cadastrarBolsista(banco.db, dados, adm.id, HOJE);
    expect(r.ok && r.valor).toMatchObject({
      tipo: "whatsapp-repetido",
      pessoaId: outra.id,
    });
    const c = await cadastrarBolsista(
      banco.db,
      { ...dados, confirmarWhatsappRepetido: true },
      adm.id,
      HOJE,
    );
    expect(c.ok && c.valor.tipo).toBe("criado");
  });
});

describe("tornarBolsista", () => {
  it("dá o papel sem duplicar a pessoa (continua aluno)", async () => {
    const aluno = await criarAluno(banco.db);
    const r = await tornarBolsista(
      banco.db,
      {
        pessoaId: aluno.id,
        dias: [5, 1],
        preferencia: "ser_conduzido",
        feitoPor: adm.id,
      },
      HOJE,
    );
    expect(r.ok).toBe(true);
    expect(await papeis(aluno.id)).toEqual(["aluno:true", "bolsista:true"]);
    expect((await acordos(aluno.id))[0].dias).toEqual([1, 5]);
    expect((await situacoes(aluno.id))[0].tipo).toBe("ativacao");
    const [b] = await banco.db
      .select()
      .from(bolsistas)
      .where(eq(bolsistas.pessoaId, aluno.id));
    expect(b.preferencia).toBe("ser_conduzido");
  });

  it("recusa quem já é bolsista", async () => {
    const b = await criarBolsista(banco.db, { criadoPor: adm.id });
    const r = await tornarBolsista(
      banco.db,
      { pessoaId: b.id, dias: [1], preferencia: "os_dois", feitoPor: adm.id },
      HOJE,
    );
    expect(r).toEqual({
      ok: false,
      erros: { _: "Esta pessoa já é bolsista." },
    });
  });

  it("valida dias, preferência e pessoa", async () => {
    const aluno = await criarAluno(banco.db);
    const base = {
      pessoaId: aluno.id,
      dias: [1],
      preferencia: "os_dois",
      feitoPor: adm.id,
    };
    const r1 = await tornarBolsista(banco.db, { ...base, dias: [] }, HOJE);
    expect(!r1.ok && r1.erros.dias).toBe("Escolha ao menos um dia.");
    const r2 = await tornarBolsista(
      banco.db,
      { ...base, preferencia: "?" },
      HOJE,
    );
    expect(!r2.ok && r2.erros.preferencia).toBe("Escolha uma preferência.");
    const r3 = await tornarBolsista(
      banco.db,
      { ...base, pessoaId: "00000000-0000-4000-8000-000000000000" },
      HOJE,
    );
    expect(!r3.ok && r3.erros._).toBe("Pessoa não encontrada.");
  });
});

describe("atualizarBolsista", () => {
  it("muda dados e preferência sem tocar nos dias", async () => {
    const id = await criar(adulto());
    const r = await atualizarBolsista(
      banco.db,
      id,
      {
        nome: "Caio Novo",
        nascimento: "1995-02-03",
        whatsapp: zap(),
        preferencia: "os_dois",
      },
      HOJE,
    );
    expect(r.ok).toBe(true);
    const [p] = await banco.db.select().from(pessoas).where(eq(pessoas.id, id));
    expect(p.nome).toBe("Caio Novo");
    const [b] = await banco.db
      .select()
      .from(bolsistas)
      .where(eq(bolsistas.pessoaId, id));
    expect(b.preferencia).toBe("os_dois");
    expect(await acordos(id)).toHaveLength(1);
  });

  it("recusa preferência inválida e quem não é bolsista", async () => {
    const id = await criar(adulto());
    const dados = { nome: "X", nascimento: "1995-02-03", whatsapp: zap() };
    const r = await atualizarBolsista(
      banco.db,
      id,
      { ...dados, preferencia: "?" },
      HOJE,
    );
    expect(!r.ok && r.erros.preferencia).toBe("Escolha uma preferência.");
    const aluno = await criarAluno(banco.db);
    const n = await atualizarBolsista(
      banco.db,
      aluno.id,
      { ...dados, preferencia: "os_dois" },
      HOJE,
    );
    expect(n).toEqual({ ok: false, erros: { _: MENSAGEM_NAO_BOLSISTA } });
  });
});

describe("responsável na atualização", () => {
  const dadosMenor = () => ({
    nome: "Bia Menor",
    nascimento: "2015-03-01",
    preferencia: "os_dois",
  });
  it("menor sem responsável ligado exige o responsável", async () => {
    const b = await criarBolsista(banco.db, {
      criadoPor: adm.id,
      nascimento: "2015-03-01",
    });
    const r = await atualizarBolsista(banco.db, b.id, dadosMenor(), HOJE);
    expect(!r.ok && r.erros.responsavel).toBe("Informe o responsável.");
  });

  it("o mesmo responsável já ligado não cria ligação nova", async () => {
    const id = await criar({
      ...adulto(),
      nascimento: "2015-03-01",
      whatsapp: "",
      responsavel: { nome: "Mãe", whatsapp: zap() },
    });
    const antes = await banco.db
      .select()
      .from(responsabilidades)
      .where(eq(responsabilidades.alunoId, id));
    expect(antes).toHaveLength(1);
    const r = await atualizarBolsista(
      banco.db,
      id,
      {
        ...dadosMenor(),
        responsavel: { pessoaId: antes[0].responsavelId },
      },
      HOJE,
    );
    expect(r.ok).toBe(true);
    const depois = await banco.db
      .select()
      .from(responsabilidades)
      .where(eq(responsabilidades.alunoId, id));
    expect(depois).toEqual(antes);
  });
});

describe("alterarDias", () => {
  it("cria uma versão nova e a antiga fica", async () => {
    const id = await criar(adulto());
    const r = await alterarDias(
      banco.db,
      {
        pessoaId: id,
        dias: [3, 1, 3],
        vigenteDesde: "2026-11-22",
        feitoPor: adm.id,
      },
      HOJE,
    );
    expect(r.ok).toBe(true);
    const l = await acordos(id);
    expect(l.map((a) => a.dias)).toEqual([
      [2, 4],
      [1, 3],
    ]);
  });

  it("recusa data inválida ou futura", async () => {
    const id = await criar(adulto());
    const r = await alterarDias(
      banco.db,
      { pessoaId: id, dias: [1], vigenteDesde: "2026-11-23", feitoPor: adm.id },
      HOJE,
    );
    expect(!r.ok && r.erros.vigenteDesde).toBe(
      "A data não pode ser no futuro.",
    );
    const r2 = await alterarDias(
      banco.db,
      { pessoaId: id, dias: [1], vigenteDesde: "ontem", feitoPor: adm.id },
      HOJE,
    );
    expect(!r2.ok && r2.erros.vigenteDesde).toBe("Informe uma data válida.");
  });

  it("recusa dias vazios ou inválidos e quem não é bolsista", async () => {
    const id = await criar(adulto());
    const r = await alterarDias(
      banco.db,
      { pessoaId: id, dias: [], vigenteDesde: HOJE, feitoPor: adm.id },
      HOJE,
    );
    expect(!r.ok && r.erros.dias).toBe("Escolha ao menos um dia.");
    const aluno = await criarAluno(banco.db);
    const n = await alterarDias(
      banco.db,
      { pessoaId: aluno.id, dias: [1], vigenteDesde: HOJE, feitoPor: adm.id },
      HOJE,
    );
    expect(n).toEqual({ ok: false, erros: { _: MENSAGEM_NAO_BOLSISTA } });
  });

  it("mesma data de uma versão existente cria versão nova", async () => {
    const id = await criar(adulto());
    const r = await alterarDias(
      banco.db,
      { pessoaId: id, dias: [5], vigenteDesde: HOJE, feitoPor: adm.id },
      HOJE,
    );
    expect(r.ok).toBe(true);
    expect(await acordos(id)).toHaveLength(2);
  });

  it("recusa os mesmos dias da versão vigente na data", async () => {
    const id = await criar(adulto());
    const r = await alterarDias(
      banco.db,
      { pessoaId: id, dias: [4, 2], vigenteDesde: HOJE, feitoPor: adm.id },
      HOJE,
    );
    expect(!r.ok && r.erros.dias).toBe(
      "Esses já são os dias combinados nessa data.",
    );
    expect(await acordos(id)).toHaveLength(1);
  });
});

describe("mudarSituacao", () => {
  it("inativa e reativa, atualizando o papel e registrando", async () => {
    const id = await criar(adulto());
    const i = await mudarSituacao(
      banco.db,
      {
        pessoaId: id,
        tipo: "inativacao",
        data: "2026-11-22",
        motivo: " viagem ",
        feitoPor: adm.id,
      },
      HOJE,
    );
    expect(i.ok).toBe(true);
    expect(await papeis(id)).toEqual(["bolsista:false"]);
    const ss = await situacoes(id);
    expect(ss.map((s) => s.tipo)).toEqual(["ativacao", "inativacao"]);
    expect(ss[1].motivo).toBe("viagem");
    const a = await mudarSituacao(
      banco.db,
      { pessoaId: id, tipo: "ativacao", data: "2026-11-22", feitoPor: adm.id },
      HOJE,
    );
    expect(a.ok).toBe(true);
    expect(await papeis(id)).toEqual(["bolsista:true"]);
    expect(await situacoes(id)).toHaveLength(3);
  });

  it("recusa a situação atual", async () => {
    const id = await criar(adulto());
    const a = await mudarSituacao(
      banco.db,
      { pessoaId: id, tipo: "ativacao", data: HOJE, feitoPor: adm.id },
      HOJE,
    );
    expect(a).toEqual({ ok: false, erros: { _: "O bolsista já está ativo." } });
    await mudarSituacao(
      banco.db,
      { pessoaId: id, tipo: "inativacao", data: HOJE, feitoPor: adm.id },
      HOJE,
    );
    const i = await mudarSituacao(
      banco.db,
      { pessoaId: id, tipo: "inativacao", data: HOJE, feitoPor: adm.id },
      HOJE,
    );
    expect(i).toEqual({
      ok: false,
      erros: { _: "O bolsista já está inativo." },
    });
  });

  it("valida a data: inválida, futura, antes da última mudança", async () => {
    const id = await criar(adulto());
    const base = {
      pessoaId: id,
      tipo: "inativacao" as const,
      feitoPor: adm.id,
    };
    const r1 = await mudarSituacao(banco.db, { ...base, data: "" }, HOJE);
    expect(!r1.ok && r1.erros.data).toBe("Informe uma data válida.");
    const r2 = await mudarSituacao(
      banco.db,
      { ...base, data: "2026-11-23" },
      HOJE,
    );
    expect(!r2.ok && r2.erros.data).toBe("A data não pode ser no futuro.");
    const r3 = await mudarSituacao(
      banco.db,
      { ...base, data: "2026-11-10" },
      HOJE,
    );
    expect(!r3.ok && r3.erros.data).toBe(
      "A data não pode ser antes da última mudança (22/11).",
    );
  });

  it("recusa quem não é bolsista", async () => {
    const aluno = await criarAluno(banco.db);
    const r = await mudarSituacao(
      banco.db,
      { pessoaId: aluno.id, tipo: "inativacao", data: HOJE, feitoPor: adm.id },
      HOJE,
    );
    expect(r).toEqual({ ok: false, erros: { _: MENSAGEM_NAO_BOLSISTA } });
  });
});

describe("excluir o aluno de quem também é bolsista", () => {
  it("mantém o responsável do bolsista menor como pessoa de contato", async () => {
    const id = await criar({
      ...adulto(),
      nascimento: "2014-05-06",
      whatsapp: "",
      responsavel: { nome: "Rita Mãe", whatsapp: zap() },
    });
    const [ligacao] = await banco.db
      .select()
      .from(responsabilidades)
      .where(eq(responsabilidades.alunoId, id));
    expect(ligacao).toBeDefined();
    expect((await tornarAluno(banco.db, id)).ok).toBe(true);
    expect(await papeis(id)).toEqual(["aluno:true", "bolsista:true"]);

    expect(await excluirAluno(banco.db, id)).toEqual({ ok: true, valor: null });

    expect(await papeis(id)).toEqual(["bolsista:true"]);
    const depois = await banco.db
      .select()
      .from(responsabilidades)
      .where(eq(responsabilidades.alunoId, id));
    expect(depois).toEqual([ligacao]);
    const [carregado] = await carregarBolsistas(banco.db, HOJE, { ids: [id] });
    expect(carregado.contato).toMatchObject({
      pessoaId: ligacao.responsavelId,
      nome: "Rita Mãe",
      ehResponsavel: true,
    });
    expect(carregado.contato.whatsapp).not.toBeNull();
  });
});
