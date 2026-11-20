import { expect, it } from "vitest";
import { decidirAcesso } from "./acesso";

const equipe = ["administracao", "atendente"] as const;

it("sem sessão vai para o login", () =>
  expect(decidirAcesso(null, equipe)).toBe("entrar"));

it("atendente entra no painel", () =>
  expect(decidirAcesso({ pessoaId: "p", papeis: ["atendente"] }, equipe)).toBe(
    "permitir",
  ));

it("aluno não entra no painel", () =>
  expect(decidirAcesso({ pessoaId: "p", papeis: ["aluno"] }, equipe)).toBe(
    "sem-acesso",
  ));

it("quem tem um papel da equipe entre vários também entra", () =>
  expect(
    decidirAcesso(
      { pessoaId: "p", papeis: ["aluno", "administracao"] },
      equipe,
    ),
  ).toBe("permitir"));

it("pessoa sem nenhum papel não entra", () =>
  expect(decidirAcesso({ pessoaId: "p", papeis: [] }, equipe)).toBe(
    "sem-acesso",
  ));
