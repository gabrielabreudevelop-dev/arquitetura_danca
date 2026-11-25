import { DrizzleQueryError } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ehUuid,
  erroSemDadosPessoais,
  executarTraduzindo,
  MENSAGEM_FALHA_BANCO,
} from "./comum";

it("reconhece uuids e recusa o resto", () => {
  expect(ehUuid("0b3f6f1e-5c1a-4f5e-9d2a-3a1c2b4d5e6f")).toBe(true);
  expect(ehUuid("0B3F6F1E-5C1A-4F5E-9D2A-3A1C2B4D5E6F")).toBe(true);
  expect(ehUuid("")).toBe(false);
  expect(ehUuid("abc")).toBe(false);
  expect(ehUuid("0b3f6f1e-5c1a-4f5e-9d2a-3a1c2b4d5e6f ")).toBe(false);
});

describe("erro de banco não traduzido (R16)", () => {
  const PESSOAIS = ["Ana Souza", "+5527999990000", "ana@exemplo.dev"];

  function erroComDados() {
    const causa = Object.assign(
      new Error('violates check constraint "x" Key (email)=(ana@exemplo.dev)'),
      { code: "23514", detail: "Failing row contains (Ana Souza)." },
    );
    return new DrizzleQueryError(
      'insert into "pessoas" ("nome", "whatsapp", "email") values ($1, $2, $3)',
      PESSOAIS,
      causa,
    );
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function textoDe(valor: unknown): string {
    if (valor instanceof Error) {
      return `${valor.message} ${valor.stack ?? ""} ${textoDe(valor.cause)}`;
    }
    return typeof valor === "string" ? valor : JSON.stringify(valor ?? "");
  }

  it("executarTraduzindo loga só a mensagem fixa e o código, e relança sem os parâmetros", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const promessa = executarTraduzindo(async () => {
      throw erroComDados();
    }, {});
    const erro = await promessa.catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe(MENSAGEM_FALHA_BANCO);
    expect((erro as Error).cause).toBeUndefined();
    expect(log).toHaveBeenCalledTimes(1);
    const logado = log.mock.calls.flat().map(textoDe).join(" ");
    expect(logado).toContain("Falha no banco de dados.");
    expect(logado).toContain("23514");
    for (const dado of PESSOAIS) {
      expect(logado).not.toContain(dado);
      expect(textoDe(erro)).not.toContain(dado);
    }
  });

  it("erro mapeado continua virando erro de formulário, sem log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const erro = erroComDados();
    (erro.cause as { constraint?: string }).constraint = "x";
    const r = await executarTraduzindo(
      async () => {
        throw erro;
      },
      { x: { campo: "nome", mensagem: "Nome repetido." } },
    );
    expect(r).toEqual({ ok: false, erros: { nome: "Nome repetido." } });
    expect(log).not.toHaveBeenCalled();
  });

  it("erro que não é do banco passa como está", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const proprio = new Error("Desfazer a transação");
    expect(erroSemDadosPessoais(proprio)).toBe(proprio);
    expect(log).not.toHaveBeenCalled();
  });

  it("erro do pg sem o Drizzle (ex.: conexão) também é trocado", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const conexao = Object.assign(new Error("connect ECONNREFUSED"), {
      code: "ECONNREFUSED",
    });
    const trocado = erroSemDadosPessoais(conexao) as Error;
    expect(trocado).not.toBe(conexao);
    expect(trocado.message).toBe(MENSAGEM_FALHA_BANCO);
  });
});
