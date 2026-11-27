import { describe, expect, it } from "vitest";
import { diasCurtos, diasPorExtenso, ROTULOS_PREFERENCIA } from "./textos";

describe("diasCurtos", () => {
  it("usa a ordem de segunda a domingo e a abreviação de exibição", () => {
    expect(diasCurtos([4, 2])).toBe("ter · qui");
    expect(diasCurtos([0, 6])).toBe("sáb · dom");
    expect(diasCurtos([0, 1, 2, 3, 4, 5, 6])).toBe(
      "seg · ter · qua · qui · sex · sáb · dom",
    );
  });
  it("ignora dias repetidos", () => {
    expect(diasCurtos([2, 2, 4])).toBe("ter · qui");
  });
});

describe("diasPorExtenso", () => {
  it.each([
    [[2, 4], "terças e quintas"],
    [[2], "terças"],
    [[1, 3, 5], "segundas, quartas e sextas"],
    [[6, 0], "sábados e domingos"],
    [[0], "domingos"],
  ] as const)("%o -> %s", (dias, texto) => {
    expect(diasPorExtenso([...dias])).toBe(texto);
  });
});

describe("ROTULOS_PREFERENCIA", () => {
  it("tem o rótulo de cada preferência", () => {
    expect(ROTULOS_PREFERENCIA).toEqual({
      os_dois: "os dois",
      conduzir: "prefere conduzir",
      ser_conduzido: "prefere ser conduzido",
    });
  });
});
