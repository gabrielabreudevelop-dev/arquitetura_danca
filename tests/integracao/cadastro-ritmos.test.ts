import { afterAll, beforeAll, expect, it } from "vitest";
import {
  excluirRitmo,
  listarRitmos,
  salvarRitmo,
} from "@/servidor/cadastros/ritmos";
import { criarBancoDeTeste } from "../apoio/banco";
import { criarRitmo, criarTurma } from "../apoio/fabricas";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
beforeAll(async () => {
  banco = await criarBancoDeTeste();
});
afterAll(async () => {
  await banco.encerrar();
});

const base = { ordem: 1, ativo: true };

it("gera o slug a partir do nome quando o slug vem vazio", async () => {
  const r = await salvarRitmo(banco.db, {
    ...base,
    nome: "Samba de Gafieira",
    slug: "",
  });
  expect(r.ok).toBe(true);
  const lista = await listarRitmos(banco.db);
  expect(lista.find((x) => x.nome === "Samba de Gafieira")?.slug).toBe(
    "samba-de-gafieira",
  );
});

it("normaliza o slug digitado", async () => {
  await salvarRitmo(banco.db, {
    ...base,
    nome: "Forró Pé de Serra",
    slug: "Forró",
  });
  const lista = await listarRitmos(banco.db);
  expect(lista.find((x) => x.nome === "Forró Pé de Serra")?.slug).toBe("forro");
});

it("recusa nome repetido com outra caixa", async () => {
  await salvarRitmo(banco.db, { ...base, nome: "Zouk" });
  const r = await salvarRitmo(banco.db, { ...base, nome: "zouk" });
  expect(r).toEqual({
    ok: false,
    erros: { nome: "Já existe um ritmo com esse nome." },
  });
});

it("recusa slug repetido", async () => {
  await criarRitmo(banco.db, { slug: "bolero" });
  const r = await salvarRitmo(banco.db, {
    ...base,
    nome: "Bolero Cubano",
    slug: "bolero",
  });
  expect(r).toEqual({
    ok: false,
    erros: { slug: "Esse endereço já está em uso." },
  });
});

it("recusa nome vazio e ordem inválida", async () => {
  expect(await salvarRitmo(banco.db, { ...base, nome: "  " })).toEqual({
    ok: false,
    erros: { nome: "Informe o nome." },
  });
  expect(
    await salvarRitmo(banco.db, { ...base, nome: "Tango", ordem: "abc" }),
  ).toEqual({ ok: false, erros: { ordem: "Informe um número." } });
});

it("edita um ritmo existente sem conflitar consigo mesmo", async () => {
  const criado = await salvarRitmo(banco.db, { ...base, nome: "Salsa" });
  if (!criado.ok) throw new Error("deveria criar");
  const r = await salvarRitmo(banco.db, {
    id: criado.valor.id,
    nome: "Salsa",
    slug: "salsa",
    ordem: "7",
    ativo: false,
  });
  expect(r.ok).toBe(true);
  const salsa = (await listarRitmos(banco.db)).find((x) => x.nome === "Salsa");
  expect(salsa).toMatchObject({ ordem: 7, ativo: false });
});

it("lista por ordem, depois nome, e conta turmas ativas", async () => {
  const b = await criarBancoDeTeste();
  try {
    const c = await criarRitmo(b.db, { nome: "C", slug: "c", ordem: 1 });
    await criarRitmo(b.db, { nome: "B", slug: "b", ordem: 2 });
    await criarRitmo(b.db, { nome: "A", slug: "a", ordem: 2 });
    await criarTurma(b.db, { ritmoId: c.id });
    await criarTurma(b.db, { ritmoId: c.id });
    await criarTurma(b.db, { ritmoId: c.id, ativa: false });
    const lista = await listarRitmos(b.db);
    expect(lista.map((x) => x.nome)).toEqual(["C", "A", "B"]);
    expect(lista.map((x) => x.turmasAtivas)).toEqual([2, 0, 0]);
  } finally {
    await b.encerrar();
  }
});

it("exclui ritmo sem turma e recusa o que tem turma", async () => {
  const livre = await criarRitmo(banco.db);
  expect(await excluirRitmo(banco.db, livre.id)).toEqual({
    ok: true,
    valor: null,
  });
  const usado = await criarRitmo(banco.db);
  await criarTurma(banco.db, { ritmoId: usado.id });
  expect(await excluirRitmo(banco.db, usado.id)).toEqual({
    ok: false,
    erros: { _: "Está em uso; desative em vez de excluir." },
  });
});

it("valida a ordem: vazia, decimal, com espaços e fora da faixa", async () => {
  const salvar = (ordem: string) =>
    salvarRitmo(banco.db, {
      ativo: true,
      nome: `Ordem ${ordem.trim()}`,
      ordem,
    });
  expect(await salvar("")).toEqual({
    ok: false,
    erros: { ordem: "Informe um número." },
  });
  expect(await salvar("1.5")).toEqual({
    ok: false,
    erros: { ordem: "Informe um número inteiro." },
  });
  expect(await salvar("100000")).toEqual({
    ok: false,
    erros: { ordem: "Use um número de 0 a 9999." },
  });
  expect((await salvar(" 2 ")).ok).toBe(true);
  expect(
    (await listarRitmos(banco.db)).find((x) => x.nome === "Ordem 2")?.ordem,
  ).toBe(2);
});

it("recusa nome só de símbolos, que não gera endereço", async () => {
  const r = await salvarRitmo(banco.db, { ...base, nome: "!!!" });
  expect(r.ok).toBe(false);
  if (!r.ok) expect(Object.keys(r.erros)).toEqual(["slug"]);
});
