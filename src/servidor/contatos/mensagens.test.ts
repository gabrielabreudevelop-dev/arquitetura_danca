import { describe, expect, it } from "vitest";
import {
  CAMPOS_POR_FINALIDADE,
  EXEMPLO_MENSAGEM,
  juntarLista,
  linkConversa,
  preencherMensagem,
  primeiroNome,
  validarTextoMensagem,
} from "./mensagens";

describe("validarTextoMensagem", () => {
  it("recusa campo desconhecido", () => {
    expect(validarTextoMensagem("Oi, {nome}! {xyz}", "renovacao")).toBe(
      "Campo {xyz} não existe. Use {nome}, {aluno}, {turma} ou {fim}.",
    );
  });
  it("recusa texto vazio", () => {
    expect(validarTextoMensagem("", "renovacao")).toBe("Escreva a mensagem.");
    expect(validarTextoMensagem("   ", "bolsista")).toBe("Escreva a mensagem.");
  });
  it("aceita só campos válidos", () => {
    expect(
      validarTextoMensagem("Oi, {nome}! {aluno} {turma} {fim}", "renovacao"),
    ).toBeNull();
    expect(
      validarTextoMensagem("Oi, {nome}! {aluno} {turma} {fim}", "retorno"),
    ).toBeNull();
    expect(validarTextoMensagem("Sem campos", "renovacao")).toBeNull();
  });
  it("bolsista aceita só {nome} e {dias}", () => {
    expect(
      validarTextoMensagem("Oi, {nome}! Aulas de {dias}.", "bolsista"),
    ).toBeNull();
    expect(validarTextoMensagem("Até {fim}", "bolsista")).toBe(
      "Campo {fim} não existe. Use {nome} ou {dias}.",
    );
  });
  it("renovação e retorno recusam {dias}", () => {
    expect(validarTextoMensagem("Aulas de {dias}", "renovacao")).toBe(
      "Campo {dias} não existe. Use {nome}, {aluno}, {turma} ou {fim}.",
    );
    expect(validarTextoMensagem("Aulas de {dias}", "retorno")).toBe(
      "Campo {dias} não existe. Use {nome}, {aluno}, {turma} ou {fim}.",
    );
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

it("campos por finalidade", () => {
  expect(CAMPOS_POR_FINALIDADE).toEqual({
    renovacao: ["nome", "aluno", "turma", "fim"],
    retorno: ["nome", "aluno", "turma", "fim"],
    bolsista: ["nome", "dias"],
  });
});

it("exemplo traz todos os campos", () => {
  expect(EXEMPLO_MENSAGEM).toEqual({
    nome: "Carla",
    aluno: "Bruno",
    turma: "Forró Iniciante",
    fim: "08/12",
    dias: "terças e quintas",
  });
});

describe("preencherMensagem com {dias}", () => {
  it("preenche {dias} e deixa intacto o campo sem valor", () => {
    expect(
      preencherMensagem("Oi, {nome}! Aulas de {dias}. {fim}", {
        nome: "Bruno",
        dias: "terças e quintas",
      }),
    ).toBe("Oi, Bruno! Aulas de terças e quintas. {fim}");
  });
});
