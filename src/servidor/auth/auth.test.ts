import { describe, expect, it, vi } from "vitest";
import type { Banco } from "../banco/cliente";

// Qualquer leitura do ambiente falha: prova que opções explícitas não o usam.
vi.mock("../ambiente", () => ({
  ambiente: new Proxy(
    {},
    {
      get() {
        throw new Error("ambiente lido");
      },
    },
  ),
}));

const { criarAuth } = await import("./auth");
const db = {} as Banco;
const secret = "segredo-de-teste-com-mais-de-trinta-e-dois-caracteres";
const baseURL = "http://localhost:3000";

describe("criarAuth com opções explícitas", () => {
  it("não lê o ambiente quando recebe secret e baseURL", () => {
    expect(() => criarAuth(db, { secret, baseURL })).not.toThrow();
  });
  it("não lê o ambiente quando recebe também proxiesConfiaveis", () => {
    expect(() =>
      criarAuth(db, { secret, baseURL, proxiesConfiaveis: ["10.0.0.1"] }),
    ).not.toThrow();
  });
  it.each([
    ["só secret", { secret }],
    ["só baseURL", { baseURL }],
    ["só proxiesConfiaveis", { proxiesConfiaveis: ["10.0.0.1"] }],
  ])("recusa opções parciais (%s) sem misturar com o ambiente", (_n, opcoes) => {
    expect(() => criarAuth(db, opcoes)).toThrow(
      "criarAuth: informe secret e baseURL juntos",
    );
  });
  it("sem opções, lê o ambiente", () => {
    expect(() => criarAuth(db)).toThrow("ambiente lido");
  });
});
