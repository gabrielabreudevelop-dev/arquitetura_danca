import { expect, it } from "vitest";
import { normalizarEmail, normalizarWhatsapp } from "./normalizar";

it("normaliza e-mail", () => {
  expect(normalizarEmail("  Ana@Estudio.COM ")).toBe("ana@estudio.com");
});

it.each([
  ["(11) 98765-4321", "5511987654321"],
  ["+55 11 98765-4321", "5511987654321"],
  ["11 3456-7890", "551134567890"],
])("normaliza WhatsApp %s", (entrada, saida) => {
  expect(normalizarWhatsapp(entrada)).toBe(saida);
});

it.each([
  "",
  "123",
  "9876-5432",
  "+1 415 555 2671 99",
])("recusa WhatsApp inválido %s", (entrada) => {
  expect(() => normalizarWhatsapp(entrada)).toThrow("WhatsApp inválido");
});
