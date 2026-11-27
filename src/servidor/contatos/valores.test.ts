import { expect, it } from "vitest";
import {
  LISTAS,
  LISTAS_ALUNO,
  LISTAS_BOLSISTA,
  RESULTADOS,
  RESULTADOS_ALUNO,
  RESULTADOS_BOLSISTA,
} from "./valores";

it("listas de aluno e de bolsista", () => {
  expect(LISTAS_ALUNO).toEqual(["vence_em_breve", "vencido", "ficha"]);
  expect(LISTAS_BOLSISTA).toEqual(["bolsista_ausente", "ficha_bolsista"]);
  expect(LISTAS).toEqual([...LISTAS_ALUNO, ...LISTAS_BOLSISTA]);
});

it("resultados de aluno não têm vai_voltar e os de bolsista não têm vai_renovar", () => {
  expect(RESULTADOS_ALUNO).toEqual([
    "vai_renovar",
    "vai_pensar",
    "nao_respondeu",
    "nao_volta",
    "nao_quer_contato",
  ]);
  expect(RESULTADOS_BOLSISTA).toEqual([
    "vai_voltar",
    "vai_pensar",
    "nao_respondeu",
    "nao_volta",
    "nao_quer_contato",
  ]);
  expect([...RESULTADOS].sort()).toEqual(
    [...new Set([...RESULTADOS_ALUNO, ...RESULTADOS_BOLSISTA])].sort(),
  );
});
