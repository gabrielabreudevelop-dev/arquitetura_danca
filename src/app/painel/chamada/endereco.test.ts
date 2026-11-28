import { describe, expect, it } from "vitest";
import {
  MENSAGEM_DATA_FUTURA,
  MENSAGEM_DATA_INVALIDA,
  MENSAGEM_SEM_AULA_NO_DIA,
  MENSAGEM_TURMA_INATIVA,
  MENSAGEM_TURMA_INEXISTENTE,
} from "@/servidor/bolsistas/chamada";
import {
  codigoDoErro,
  destinoDoErro,
  diasVizinhos,
  lerData,
  mensagemDoErro,
  urlChamada,
  urlEscolha,
} from "./endereco";

const HOJE = "2026-11-26"; // quinta

describe("lerData", () => {
  it("sem data (ou vazia) é hoje", () => {
    expect(lerData(undefined, HOJE)).toEqual({ ok: true, data: HOJE });
    expect(lerData("", HOJE)).toEqual({ ok: true, data: HOJE });
  });

  it("aceita um dia passado ou hoje; de uma lista, usa o primeiro", () => {
    expect(lerData("2026-11-24", HOJE)).toEqual({
      ok: true,
      data: "2026-11-24",
    });
    expect(lerData(HOJE, HOJE)).toEqual({ ok: true, data: HOJE });
    expect(lerData(["2026-11-20", "2026-11-21"], HOJE)).toEqual({
      ok: true,
      data: "2026-11-20",
    });
  });

  it("recusa dia que não existe e formato errado", () => {
    expect(lerData("2026-02-30", HOJE)).toEqual({ ok: false, codigo: "data" });
    expect(lerData("26/11/2026", HOJE)).toEqual({ ok: false, codigo: "data" });
  });

  it("recusa dia futuro", () => {
    expect(lerData("2026-11-27", HOJE)).toEqual({
      ok: false,
      codigo: "futura",
    });
  });
});

describe("codigoDoErro e mensagemDoErro", () => {
  it("cada mensagem do serviço vira um código curto, e volta com o que fazer", () => {
    const casos: [Record<string, string>, string, string][] = [
      [{ data: MENSAGEM_DATA_INVALIDA }, "data", MENSAGEM_DATA_INVALIDA],
      [{ data: MENSAGEM_DATA_FUTURA }, "futura", MENSAGEM_DATA_FUTURA],
      [
        { data: MENSAGEM_SEM_AULA_NO_DIA },
        "sem-aula",
        MENSAGEM_SEM_AULA_NO_DIA,
      ],
      [
        { turmaId: MENSAGEM_TURMA_INEXISTENTE },
        "turma",
        MENSAGEM_TURMA_INEXISTENTE,
      ],
      [
        { turmaId: MENSAGEM_TURMA_INATIVA },
        "turma-inativa",
        MENSAGEM_TURMA_INATIVA,
      ],
    ];
    for (const [erros, codigo, mensagem] of casos) {
      expect(codigoDoErro(erros)).toBe(codigo);
      const dica =
        codigo === "data" || codigo === "futura"
          ? "Mostrando hoje."
          : "Escolha a turma na lista do dia.";
      expect(mensagemDoErro(codigo)).toBe(`${mensagem} ${dica}`);
    }
  });

  it("erro desconhecido vira “turma não encontrada”", () => {
    expect(codigoDoErro({ _: "Outra coisa." })).toBe("turma");
    expect(codigoDoErro({ data: "Texto novo." })).toBe("turma");
  });

  it("código desconhecido ou ausente não mostra nada", () => {
    expect(mensagemDoErro(undefined)).toBeNull();
    expect(mensagemDoErro("<script>")).toBeNull();
    expect(mensagemDoErro("constructor")).toBeNull();
    expect(mensagemDoErro(["futura", "data"])).toBe(
      `${MENSAGEM_DATA_FUTURA} Mostrando hoje.`,
    );
  });
});

describe("urlEscolha e urlChamada", () => {
  it("hoje fica fora do endereço", () => {
    expect(urlEscolha({ data: HOJE }, HOJE)).toBe("/painel/chamada");
    expect(urlEscolha({}, HOJE)).toBe("/painel/chamada");
    expect(urlEscolha({ data: "2026-11-24" }, HOJE)).toBe(
      "/painel/chamada?data=2026-11-24",
    );
    expect(urlEscolha({ data: "2026-11-24", erro: "sem-aula" }, HOJE)).toBe(
      "/painel/chamada?data=2026-11-24&erro=sem-aula",
    );
    expect(urlEscolha({ erro: "futura" }, HOJE)).toBe(
      "/painel/chamada?erro=futura",
    );
  });

  it("a chamada sempre leva a data", () => {
    expect(urlChamada("abc", "2026-11-24")).toBe(
      "/painel/chamada/abc?data=2026-11-24",
    );
  });
});

describe("destinoDoErro", () => {
  it("data válida fica; data inválida ou futura volta para hoje", () => {
    expect(
      destinoDoErro("2026-11-25", { data: MENSAGEM_SEM_AULA_NO_DIA }, HOJE),
    ).toBe("/painel/chamada?data=2026-11-25&erro=sem-aula");
    expect(
      destinoDoErro("2026-11-24", { turmaId: MENSAGEM_TURMA_INATIVA }, HOJE),
    ).toBe("/painel/chamada?data=2026-11-24&erro=turma-inativa");
    expect(
      destinoDoErro("2026-02-30", { data: MENSAGEM_DATA_INVALIDA }, HOJE),
    ).toBe("/painel/chamada?erro=data");
    expect(
      destinoDoErro("2026-12-01", { data: MENSAGEM_DATA_FUTURA }, HOJE),
    ).toBe("/painel/chamada?erro=futura");
  });
});

describe("diasVizinhos", () => {
  it("anterior sempre; seguinte só quando não é futuro", () => {
    expect(diasVizinhos("2026-11-24", HOJE)).toEqual({
      anterior: "2026-11-23",
      seguinte: "2026-11-25",
    });
    expect(diasVizinhos("2026-11-25", HOJE)).toEqual({
      anterior: "2026-11-24",
      seguinte: HOJE,
    });
    expect(diasVizinhos(HOJE, HOJE)).toEqual({
      anterior: "2026-11-25",
      seguinte: null,
    });
  });

  it("vira o mês e o ano", () => {
    expect(diasVizinhos("2026-01-01", HOJE).anterior).toBe("2025-12-31");
    expect(diasVizinhos("2026-02-28", HOJE).seguinte).toBe("2026-03-01");
  });
});
