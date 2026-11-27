import { describe, expect, it } from "vitest";
import { nomeDoMes, textoCurtoDaFrequencia, textoDaFrequencia } from "./textos";

describe("textoDaFrequencia", () => {
  it("presentes de combinados, no plural e no singular", () => {
    expect(textoDaFrequencia({ combinados: 8, presentes: 5, fora: 0 })).toBe(
      "5 de 8 dias combinados",
    );
    expect(textoDaFrequencia({ combinados: 1, presentes: 0, fora: 0 })).toBe(
      "0 de 1 dia combinado",
    );
  });

  it("vindas fora do acordo à parte", () => {
    expect(textoDaFrequencia({ combinados: 8, presentes: 5, fora: 1 })).toBe(
      "5 de 8 dias combinados · +1 fora do acordo",
    );
  });

  it("sem dia combinado com aula", () => {
    expect(textoDaFrequencia({ combinados: 0, presentes: 0, fora: 0 })).toBe(
      "Nenhum dia combinado com aula",
    );
    expect(textoDaFrequencia({ combinados: 0, presentes: 0, fora: 2 })).toBe(
      "Nenhum dia combinado com aula · +2 fora do acordo",
    );
  });
});

describe("textoCurtoDaFrequencia", () => {
  it("presentes de combinados e fora do acordo", () => {
    expect(
      textoCurtoDaFrequencia({ combinados: 8, presentes: 5, fora: 0 }),
    ).toBe("5 de 8");
    expect(
      textoCurtoDaFrequencia({ combinados: 3, presentes: 1, fora: 1 }),
    ).toBe("1 de 3 · +1 fora");
  });

  it("sem dia combinado com aula", () => {
    expect(
      textoCurtoDaFrequencia({ combinados: 0, presentes: 0, fora: 0 }),
    ).toBe("sem aula combinada");
    expect(
      textoCurtoDaFrequencia({ combinados: 0, presentes: 0, fora: 2 }),
    ).toBe("sem aula combinada · +2 fora");
  });
});

describe("nomeDoMes", () => {
  it("abreviado, a partir da data", () => {
    expect(nomeDoMes("2026-03-01")).toBe("mar");
    expect(nomeDoMes("2026-12-31")).toBe("dez");
  });
});
