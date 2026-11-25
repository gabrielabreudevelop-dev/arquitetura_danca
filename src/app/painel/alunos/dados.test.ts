import { describe, expect, it } from "vitest";
import { lerDadosAluno } from "./dados";

const RESP = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const TURMA_A = "0b1c2d3e-4f50-4a6b-8c7d-8e9f0a1b2c3d";
const TURMA_B = "1b1c2d3e-4f50-4a6b-8c7d-8e9f0a1b2c3d";

function form(campos: [string, string][]): FormData {
  const f = new FormData();
  for (const [k, v] of campos) f.append(k, v);
  return f;
}

const BASICO: [string, string][] = [
  ["nome", "Bruno Lima"],
  ["nascimento", "2012-05-10"],
  ["whatsapp", ""],
  ["email", "bruno@exemplo.com"],
  ["instagram", "@bruno"],
];

describe("lerDadosAluno", () => {
  it("lê os dados do aluno, as turmas marcadas e o responsável novo", () => {
    const { dados, valores } = lerDadosAluno(
      form([
        ...BASICO,
        ["responsavel.nome", "Carla Lima"],
        ["responsavel.whatsapp", "27 99999-0000"],
        ["responsavel.email", ""],
        ["turmaIds", TURMA_A],
        ["turmaIds", TURMA_B],
      ]),
    );
    expect(dados).toEqual({
      nome: "Bruno Lima",
      nascimento: "2012-05-10",
      whatsapp: "",
      email: "bruno@exemplo.com",
      instagram: "@bruno",
      responsavel: {
        nome: "Carla Lima",
        whatsapp: "27 99999-0000",
        email: "",
        novo: false,
      },
      confirmarWhatsappRepetido: false,
      turmaIds: [TURMA_A, TURMA_B],
    });
    expect(valores.turmaIds).toBe(`${TURMA_A},${TURMA_B}`);
    expect(valores["responsavel.nome"]).toBe("Carla Lima");
  });

  it("responsavelId vira responsavel.pessoaId e ignora os campos", () => {
    const { dados, valores } = lerDadosAluno(
      form([
        ...BASICO,
        ["responsavelId", RESP],
        ["responsavelExistenteNome", "Carla Lima"],
        ["responsavel.nome", "Outro"],
      ]),
    );
    expect(dados.responsavel).toEqual({ pessoaId: RESP });
    expect(valores.responsavelId).toBe(RESP);
    expect(valores.responsavelExistenteNome).toBe("Carla Lima");
  });

  it("responsavelNovo pede pessoa nova mesmo com responsavelId", () => {
    const { dados, valores } = lerDadosAluno(
      form([
        ...BASICO,
        ["responsavelId", RESP],
        ["responsavelNovo", "1"],
        ["responsavelExistenteNome", "Carla Lima"],
        ["responsavel.nome", "Carla Lima"],
      ]),
    );
    expect(dados.responsavel).toEqual({
      nome: "Carla Lima",
      whatsapp: "",
      email: "",
      novo: true,
    });
    expect(valores.responsavelNovo).toBe("1");
    expect(valores.responsavelId).toBeUndefined();
    expect(valores.responsavelExistenteNome).toBeUndefined();
  });

  it("confirmarWhatsappRepetido liga a confirmação", () => {
    const { dados } = lerDadosAluno(
      form([...BASICO, ["confirmarWhatsappRepetido", "1"]]),
    );
    expect(dados.confirmarWhatsappRepetido).toBe(true);
  });
});
