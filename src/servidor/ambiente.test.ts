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
  it("lista de proxies confiáveis é opcional", () => {
    expect(lerAmbiente(valido).PROXIES_CONFIAVEIS).toBeUndefined();
    expect(
      lerAmbiente({ ...valido, PROXIES_CONFIAVEIS: "" }).PROXIES_CONFIAVEIS,
    ).toBeUndefined();
  });
  it("separa os proxies confiáveis por vírgula", () => {
    expect(
      lerAmbiente({ ...valido, PROXIES_CONFIAVEIS: "10.0.0.1, 172.16.0.0/12" })
        .PROXIES_CONFIAVEIS,
    ).toEqual(["10.0.0.1", "172.16.0.0/12"]);
  });
  it("recusa entrada vazia na lista de proxies", () => {
    expect(() =>
      lerAmbiente({ ...valido, PROXIES_CONFIAVEIS: "10.0.0.1,,10.0.0.2" }),
    ).toThrow(/PROXIES_CONFIAVEIS/);
  });
});
