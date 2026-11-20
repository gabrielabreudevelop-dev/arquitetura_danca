import { afterAll, beforeAll, expect, it } from "vitest";
import {
  excluirModulo,
  listarModulos,
  salvarModulo,
} from "@/servidor/cadastros/modulos";
import { criarBancoDeTeste } from "../apoio/banco";
import { criarModulo, criarTurma } from "../apoio/fabricas";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
beforeAll(async () => {
  banco = await criarBancoDeTeste();
});
afterAll(async () => {
  await banco.encerrar();
});

const base = { ordem: 1, ativo: true };

it("cria um módulo", async () => {
  const r = await salvarModulo(banco.db, { ...base, nome: "Iniciante" });
  expect(r.ok).toBe(true);
});

it("recusa nome vazio, repetido (outra caixa) e ordem inválida", async () => {
  expect(await salvarModulo(banco.db, { ...base, nome: " " })).toEqual({
    ok: false,
    erros: { nome: "Informe o nome." },
  });
  await salvarModulo(banco.db, { ...base, nome: "Avançado" });
  expect(await salvarModulo(banco.db, { ...base, nome: "avançado" })).toEqual({
    ok: false,
    erros: { nome: "Já existe um módulo com esse nome." },
  });
  expect(
    await salvarModulo(banco.db, { ...base, nome: "Médio", ordem: "abc" }),
  ).toEqual({ ok: false, erros: { ordem: "Informe um número." } });
});

it("edita um módulo existente", async () => {
  const criado = await salvarModulo(banco.db, { ...base, nome: "Básico" });
  if (!criado.ok) throw new Error("deveria criar");
  const r = await salvarModulo(banco.db, {
    id: criado.valor.id,
    nome: "Básico",
    ordem: "3",
    ativo: false,
  });
  expect(r.ok).toBe(true);
  const m = (await listarModulos(banco.db)).find((x) => x.nome === "Básico");
  expect(m).toMatchObject({ ordem: 3, ativo: false });
});

it("lista por ordem, depois nome", async () => {
  const b = await criarBancoDeTeste();
  try {
    await criarModulo(b.db, { nome: "B", ordem: 2 });
    await criarModulo(b.db, { nome: "A", ordem: 2 });
    await criarModulo(b.db, { nome: "C", ordem: 1 });
    const lista = await listarModulos(b.db);
    expect(lista.map((x) => x.nome)).toEqual(["C", "A", "B"]);
  } finally {
    await b.encerrar();
  }
});

it("exclui módulo sem turma e recusa o que tem turma", async () => {
  const livre = await criarModulo(banco.db);
  expect(await excluirModulo(banco.db, livre.id)).toEqual({
    ok: true,
    valor: null,
  });
  const usado = await criarModulo(banco.db);
  await criarTurma(banco.db, { moduloId: usado.id });
  expect(await excluirModulo(banco.db, usado.id)).toEqual({
    ok: false,
    erros: { _: "Está em uso; desative em vez de excluir." },
  });
});
