import { describe, expect, it } from "vitest";
import { ESTUDIO } from "./estudio";

describe("ESTUDIO", () => {
  it("tem o nome do estúdio", () => {
    expect(ESTUDIO.nome).toBe("Arquitetura da Dança");
  });

  it("tem o slogan do estúdio", () => {
    expect(ESTUDIO.slogan).toBe("A dança é a linguagem escondida da alma.");
  });

  it("guarda o WhatsApp no formato internacional, só com dígitos", () => {
    expect(ESTUDIO.whatsapp.numero).toMatch(/^55\d{10,11}$/);
  });

  it("aponta o Instagram para o perfil no site oficial", () => {
    expect(ESTUDIO.instagram.url.startsWith("https://www.instagram.com/")).toBe(
      true,
    );
  });
});
