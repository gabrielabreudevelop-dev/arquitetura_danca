import { describe, expect, it } from "vitest";
import { lerPor, lerVisaoDoDash, urlDash } from "./endereco";

describe("lerPor", () => {
  it("aceita as quatro dimensões e cai em turma", () => {
    expect(lerPor("ritmo")).toBe("ritmo");
    expect(lerPor("modulo")).toBe("modulo");
    expect(lerPor("professor")).toBe("professor");
    expect(lerPor("turma")).toBe("turma");
    expect(lerPor("x")).toBe("turma");
    expect(lerPor(undefined)).toBe("turma");
    expect(lerPor(["ritmo", "modulo"])).toBe("ritmo");
  });
});

describe("lerVisaoDoDash", () => {
  it("valida janela e por, com padrões 7 e turma", () => {
    expect(lerVisaoDoDash({ janela: "15", por: "modulo" })).toEqual({
      janela: 15,
      por: "modulo",
    });
    expect(lerVisaoDoDash({ janela: "99", por: "?" })).toEqual({
      janela: 7,
      por: "turma",
    });
  });
});

describe("urlDash", () => {
  it("omite os padrões e mantém o outro parâmetro", () => {
    expect(urlDash({ janela: 7, por: "turma" })).toBe("/painel");
    expect(urlDash({ janela: 15, por: "turma" })).toBe("/painel?janela=15");
    expect(urlDash({ janela: 7, por: "ritmo" })).toBe("/painel?por=ritmo");
    expect(urlDash({ janela: 30, por: "professor" })).toBe(
      "/painel?janela=30&por=professor",
    );
  });
});
