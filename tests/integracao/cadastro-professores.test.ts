import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { pessoaPapeis, pessoas, user } from "@/servidor/banco/esquema";
import {
  atualizarProfessor,
  cadastrarProfessor,
  excluirProfessor,
  listarProfessores,
  tornarProfessor,
} from "@/servidor/cadastros/professores";
import { criarBancoDeTeste } from "../apoio/banco";
import { criarProfessor, criarTurma } from "../apoio/fabricas";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
beforeAll(async () => {
  banco = await criarBancoDeTeste();
});
afterAll(async () => {
  await banco.encerrar();
});

async function papeisDe(pessoaId: string) {
  const linhas = await banco.db
    .select()
    .from(pessoaPapeis)
    .where(eq(pessoaPapeis.pessoaId, pessoaId));
  return linhas.map((l) => `${l.papel}:${l.ativo}`).sort();
}

async function criarAdministracao(email: string) {
  const [pessoa] = await banco.db
    .insert(pessoas)
    .values({ nome: "Ana Admin", email })
    .returning();
  await banco.db
    .insert(pessoaPapeis)
    .values({ pessoaId: pessoa.id, papel: "administracao" });
  return pessoa;
}

it("cadastra o professor com WhatsApp normalizado e papel ativo", async () => {
  const r = await cadastrarProfessor(banco.db, {
    nome: "Bruno",
    whatsapp: "(27) 99999-0000",
  });
  expect(r.ok && r.valor.tipo).toBe("criado");
  if (!r.ok || r.valor.tipo !== "criado") return;
  const [pessoa] = await banco.db
    .select()
    .from(pessoas)
    .where(eq(pessoas.id, r.valor.pessoaId));
  expect(pessoa.whatsapp).toBe("5527999990000");
  expect(pessoa.email).toBeNull();
  expect(await papeisDe(pessoa.id)).toEqual(["professor:true"]);
});

it("recusa WhatsApp inválido e nome vazio", async () => {
  const r = await cadastrarProfessor(banco.db, {
    nome: "  ",
    whatsapp: "123",
  });
  expect(r).toEqual({
    ok: false,
    erros: {
      nome: "Informe o nome.",
      whatsapp: "WhatsApp inválido. Use DDD e número.",
    },
  });
});

it("e-mail de pessoa existente não cria outra; tornarProfessor soma o papel", async () => {
  const admin = await criarAdministracao("ana@exemplo.dev");
  const antes = await banco.db.select().from(pessoas);
  const r = await cadastrarProfessor(banco.db, {
    nome: "Outro Nome",
    email: " ANA@exemplo.dev ",
  });
  expect(r).toEqual({
    ok: true,
    valor: {
      tipo: "pessoa-existente",
      pessoaId: admin.id,
      nome: "Ana Admin",
      jaProfessor: false,
    },
  });
  expect(await banco.db.select().from(pessoas)).toHaveLength(antes.length);

  expect((await tornarProfessor(banco.db, admin.id)).ok).toBe(true);
  expect(await papeisDe(admin.id)).toEqual([
    "administracao:true",
    "professor:true",
  ]);

  const de_novo = await cadastrarProfessor(banco.db, {
    nome: "x",
    email: "ana@exemplo.dev",
  });
  expect(de_novo.ok && de_novo.valor).toMatchObject({
    tipo: "pessoa-existente",
    jaProfessor: true,
  });
});

it("desativar o professor o tira da lista de ativos sem mexer em outros papéis", async () => {
  const admin = await criarAdministracao("desativar@exemplo.dev");
  await tornarProfessor(banco.db, admin.id);
  const r = await atualizarProfessor(banco.db, admin.id, {
    nome: "Ana Admin",
    email: "desativar@exemplo.dev",
    whatsapp: "",
    ativo: false,
  });
  expect(r.ok).toBe(true);
  const ativos = await listarProfessores(banco.db, { somenteAtivos: true });
  expect(ativos.find((p) => p.pessoaId === admin.id)).toBeUndefined();
  const todos = await listarProfessores(banco.db);
  expect(todos.find((p) => p.pessoaId === admin.id)?.ativo).toBe(false);
  expect(await papeisDe(admin.id)).toEqual([
    "administracao:true",
    "professor:false",
  ]);
});

it("lista por nome e atualiza dados; e-mail repetido vira erro do campo", async () => {
  await criarProfessor(banco.db, { nome: "Zélia Lista", email: null });
  await criarProfessor(banco.db, {
    nome: "Alice Lista",
    email: "alice-lista@exemplo.dev",
  });
  const nomes = (await listarProfessores(banco.db))
    .map((p) => p.nome)
    .filter((n) => n.endsWith("Lista"));
  expect(nomes).toEqual(["Alice Lista", "Zélia Lista"]);

  const p = await criarProfessor(banco.db, { nome: "Carlos" });
  const dup = await atualizarProfessor(banco.db, p.id, {
    nome: "Carlos",
    email: "ALICE-lista@exemplo.dev",
    ativo: true,
  });
  expect(dup).toEqual({
    ok: false,
    erros: { email: "Já existe uma pessoa com esse e-mail." },
  });
  const ok = await atualizarProfessor(banco.db, p.id, {
    nome: "Carlos Souza",
    email: "",
    whatsapp: "27999990000",
    ativo: true,
  });
  expect(ok.ok).toBe(true);
  const [linha] = await banco.db
    .select()
    .from(pessoas)
    .where(eq(pessoas.id, p.id));
  expect(linha).toMatchObject({
    nome: "Carlos Souza",
    email: null,
    whatsapp: "5527999990000",
  });
});

it("não exclui professor com turma", async () => {
  const p = await criarProfessor(banco.db);
  await criarTurma(banco.db, { professorId: p.id });
  const r = await excluirProfessor(banco.db, p.id);
  expect(r).toEqual({
    ok: false,
    erros: { _: "Está em uso; desative em vez de excluir." },
  });
  expect(await papeisDe(p.id)).toEqual(["professor:true"]);
});

it("exclui a pessoa quando só era professor", async () => {
  const p = await criarProfessor(banco.db);
  expect((await excluirProfessor(banco.db, p.id)).ok).toBe(true);
  expect(
    await banco.db.select().from(pessoas).where(eq(pessoas.id, p.id)),
  ).toHaveLength(0);
});

it("só tira o papel quando a pessoa tem outro papel", async () => {
  const admin = await criarAdministracao("excluir-papel@exemplo.dev");
  await tornarProfessor(banco.db, admin.id);
  expect((await excluirProfessor(banco.db, admin.id)).ok).toBe(true);
  expect(await papeisDe(admin.id)).toEqual(["administracao:true"]);
  expect(
    await banco.db
      .select()
      .from(pessoaPapeis)
      .where(
        and(
          eq(pessoaPapeis.pessoaId, admin.id),
          eq(pessoaPapeis.papel, "professor"),
        ),
      ),
  ).toHaveLength(0);
});

it("nunca apaga a pessoa que tem login", async () => {
  await banco.db
    .insert(user)
    .values({ id: "u-prof", name: "Com Login", email: "login@exemplo.dev" });
  const p = await criarProfessor(banco.db, { usuarioId: "u-prof" });
  expect((await excluirProfessor(banco.db, p.id)).ok).toBe(true);
  expect(await papeisDe(p.id)).toEqual([]);
  expect(
    await banco.db.select().from(pessoas).where(eq(pessoas.id, p.id)),
  ).toHaveLength(1);
});

it("excluir e atualizar recusam pessoa sem o papel de professor", async () => {
  const [pessoa] = await banco.db
    .insert(pessoas)
    .values({ nome: "Contato Avulso", email: "avulso@exemplo.dev" })
    .returning();
  const naoEncontrado = {
    ok: false,
    erros: { _: "Professor não encontrado." },
  };
  expect(await excluirProfessor(banco.db, pessoa.id)).toEqual(naoEncontrado);
  expect(
    await atualizarProfessor(banco.db, pessoa.id, {
      nome: "Outro",
      email: "",
      ativo: true,
    }),
  ).toEqual(naoEncontrado);
  const [depois] = await banco.db
    .select()
    .from(pessoas)
    .where(eq(pessoas.id, pessoa.id));
  expect(depois).toMatchObject({
    nome: "Contato Avulso",
    email: "avulso@exemplo.dev",
  });
});
