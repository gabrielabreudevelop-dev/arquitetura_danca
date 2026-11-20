import { describe, expect, it } from "vitest";
import { lerAmbiente } from "./ambiente";

const valido = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
};

describe("lerAmbiente", () => {
  it("aceita um ambiente completo", () => {
    expect(lerAmbiente(valido).DATABASE_URL).toBe(valido.DATABASE_URL);
  });
  it("aponta a variável que falta sem expor valores", () => {
    const { DATABASE_URL, ...semBanco } = valido;
    expect(() => lerAmbiente(semBanco)).toThrow(/DATABASE_URL/);
    expect(() => lerAmbiente(semBanco)).not.toThrow(/x{32}/);
  });
  it("recusa segredo com menos de 32 caracteres", () => {
    expect(() =>
      lerAmbiente({ ...valido, BETTER_AUTH_SECRET: "curto" }),
    ).toThrow(/BETTER_AUTH_SECRET/);
  });
});
