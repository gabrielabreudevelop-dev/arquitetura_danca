import { describe, expect, it } from "vitest";
import {
  EXEMPLO_MENSAGEM,
  juntarLista,
  linkConversa,
  preencherMensagem,
  primeiroNome,
  validarTextoMensagem,
} from "./mensagens";

describe("validarTextoMensagem", () => {
  it("recusa campo desconhecido", () => {
    expect(validarTextoMensagem("Oi, {nome}! {xyz}")).toBe(
      "Campo {xyz} não existe. Use {nome}, {aluno}, {turma} ou {fim}.",
    );
  });
  it("recusa texto vazio", () => {
    expect(validarTextoMensagem("")).toBe("Escreva a mensagem.");
    expect(validarTextoMensagem("   ")).toBe("Escreva a mensagem.");
  });
  it("aceita só campos válidos", () => {
    expect(
      validarTextoMensagem("Oi, {nome}! {aluno} {turma} {fim}"),
    ).toBeNull();
    expect(validarTextoMensagem("Sem campos")).toBeNull();
  });
});

describe("preencherMensagem", () => {
  it("troca todas as ocorrências de cada campo", () => {
    expect(
      preencherMensagem("Oi, {nome}! {aluno} até {fim}. {nome}!", {
        nome: "Carla",
        aluno: "Bruno e Lia",
        turma: "x",
        fim: "08/12",
      }),
    ).toBe("Oi, Carla! Bruno e Lia até 08/12. Carla!");
  });
  it("não reinterpreta campos dentro dos valores", () => {
    expect(
      preencherMensagem("{nome} {aluno}", {
        nome: "{aluno}",
        aluno: "Bruno",
        turma: "",
        fim: "",
      }),
    ).toBe("{aluno} Bruno");
  });
});

describe("primeiroNome", () => {
  it("pega a primeira palavra preservando a grafia", () => {
    expect(primeiroNome("Ana Souza")).toBe("Ana");
    expect(primeiroNome("  ana  souza ")).toBe("ana");
  });
});

describe("juntarLista", () => {
  it("junta com vírgulas e 'e'", () => {
    expect(juntarLista(["Bruno"])).toBe("Bruno");
    expect(juntarLista(["Bruno", "Lia"])).toBe("Bruno e Lia");
    expect(juntarLista(["Bruno", "Lia", "Ana"])).toBe("Bruno, Lia e Ana");
    expect(juntarLista([])).toBe("");
  });
});

describe("linkConversa", () => {
  it("codifica o texto", () => {
    expect(linkConversa("5527999990000", "Olá & até {fim}")).toBe(
      "https://wa.me/5527999990000?text=Ol%C3%A1%20%26%20at%C3%A9%20%7Bfim%7D",
    );
  });
  it("sem texto, sem parâmetro", () => {
    expect(linkConversa("5527999990000")).toBe("https://wa.me/5527999990000");
  });
});

it("exemplo traz todos os campos", () => {
  expect(EXEMPLO_MENSAGEM).toEqual({
    nome: "Carla",
    aluno: "Bruno",
    turma: "Forró Iniciante",
    fim: "08/12",
  });
});
