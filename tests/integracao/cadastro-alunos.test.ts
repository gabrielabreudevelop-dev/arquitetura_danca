import { and, eq, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  alunoAtivoOuErro,
  atualizarAluno,
  cadastrarAluno,
  encerrarAluno,
  excluirAluno,
  MENSAGEM_ENCERRADO,
  podeExcluirAluno,
  reabrirAluno,
  tornarAluno,
} from "@/servidor/alunos/cadastro";
import {
  encerramentosAluno,
  matriculas,
  pessoaPapeis,
  pessoas,
  responsabilidades,
} from "@/servidor/banco/esquema";
import { MENSAGEM_EM_USO } from "@/servidor/cadastros/resultado";
import { criarBancoDeTeste } from "../apoio/banco";
import {
  criarAdministracao,
  criarAluno,
  criarMatricula,
  criarPeriodo,
  criarPlano,
  criarProfessor,
  criarTurma,
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
/** WhatsApp válido e único em cada chamada. */
function zap() {
  contador += 1;
  return `(11) 98${String(contador).padStart(3, "0")}-${String(1000 + contador)}`;
}

async function papeisDe(pessoaId: string) {
  const linhas = await banco.db
    .select()
    .from(pessoaPapeis)
    .where(eq(pessoaPapeis.pessoaId, pessoaId));
  return linhas.map((l) => `${l.papel}:${l.ativo}`).sort();
}

const adulto = () => ({
  nome: "Ana Souza",
  nascimento: "1990-05-10",
  whatsapp: zap(),
});

async function erros(dados: Parameters<typeof cadastrarAluno>[1]) {
  const r = await cadastrarAluno(banco.db, dados, adm.id, HOJE);
  expect(r.ok).toBe(false);
  return r.ok ? {} : r.erros;
}

describe("validação do cadastro", () => {
  it("exige o nome", async () => {
    expect((await erros({ ...adulto(), nome: "  " })).nome).toBe(
      "Informe o nome.",
    );
  });
  it("exige a data de nascimento", async () => {
    expect((await erros({ ...adulto(), nascimento: "" })).nascimento).toBe(
      "Informe a data de nascimento.",
    );
    expect(
      (await erros({ ...adulto(), nascimento: "2026-02-30" })).nascimento,
    ).toBe("Informe a data de nascimento.");
  });
  it("recusa nascimento no futuro", async () => {
    expect(
      (await erros({ ...adulto(), nascimento: "2026-11-23" })).nascimento,
    ).toBe("A data de nascimento não pode ser no futuro.");
  });
  it("adulto exige WhatsApp", async () => {
    expect((await erros({ ...adulto(), whatsapp: "" })).whatsapp).toBe(
      "Informe o WhatsApp.",
    );
  });
  it("recusa WhatsApp inválido", async () => {
    expect((await erros({ ...adulto(), whatsapp: "123" })).whatsapp).toBe(
      "WhatsApp inválido. Use DDD e número.",
    );
  });
  it("recusa Instagram inválido", async () => {
    expect(
      (await erros({ ...adulto(), instagram: "https://outro.com/x" }))
        .instagram,
    ).toBe("Instagram inválido.");
  });
  it("menor exige responsável com nome e WhatsApp, mas não o próprio WhatsApp", async () => {
    const menor = { nome: "Bia", nascimento: "2015-03-01" };
    expect((await erros(menor)).responsavel).toBe("Informe o responsável.");
    expect(
      (await erros({ ...menor, responsavel: { novo: true, nome: "Carla" } }))[
        "responsavel.whatsapp"
      ],
    ).toBe("Informe o WhatsApp do responsável.");
    expect(
      (await erros({ ...menor, responsavel: { novo: true, whatsapp: zap() } }))
        .responsavel,
    ).toBe("Informe o responsável.");
  });
  it("recusa turma inativa", async () => {
    const turma = await criarTurma(banco.db, { ativa: false });
    expect((await erros({ ...adulto(), turmaIds: [turma.id] })).turmaIds).toBe(
      "Escolha turmas ativas.",
    );
  });
});

describe("cadastrarAluno", () => {
  it("adulto com duas turmas: pessoa, papel e duas matrículas abertas com entrada hoje", async () => {
    const t1 = await criarTurma(banco.db);
    const t2 = await criarTurma(banco.db);
    const r = await cadastrarAluno(
      banco.db,
      {
        ...adulto(),
        whatsapp: "(27) 99999-0000",
        instagram: "@Ana.Souza",
        email: " ANA@exemplo.dev ",
        turmaIds: [t1.id, t2.id],
        responsavel: { novo: true, nome: "Ignorada", whatsapp: zap() },
      },
      adm.id,
      HOJE,
    );
    expect(r.ok && r.valor.tipo).toBe("criado");
    if (!r.ok || r.valor.tipo !== "criado") return;
    const [aluno] = await banco.db
      .select()
      .from(pessoas)
      .where(eq(pessoas.id, r.valor.alunoId));
    expect(aluno).toMatchObject({
      whatsapp: "5527999990000",
      instagram: "ana.souza",
      email: "ana@exemplo.dev",
      dataNascimento: "1990-05-10",
    });
    expect(await papeisDe(aluno.id)).toEqual(["aluno:true"]);
    const m = await banco.db
      .select()
      .from(matriculas)
      .where(eq(matriculas.alunoId, aluno.id));
    expect(m).toHaveLength(2);
    expect(
      m.every(
        (x) => x.entrada === HOJE && x.saida === null && x.criadoPor === adm.id,
      ),
    ).toBe(true);
    const lig = await banco.db
      .select()
      .from(responsabilidades)
      .where(eq(responsabilidades.alunoId, aluno.id));
    expect(lig).toHaveLength(0);
  });

  it("menor com responsável novo grava as duas pessoas, os dois papéis e a ligação", async () => {
    const wr = zap();
    const r = await cadastrarAluno(
      banco.db,
      {
        nome: "Bia",
        nascimento: "2015-03-01",
        responsavel: { novo: true, nome: "Carla Lima", whatsapp: wr },
      },
      adm.id,
      HOJE,
    );
    if (!r.ok || r.valor.tipo !== "criado") throw new Error("esperava criado");
    const [lig] = await banco.db
      .select()
      .from(responsabilidades)
      .where(eq(responsabilidades.alunoId, r.valor.alunoId));
    expect(lig).toBeTruthy();
    expect(await papeisDe(r.valor.alunoId)).toEqual(["aluno:true"]);
    expect(await papeisDe(lig.responsavelId)).toEqual(["responsavel:true"]);
    const [resp] = await banco.db
      .select()
      .from(pessoas)
      .where(eq(pessoas.id, lig.responsavelId));
    expect(resp.nome).toBe("Carla Lima");
  });

  it("segundo filho com responsavel.pessoaId reaproveita a mesma pessoa", async () => {
    const r1 = await cadastrarAluno(
      banco.db,
      {
        nome: "Filho 1",
        nascimento: "2014-01-01",
        responsavel: { novo: true, nome: "Mãe", whatsapp: zap() },
      },
      adm.id,
      HOJE,
    );
    if (!r1.ok || r1.valor.tipo !== "criado") throw new Error();
    const [lig] = await banco.db
      .select()
      .from(responsabilidades)
      .where(eq(responsabilidades.alunoId, r1.valor.alunoId));
    const r2 = await cadastrarAluno(
      banco.db,
      {
        nome: "Filho 2",
        nascimento: "2016-01-01",
        responsavel: { pessoaId: lig.responsavelId },
      },
      adm.id,
      HOJE,
    );
    if (!r2.ok || r2.valor.tipo !== "criado") throw new Error();
    const filhos = await banco.db
      .select()
      .from(responsabilidades)
      .where(eq(responsabilidades.responsavelId, lig.responsavelId));
    expect(filhos.map((f) => f.alunoId).sort()).toEqual(
      [r1.valor.alunoId, r2.valor.alunoId].sort(),
    );
  });

  it("responsavel.pessoaId inexistente ou o próprio aluno é recusado", async () => {
    const e = await erros({
      nome: "X",
      nascimento: "2015-01-01",
      responsavel: { pessoaId: "11111111-1111-4111-8111-111111111111" },
    });
    expect(e["responsavel.pessoaId"]).toBe("Responsável não encontrado.");
    const aluno = await criarAluno(banco.db, {
      nascimento: "2015-01-01",
      responsavelId: (await criarProfessor(banco.db)).id,
    });
    const r = await atualizarAluno(
      banco.db,
      aluno.id,
      {
        nome: "Y",
        nascimento: "2015-01-01",
        responsavel: { pessoaId: aluno.id },
      },
      HOJE,
    );
    expect(r.ok ? null : r.erros["responsavel.pessoaId"]).toBe(
      "Responsável não encontrado.",
    );
  });

  it("responsável sem pessoaId e sem novo: devolve existente (por e-mail ou WhatsApp único) sem gravar", async () => {
    const mae = await criarAluno(banco.db, {
      nome: "Dona Rita",
      email: "rita@exemplo.dev",
      whatsapp: "5511977770001",
    });
    const antes = await banco.db.select().from(pessoas);
    const porEmail = await cadastrarAluno(
      banco.db,
      {
        nome: "Filho",
        nascimento: "2015-01-01",
        responsavel: {
          nome: "Rita",
          whatsapp: zap(),
          email: "RITA@exemplo.dev",
        },
      },
      adm.id,
      HOJE,
    );
    expect(porEmail).toEqual({
      ok: true,
      valor: {
        tipo: "responsavel-existente",
        pessoaId: mae.id,
        nome: "Dona Rita",
      },
    });
    const porZap = await cadastrarAluno(
      banco.db,
      {
        nome: "Filho",
        nascimento: "2015-01-01",
        responsavel: { nome: "Rita", whatsapp: "(11) 97777-0001" },
      },
      adm.id,
      HOJE,
    );
    expect(porZap).toEqual({
      ok: true,
      valor: {
        tipo: "responsavel-existente",
        pessoaId: mae.id,
        nome: "Dona Rita",
      },
    });
    expect(await banco.db.select().from(pessoas)).toHaveLength(antes.length);
  });

  it("e-mail de outra pessoa no cadastro devolve pessoa-existente sem gravar", async () => {
    const prof = await criarProfessor(banco.db, { email: "prof@exemplo.dev" });
    const r = await cadastrarAluno(
      banco.db,
      { ...adulto(), email: "Prof@exemplo.dev" },
      adm.id,
      HOJE,
    );
    expect(r).toEqual({
      ok: true,
      valor: {
        tipo: "pessoa-existente",
        pessoaId: prof.id,
        nome: prof.nome,
        jaAluno: false,
      },
    });
    const t = await tornarAluno(banco.db, prof.id);
    expect(t.ok).toBe(true);
    expect(await papeisDe(prof.id)).toEqual(["aluno:true", "professor:true"]);
    const r2 = await cadastrarAluno(
      banco.db,
      { ...adulto(), email: "prof@exemplo.dev" },
      adm.id,
      HOJE,
    );
    expect(
      r2.ok && r2.valor.tipo === "pessoa-existente" && r2.valor.jaAluno,
    ).toBe(true);
  });

  it("WhatsApp igual ao de outra pessoa pede confirmação; confirmado, grava", async () => {
    const outra = await criarAluno(banco.db, {
      nome: "Mãe Ana",
      whatsapp: "5511966660001",
    });
    const dados = {
      nome: "Filha",
      nascimento: "1995-01-01",
      whatsapp: "(11) 96666-0001",
    };
    const antes = await banco.db.select().from(pessoas);
    const r = await cadastrarAluno(banco.db, dados, adm.id, HOJE);
    expect(r).toEqual({
      ok: true,
      valor: { tipo: "whatsapp-repetido", pessoaId: outra.id, nome: "Mãe Ana" },
    });
    expect(await banco.db.select().from(pessoas)).toHaveLength(antes.length);
    const r2 = await cadastrarAluno(
      banco.db,
      { ...dados, confirmarWhatsappRepetido: true },
      adm.id,
      HOJE,
    );
    expect(r2.ok && r2.valor.tipo).toBe("criado");
  });
});

describe("atualizarAluno", () => {
  it("atualiza os dados, mantém o responsável e troca quando outro é dado", async () => {
    const r = await cadastrarAluno(
      banco.db,
      {
        nome: "Bia",
        nascimento: "2015-03-01",
        responsavel: { novo: true, nome: "Carla", whatsapp: zap() },
      },
      adm.id,
      HOJE,
    );
    if (!r.ok || r.valor.tipo !== "criado") throw new Error();
    const id = r.valor.alunoId;
    const ligacoes = () =>
      banco.db
        .select()
        .from(responsabilidades)
        .where(eq(responsabilidades.alunoId, id));
    const [antes] = await ligacoes();
    const u = await atualizarAluno(
      banco.db,
      id,
      { nome: "Beatriz", nascimento: "2015-03-01", instagram: "bia_dance" },
      HOJE,
    );
    expect(u.ok).toBe(true);
    expect(await ligacoes()).toEqual([antes]);
    const [p] = await banco.db.select().from(pessoas).where(eq(pessoas.id, id));
    expect(p).toMatchObject({ nome: "Beatriz", instagram: "bia_dance" });
    const novo = await atualizarAluno(
      banco.db,
      id,
      {
        nome: "Beatriz",
        nascimento: "2015-03-01",
        responsavel: { novo: true, nome: "Paulo", whatsapp: zap() },
      },
      HOJE,
    );
    expect(novo.ok).toBe(true);
    const depois = await ligacoes();
    expect(depois).toHaveLength(1);
    expect(depois[0].responsavelId).not.toBe(antes.responsavelId);
    expect(await papeisDe(depois[0].responsavelId)).toEqual([
      "responsavel:true",
    ]);
  });

  it("e-mail de outra pessoa vira erro, aluno inexistente também", async () => {
    const outra = await criarProfessor(banco.db, {
      nome: "Fulano",
      email: "fulano@exemplo.dev",
    });
    const aluno = await criarAluno(banco.db);
    const r = await atualizarAluno(
      banco.db,
      aluno.id,
      {
        nome: "A",
        nascimento: "1990-01-01",
        whatsapp: zap(),
        email: "fulano@exemplo.dev",
      },
      HOJE,
    );
    expect(r.ok ? null : r.erros.email).toBe(
      `Esse e-mail já pertence a ${outra.nome}.`,
    );
    const r2 = await atualizarAluno(
      banco.db,
      outra.id,
      { nome: "A", nascimento: "1990-01-01", whatsapp: zap() },
      HOJE,
    );
    expect(r2).toEqual({ ok: false, erros: { _: "Aluno não encontrado." } });
  });
});

describe("regras adicionais de cadastro", () => {
  it("responsável novo (explícito) com e-mail de outra pessoa: erro e nada gravado", async () => {
    const dona = await criarProfessor(banco.db, {
      nome: "Dona Lia",
      email: "lia@exemplo.dev",
    });
    const antes = await banco.db.select().from(pessoas);
    const r = await cadastrarAluno(
      banco.db,
      {
        nome: "Filho",
        nascimento: "2015-01-01",
        responsavel: {
          novo: true,
          nome: "Lia",
          whatsapp: zap(),
          email: "LIA@exemplo.dev",
        },
      },
      adm.id,
      HOJE,
    );
    expect(r).toEqual({
      ok: false,
      erros: { "responsavel.email": `Esse e-mail já pertence a ${dona.nome}.` },
    });
    expect(await banco.db.select().from(pessoas)).toHaveLength(antes.length);
  });

  it("responsável sem pessoaId e sem novo cujo WhatsApp é de duas ou mais pessoas: cria um responsável novo", async () => {
    await criarAluno(banco.db, { whatsapp: "5511955550001" });
    await criarAluno(banco.db, { whatsapp: "5511955550001" });
    const r = await cadastrarAluno(
      banco.db,
      {
        nome: "Filho",
        nascimento: "2015-01-01",
        responsavel: { nome: "Nova Mãe", whatsapp: "(11) 95555-0001" },
      },
      adm.id,
      HOJE,
    );
    expect(r.ok && r.valor.tipo).toBe("criado");
    if (!r.ok || r.valor.tipo !== "criado") return;
    const [lig] = await banco.db
      .select()
      .from(responsabilidades)
      .where(eq(responsabilidades.alunoId, r.valor.alunoId));
    const [resp] = await banco.db
      .select()
      .from(pessoas)
      .where(eq(pessoas.id, lig.responsavelId));
    expect(resp.nome).toBe("Nova Mãe");
  });

  it("aceita nascimento igual a hoje (menor)", async () => {
    const r = await cadastrarAluno(
      banco.db,
      {
        nome: "Bebê",
        nascimento: HOJE,
        responsavel: { novo: true, nome: "Mãe", whatsapp: zap() },
      },
      adm.id,
      HOJE,
    );
    expect(r.ok && r.valor.tipo).toBe("criado");
  });

  it("tornarAluno recusa aluno encerrado e pessoa desconhecida", async () => {
    const aluno = await criarAluno(banco.db);
    await encerrarAluno(banco.db, {
      alunoId: aluno.id,
      data: HOJE,
      feitoPor: adm.id,
    });
    expect(await tornarAluno(banco.db, aluno.id)).toEqual({
      ok: false,
      erros: { _: MENSAGEM_ENCERRADO },
    });
    expect(await papeisDe(aluno.id)).toEqual(["aluno:false"]);
    expect(
      await tornarAluno(banco.db, "11111111-1111-4111-8111-111111111111"),
    ).toEqual({
      ok: false,
      erros: { _: "Pessoa não encontrada." },
    });
  });
});

describe("atualizarAluno: WhatsApp e responsável de adulto", () => {
  it("WhatsApp de outra pessoa: erro sem confirmação, salva com ela, e o próprio número não é sinalizado", async () => {
    const outra = await criarAluno(banco.db, {
      nome: "Mãe Zé",
      whatsapp: "5511944440001",
    });
    const aluno = await criarAluno(banco.db, { whatsapp: "5511944440002" });
    const base = { nome: "A", nascimento: "1990-01-01" };
    const r = await atualizarAluno(
      banco.db,
      aluno.id,
      { ...base, whatsapp: "(11) 94444-0001" },
      HOJE,
    );
    expect(r).toEqual({
      ok: false,
      erros: { whatsapp: `Já existe ${outra.nome} com esse WhatsApp.` },
    });
    const [intacto] = await banco.db
      .select()
      .from(pessoas)
      .where(eq(pessoas.id, aluno.id));
    expect(intacto.whatsapp).toBe("5511944440002");
    const ok = await atualizarAluno(
      banco.db,
      aluno.id,
      { ...base, whatsapp: "(11) 94444-0001", confirmarWhatsappRepetido: true },
      HOJE,
    );
    expect(ok.ok).toBe(true);
    const [salvo] = await banco.db
      .select()
      .from(pessoas)
      .where(eq(pessoas.id, aluno.id));
    expect(salvo.whatsapp).toBe("5511944440001");
    // Agora compartilha o número com a outra pessoa; manter o próprio número não é sinalizado.
    expect(
      (
        await atualizarAluno(
          banco.db,
          aluno.id,
          { ...base, nome: "B", whatsapp: "(11) 94444-0001" },
          HOJE,
        )
      ).ok,
    ).toBe(true);
  });

  it("adulto na edição ignora campos de responsável e mantém a ligação", async () => {
    const mae = await criarProfessor(banco.db);
    const aluno = await criarAluno(banco.db, { responsavelId: mae.id });
    const antes = await banco.db.select().from(pessoas);
    const r = await atualizarAluno(
      banco.db,
      aluno.id,
      {
        nome: "A",
        nascimento: "1990-01-01",
        whatsapp: zap(),
        responsavel: { novo: true, nome: "Outro", whatsapp: "123" },
      },
      HOJE,
    );
    expect(r.ok).toBe(true);
    const lig = await banco.db
      .select()
      .from(responsabilidades)
      .where(eq(responsabilidades.alunoId, aluno.id));
    expect(lig.map((l) => l.responsavelId)).toEqual([mae.id]);
    expect(await banco.db.select().from(pessoas)).toHaveLength(antes.length);
  });
});

describe("encerrar e reabrir", () => {
  it("encerrar fecha as matrículas, desativa o papel e registra; reabrir reativa sem reabrir matrículas", async () => {
    const aluno = await criarAluno(banco.db);
    const turma = await criarTurma(banco.db);
    await criarMatricula(banco.db, {
      alunoId: aluno.id,
      turmaId: turma.id,
      entrada: "2026-10-01",
      criadoPor: adm.id,
    });
    const e = await encerrarAluno(banco.db, {
      alunoId: aluno.id,
      data: "2026-11-20",
      motivo: " mudou de cidade ",
      feitoPor: adm.id,
    });
    expect(e.ok).toBe(true);
    expect(await papeisDe(aluno.id)).toEqual(["aluno:false"]);
    const [m] = await banco.db
      .select()
      .from(matriculas)
      .where(eq(matriculas.alunoId, aluno.id));
    expect(m).toMatchObject({ saida: "2026-11-20", saidaPor: adm.id });
    const again = await encerrarAluno(banco.db, {
      alunoId: aluno.id,
      data: "2026-11-21",
      feitoPor: adm.id,
    });
    expect(again.ok).toBe(false);
    const rb = await reabrirAluno(banco.db, {
      alunoId: aluno.id,
      feitoPor: adm.id,
      hoje: HOJE,
    });
    expect(rb.ok).toBe(true);
    expect(await papeisDe(aluno.id)).toEqual(["aluno:true"]);
    const abertas = await banco.db
      .select()
      .from(matriculas)
      .where(and(eq(matriculas.alunoId, aluno.id), isNull(matriculas.saida)));
    expect(abertas).toHaveLength(0);
    const hist = await banco.db
      .select()
      .from(encerramentosAluno)
      .where(eq(encerramentosAluno.alunoId, aluno.id));
    expect(
      hist.map((h) => [h.tipo, h.data, h.motivo, h.criadoPor]).sort(),
    ).toEqual([
      ["encerramento", "2026-11-20", "mudou de cidade", adm.id],
      ["reabertura", HOJE, null, adm.id],
    ]);
    expect(
      (
        await reabrirAluno(banco.db, {
          alunoId: aluno.id,
          feitoPor: adm.id,
          hoje: HOJE,
        })
      ).ok,
    ).toBe(false);
  });

  it("recusa data de saída anterior à entrada, data inválida e quem não é aluno", async () => {
    const aluno = await criarAluno(banco.db);
    const turma = await criarTurma(banco.db);
    await criarMatricula(banco.db, {
      alunoId: aluno.id,
      turmaId: turma.id,
      entrada: "2026-10-01",
      criadoPor: adm.id,
    });
    const antes = await encerrarAluno(banco.db, {
      alunoId: aluno.id,
      data: "2026-09-01",
      feitoPor: adm.id,
    });
    expect(antes.ok ? null : antes.erros.data).toBeTruthy();
    const ruim = await encerrarAluno(banco.db, {
      alunoId: aluno.id,
      data: "abc",
      feitoPor: adm.id,
    });
    expect(ruim.ok ? null : ruim.erros.data).toBe(
      "Informe a data do encerramento.",
    );
    expect(await papeisDe(aluno.id)).toEqual(["aluno:true"]);
    const prof = await criarProfessor(banco.db);
    expect(
      await encerrarAluno(banco.db, {
        alunoId: prof.id,
        data: HOJE,
        feitoPor: adm.id,
      }),
    ).toEqual({
      ok: false,
      erros: { _: "Aluno não encontrado." },
    });
  });
});

describe("alunoAtivoOuErro", () => {
  it("aceita ativo e recusa inexistente e encerrado, dentro ou fora de transação", async () => {
    const aluno = await criarAluno(banco.db);
    const prof = await criarProfessor(banco.db);
    expect(await alunoAtivoOuErro(banco.db, aluno.id)).toEqual({
      ok: true,
      valor: null,
    });
    expect(await alunoAtivoOuErro(banco.db, prof.id)).toEqual({
      ok: false,
      erros: { _: "Aluno não encontrado." },
    });
    await encerrarAluno(banco.db, {
      alunoId: aluno.id,
      data: HOJE,
      feitoPor: adm.id,
    });
    expect(
      await banco.db.transaction((tx) => alunoAtivoOuErro(tx, aluno.id)),
    ).toEqual({
      ok: false,
      erros: { _: MENSAGEM_ENCERRADO },
    });
  });
});

describe("excluirAluno", () => {
  it("recusa quem tem período e apaga quem não tem nada", async () => {
    const plano = await criarPlano(banco.db);
    const comPeriodo = await criarAluno(banco.db);
    await criarPeriodo(banco.db, {
      alunoId: comPeriodo.id,
      inicio: "2026-11-01",
      fim: "2026-11-30",
      criadoPor: adm.id,
      planoId: plano.id,
    });
    expect(await podeExcluirAluno(banco.db, comPeriodo.id)).toBe(false);
    expect(await excluirAluno(banco.db, comPeriodo.id)).toEqual({
      ok: false,
      erros: { _: MENSAGEM_EM_USO },
    });
    expect(await papeisDe(comPeriodo.id)).toEqual(["aluno:true"]);

    const mae = await criarProfessor(banco.db);
    const limpo = await criarAluno(banco.db, {
      nascimento: "2015-01-01",
      responsavelId: mae.id,
    });
    expect(await podeExcluirAluno(banco.db, limpo.id)).toBe(true);
    expect(await excluirAluno(banco.db, limpo.id)).toEqual({
      ok: true,
      valor: null,
    });
    expect(
      await banco.db.select().from(pessoas).where(eq(pessoas.id, limpo.id)),
    ).toHaveLength(0);
    expect(
      await banco.db
        .select()
        .from(responsabilidades)
        .where(eq(responsabilidades.alunoId, limpo.id)),
    ).toHaveLength(0);
  });

  it("recusa quem tem matrícula, encerramento ou dependentes", async () => {
    const turma = await criarTurma(banco.db);
    const a = await criarAluno(banco.db);
    await criarMatricula(banco.db, {
      alunoId: a.id,
      turmaId: turma.id,
      entrada: HOJE,
      criadoPor: adm.id,
    });
    expect(await podeExcluirAluno(banco.db, a.id)).toBe(false);
    const b = await criarAluno(banco.db);
    await encerrarAluno(banco.db, {
      alunoId: b.id,
      data: HOJE,
      feitoPor: adm.id,
    });
    expect(await podeExcluirAluno(banco.db, b.id)).toBe(false);
    const c = await criarAluno(banco.db);
    await criarAluno(banco.db, {
      nascimento: "2016-01-01",
      responsavelId: c.id,
    });
    expect(await podeExcluirAluno(banco.db, c.id)).toBe(false);
  });

  it("professor-aluno só perde o papel aluno; pessoa com login nunca é apagada", async () => {
    const prof = await criarProfessor(banco.db);
    await tornarAluno(banco.db, prof.id);
    expect((await excluirAluno(banco.db, prof.id)).ok).toBe(true);
    expect(await papeisDe(prof.id)).toEqual(["professor:true"]);
    expect(
      await banco.db.select().from(pessoas).where(eq(pessoas.id, prof.id)),
    ).toHaveLength(1);
    expect(await excluirAluno(banco.db, prof.id)).toEqual({
      ok: false,
      erros: { _: "Aluno não encontrado." },
    });
  });
});
