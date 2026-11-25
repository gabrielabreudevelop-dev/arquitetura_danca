import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";
import { contatos, mensagensProntas } from "@/servidor/banco/esquema";
import { MENSAGEM_EM_USO } from "@/servidor/cadastros/resultado";
import {
  excluirMensagem,
  listarMensagens,
  mensagemAtiva,
  salvarMensagem,
} from "@/servidor/configuracoes/mensagens-prontas";
import {
  excluirPlano,
  formatarDuracao,
  listarPlanos,
  salvarPlano,
} from "@/servidor/configuracoes/planos";
import {
  obterUnidadeAjustes,
  salvarUnidadeAjustes,
} from "@/servidor/configuracoes/unidade";
import { criarBancoDeTeste } from "../apoio/banco";
import {
  criarAdministracao,
  criarAluno,
  criarPeriodo,
  criarPlano,
} from "../apoio/fabricas";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
beforeAll(async () => {
  banco = await criarBancoDeTeste();
});
afterAll(async () => {
  await banco.encerrar();
});

const plano = {
  nome: "Mensal",
  quantidade: 1,
  unidade: "meses",
  ordem: 0,
  ativo: true,
};

it("formata a duração", () => {
  expect(formatarDuracao(1, "meses")).toBe("1 mês");
  expect(formatarDuracao(3, "meses")).toBe("3 meses");
  expect(formatarDuracao(15, "dias")).toBe("15 dias");
  expect(formatarDuracao(1, "dias")).toBe("1 dia");
});

it("salva um plano e lista por ordem e nome", async () => {
  const r = await salvarPlano(banco.db, plano);
  expect(r.ok).toBe(true);
  await salvarPlano(banco.db, {
    ...plano,
    nome: "Anual",
    quantidade: "12",
    ordem: "5",
  });
  const lista = await listarPlanos(banco.db);
  expect(lista.map((p) => p.nome)).toEqual(["Mensal", "Anual"]);
  expect(lista[0]).toMatchObject({
    duracaoQuantidade: 1,
    duracaoUnidade: "meses",
    usado: false,
  });
});

it("edita um plano e filtra os ativos", async () => {
  const r = await salvarPlano(banco.db, {
    ...plano,
    nome: "Antigo",
    ativo: false,
  });
  if (!r.ok) throw new Error("falhou");
  const editado = await salvarPlano(banco.db, {
    ...plano,
    id: r.valor.id,
    nome: "Antigo 2",
    ativo: false,
  });
  expect(editado.ok).toBe(true);
  const ativos = await listarPlanos(banco.db, { somenteAtivos: true });
  expect(ativos.some((p) => p.nome === "Antigo 2")).toBe(false);
  const todos = await listarPlanos(banco.db);
  expect(todos.some((p) => p.nome === "Antigo 2")).toBe(true);
});

it("recusa nome de plano repetido com outra caixa", async () => {
  const r = await salvarPlano(banco.db, { ...plano, nome: "mensal" });
  expect(r).toEqual({
    ok: false,
    erros: { nome: "Já existe um plano com esse nome." },
  });
});

it.each([
  "0",
  "abc",
  "1.5",
  "",
  -2,
])("recusa quantidade %j", async (quantidade) => {
  const r = await salvarPlano(banco.db, {
    ...plano,
    nome: "Qualquer",
    quantidade,
  });
  expect(r).toEqual({
    ok: false,
    erros: { quantidade: "Informe um número inteiro maior que zero." },
  });
});

it("recusa unidade desconhecida", async () => {
  const r = await salvarPlano(banco.db, {
    ...plano,
    nome: "Semanal",
    unidade: "semanas",
  });
  expect(r).toEqual({
    ok: false,
    erros: { unidade: "Escolha meses ou dias." },
  });
});

it("recusa plano sem nome", async () => {
  const r = await salvarPlano(banco.db, { ...plano, nome: "  " });
  expect(r).toEqual({ ok: false, erros: { nome: "Informe o nome." } });
});

it("exclui plano não usado e recusa o usado num período", async () => {
  const adm = await criarAdministracao(banco.db);
  const aluno = await criarAluno(banco.db);
  const usado = await criarPlano(banco.db);
  await criarPeriodo(banco.db, {
    alunoId: aluno.id,
    inicio: "2026-11-01",
    fim: "2026-11-30",
    criadoPor: adm.id,
    planoId: usado.id,
  });
  expect(await excluirPlano(banco.db, usado.id)).toEqual({
    ok: false,
    erros: { _: MENSAGEM_EM_USO },
  });
  const lista = await listarPlanos(banco.db);
  expect(lista.find((p) => p.id === usado.id)?.usado).toBe(true);

  const livre = await criarPlano(banco.db);
  expect(await excluirPlano(banco.db, livre.id)).toEqual({
    ok: true,
    valor: null,
  });
  const depois = await listarPlanos(banco.db);
  expect(depois.some((p) => p.id === livre.id)).toBe(false);
});

it("recusa id de plano que não é uuid", async () => {
  const r = await excluirPlano(banco.db, "lixo");
  expect(r.ok).toBe(false);
});

const mensagem = {
  nome: "Aviso novo",
  finalidade: "renovacao",
  texto: "Oi, {nome}! {aluno} até {fim}.",
  ativa: false,
};

it("recusa campo desconhecido no texto da mensagem", async () => {
  const r = await salvarMensagem(banco.db, {
    ...mensagem,
    texto: "Oi, {nome}! {xyz}",
  });
  expect(r).toEqual({
    ok: false,
    erros: {
      texto: "Campo {xyz} não existe. Use {nome}, {aluno}, {turma} ou {fim}.",
    },
  });
});

it("recusa finalidade desconhecida e nome vazio", async () => {
  const r = await salvarMensagem(banco.db, {
    ...mensagem,
    nome: "",
    finalidade: "outra",
  });
  expect(r).toEqual({
    ok: false,
    erros: { nome: "Informe o nome.", finalidade: "Escolha a finalidade." },
  });
});

it("recusa nome de mensagem repetido", async () => {
  const r = await salvarMensagem(banco.db, { ...mensagem, nome: "renovação" });
  expect(r).toEqual({
    ok: false,
    erros: { nome: "Já existe uma mensagem com esse nome." },
  });
});

it("devolve as sementes como mensagens ativas", async () => {
  const retorno = await mensagemAtiva(banco.db, "retorno");
  expect(retorno?.texto).toContain("Sentimos falta de {aluno}");
  const lista = await listarMensagens(banco.db);
  expect(lista.map((m) => m.nome).sort()).toEqual([
    "Convite para voltar",
    "Renovação",
  ]);
});

it("ativar uma segunda mensagem desativa a outra da mesma finalidade", async () => {
  const antes = await mensagemAtiva(banco.db, "renovacao");
  const r = await salvarMensagem(banco.db, {
    ...mensagem,
    nome: "Renovação 2",
    ativa: true,
  });
  if (!r.ok) throw new Error(JSON.stringify(r.erros));
  const depois = await mensagemAtiva(banco.db, "renovacao");
  expect(depois?.id).toBe(r.valor.id);
  expect(depois?.id).not.toBe(antes?.id);
  const [antiga] = await banco.db
    .select()
    .from(mensagensProntas)
    .where(eq(mensagensProntas.id, antes?.id ?? ""));
  expect(antiga.ativa).toBe(false);
  // a de outra finalidade continua ativa
  expect(await mensagemAtiva(banco.db, "retorno")).not.toBeNull();
});

it("sem mensagem ativa devolve null", async () => {
  const lista = await listarMensagens(banco.db);
  const ativa = lista.find((m) => m.finalidade === "retorno" && m.ativa);
  if (!ativa) throw new Error("sem semente");
  try {
    await salvarMensagem(banco.db, { ...ativa, ativa: false });
    expect(await mensagemAtiva(banco.db, "retorno")).toBeNull();
  } finally {
    await salvarMensagem(banco.db, { ...ativa, ativa: true });
  }
});

it("editar id inexistente com ativa não desativa a mensagem atual", async () => {
  const antes = await mensagemAtiva(banco.db, "retorno");
  const r = await salvarMensagem(banco.db, {
    ...mensagem,
    id: crypto.randomUUID(),
    finalidade: "retorno",
    ativa: true,
  });
  expect(r).toEqual({
    ok: false,
    erros: { _: "Mensagem não encontrada." },
  });
  expect((await mensagemAtiva(banco.db, "retorno"))?.id).toBe(antes?.id);
});

it("ativar uma mensagem existente pelo id desativa só a ativa da mesma finalidade", async () => {
  const criada = await salvarMensagem(banco.db, {
    ...mensagem,
    nome: "Retorno extra",
    finalidade: "retorno",
    ativa: false,
  });
  if (!criada.ok) throw new Error("falhou");
  const retornoAntes = await mensagemAtiva(banco.db, "retorno");
  const renovacaoAntes = await mensagemAtiva(banco.db, "renovacao");
  const r = await salvarMensagem(banco.db, {
    ...mensagem,
    id: criada.valor.id,
    nome: "Retorno extra",
    finalidade: "retorno",
    ativa: true,
  });
  expect(r.ok).toBe(true);
  expect((await mensagemAtiva(banco.db, "retorno"))?.id).toBe(criada.valor.id);
  expect((await mensagemAtiva(banco.db, "renovacao"))?.id).toBe(
    renovacaoAntes?.id,
  );
  const [anterior] = await banco.db
    .select()
    .from(mensagensProntas)
    .where(eq(mensagensProntas.id, retornoAntes?.id ?? ""));
  expect(anterior.ativa).toBe(false);
});

it("editar o texto mantém os outros campos", async () => {
  const criada = await salvarMensagem(banco.db, {
    ...mensagem,
    nome: "Para editar",
    finalidade: "retorno",
    ativa: false,
  });
  if (!criada.ok) throw new Error("falhou");
  const r = await salvarMensagem(banco.db, {
    ...mensagem,
    id: criada.valor.id,
    nome: "Para editar",
    finalidade: "retorno",
    ativa: false,
    texto: "Novo texto, {nome}.",
  });
  expect(r.ok).toBe(true);
  const [linha] = await banco.db
    .select()
    .from(mensagensProntas)
    .where(eq(mensagensProntas.id, criada.valor.id));
  expect(linha).toMatchObject({
    nome: "Para editar",
    finalidade: "retorno",
    ativa: false,
    texto: "Novo texto, {nome}.",
  });
});

it("exclui mensagem nunca usada e recusa a já usada em contatos", async () => {
  const adm = await criarAdministracao(banco.db);
  const aluno = await criarAluno(banco.db);
  const usada = await salvarMensagem(banco.db, { ...mensagem, nome: "Usada" });
  const livre = await salvarMensagem(banco.db, { ...mensagem, nome: "Livre" });
  if (!usada.ok || !livre.ok) throw new Error("falhou");
  await banco.db.insert(contatos).values({
    grupoId: crypto.randomUUID(),
    alunoId: aluno.id,
    pessoaContatoId: aluno.id,
    whatsapp: "5527999990000",
    lista: "ficha",
    mensagemId: usada.valor.id,
    texto: "x",
    criadoPor: adm.id,
  });
  expect(await excluirMensagem(banco.db, usada.valor.id)).toEqual({
    ok: false,
    erros: { _: MENSAGEM_EM_USO },
  });
  expect(await excluirMensagem(banco.db, livre.valor.id)).toEqual({
    ok: true,
    valor: null,
  });
});

it("guarda a unidade dos ajustes", async () => {
  expect(await obterUnidadeAjustes(banco.db)).toBe("dias");
  expect(await salvarUnidadeAjustes(banco.db, "aulas")).toEqual({
    ok: true,
    valor: null,
  });
  expect(await obterUnidadeAjustes(banco.db)).toBe("aulas");
  expect(await salvarUnidadeAjustes(banco.db, "horas")).toEqual({
    ok: false,
    erros: { unidade: "Escolha dias ou aulas." },
  });
  expect(await obterUnidadeAjustes(banco.db)).toBe("aulas");
});

it("recusa duração acima de 9999 com mensagem própria (R18)", async () => {
  const r = await salvarPlano(banco.db, {
    ...plano,
    nome: "Longo demais",
    quantidade: "10000",
  });
  expect(r).toEqual({
    ok: false,
    erros: { quantidade: "Informe no máximo 9999." },
  });
});

it("ativar ao mesmo tempo que outra pessoa: mensagem legível, não erro do banco (R18)", async () => {
  const pool = new Pool({ connectionString: banco.url });
  const cliente = await pool.connect();
  try {
    // Outra sessão troca a mensagem ativa de "retorno" e segura a transação.
    await cliente.query("begin");
    await cliente.query(
      "update mensagens_prontas set ativa = false where finalidade = 'retorno' and ativa",
    );
    await cliente.query(
      "insert into mensagens_prontas (nome, finalidade, texto, ativa) values ('Concorrente', 'retorno', 'Oi, {nome}!', true)",
    );
    const salvando = salvarMensagem(banco.db, {
      nome: "Minha nova",
      finalidade: "retorno",
      texto: "Oi, {nome}!",
      ativa: true,
    });
    await new Promise((r) => setTimeout(r, 300));
    await cliente.query("commit");
    expect(await salvando).toEqual({
      ok: false,
      erros: {
        _: "Outra mensagem desta finalidade acabou de ser ativada. Confira a lista e tente de novo.",
      },
    });
  } finally {
    cliente.release();
    await pool.end();
  }
});
