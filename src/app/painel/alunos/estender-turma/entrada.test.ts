import { describe, expect, it } from "vitest";
import { lerEscopo, linhaDaPrevia, textoDosDias } from "./entrada";

const ID1 = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const ID2 = "7f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

function formulario(campos: [string, string][]): FormData {
  const f = new FormData();
  for (const [k, v] of campos) f.append(k, v);
  return f;
}

describe("lerEscopo", () => {
  it("turmas marcadas", () => {
    expect(
      lerEscopo(
        formulario([
          ["turmaIds", ID1],
          ["turmaIds", ID2],
        ]),
      ),
    ).toEqual({ ok: true, escopo: { tipo: "turmas", turmaIds: [ID1, ID2] } });
  });

  it("estúdio todo", () => {
    expect(lerEscopo(formulario([["estudio", "1"]]))).toEqual({
      ok: true,
      escopo: { tipo: "estudio" },
    });
  });

  it("estúdio todo junto com turmas não vale (não alarga em silêncio)", () => {
    const r = lerEscopo(
      formulario([
        ["estudio", "1"],
        ["turmaIds", ID1],
      ]),
    );
    expect(r.ok).toBe(false);
  });

  it("nada marcado: turmas vazias, para o servidor explicar", () => {
    expect(lerEscopo(formulario([]))).toEqual({
      ok: true,
      escopo: { tipo: "turmas", turmaIds: [] },
    });
  });
});

describe("linhaDaPrevia", () => {
  it("nome, fim antes e depois e dias", () => {
    expect(
      linhaDaPrevia({
        nome: "Ana Souza",
        fimAntes: "2026-12-08",
        fimDepois: "2026-12-12",
        dias: 4,
      }),
    ).toBe("Ana Souza · 08/12 → 12/12 (+4 dias)");
  });

  it("um dia no singular", () => {
    expect(
      linhaDaPrevia({
        nome: "Bia",
        fimAntes: "2026-12-08",
        fimDepois: "2026-12-09",
        dias: 1,
      }),
    ).toBe("Bia · 08/12 → 09/12 (+1 dia)");
  });
});

describe("textoDosDias", () => {
  it("singular e plural", () => {
    expect(textoDosDias(1)).toBe("1 dia");
    expect(textoDosDias(12)).toBe("12 dias");
  });
});
