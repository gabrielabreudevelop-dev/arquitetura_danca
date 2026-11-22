import { describe, expect, it } from "vitest";
import { diasPorAulas } from "./conversao";

describe("diasPorAulas", () => {
  it.each([
    [1, 2, 4],
    [1, 1, 7],
    [2, 2, 7],
    [1, 3, 3],
    [3, 2, 11],
  ])("%i aula(s) com %i por semana -> %i dias", (aulas, porSemana, dias) => {
    expect(diasPorAulas(aulas, porSemana)).toBe(dias);
  });

  it.each([
    [0, 2],
    [1, 0],
    [-1, 2],
    [1, -2],
    [1.5, 2],
    [1, 2.5],
  ])("recusa %d aulas e %d por semana", (aulas, porSemana) => {
    expect(() => diasPorAulas(aulas, porSemana)).toThrow();
  });
});
