import { describe, expect, it } from "vitest";
import {
  enderecoDepoisDoCadastro,
  faltaResponsavelEscolhido,
  lerDadosAluno,
  lerDepois,
} from "./dados";

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

describe("faltaResponsavelEscolhido", () => {
  const HOJE = "2026-11-25";
  const vazios: [string, string][] = [
    ["responsavel.nome", ""],
    ["responsavel.whatsapp", ""],
    ["responsavel.email", ""],
  ];

  it("menor com 'Cadastrar outro responsável' e campos vazios é erro", () => {
    const f = form([...BASICO, ["responsavelId", ""], ...vazios]);
    expect(faltaResponsavelEscolhido(f, HOJE)).toEqual({
      "responsavel.nome": "Informe o responsável.",
      "responsavel.whatsapp": "Informe o WhatsApp do responsável.",
    });
  });

  it("sem a escolha na tela, mantendo o atual ou com dados digitados, nada", () => {
    expect(faltaResponsavelEscolhido(form([...BASICO, ...vazios]), HOJE)).toBe(
      null,
    );
    expect(
      faltaResponsavelEscolhido(
        form([...BASICO, ["responsavelId", RESP], ...vazios]),
        HOJE,
      ),
    ).toBe(null);
    expect(
      faltaResponsavelEscolhido(
        form([
          ...BASICO,
          ["responsavelId", ""],
          ["responsavel.nome", "Carla Lima"],
        ]),
        HOJE,
      ),
    ).toBe(null);
  });

  it("adulto não precisa de responsável", () => {
    const f = form([
      ["nome", "Ana"],
      ["nascimento", "1990-01-01"],
      ["responsavelId", ""],
      ...vazios,
    ]);
    expect(faltaResponsavelEscolhido(f, HOJE)).toBe(null);
  });
});

describe("lerDepois", () => {
  it("aceita caminhos dentro de /painel/alunos/", () => {
    expect(lerDepois(`/painel/alunos/${RESP}/transferir`)).toBe(
      `/painel/alunos/${RESP}/transferir`,
    );
  });

  it.each([
    ["vazio", ""],
    ["ausente", null],
    ["outra área", "/painel/turmas"],
    ["a própria lista, sem barra", "/painel/alunos"],
    ["duas barras", "/painel/alunos//evil.com"],
    ["começa com duas barras", "//evil.com/painel/alunos/x"],
    ["com esquema", "https://evil.com/painel/alunos/x"],
    ["javascript:", "javascript:alert(1)//painel/alunos/"],
    ["subindo pastas", "/painel/alunos/../../entrar"],
    ["com consulta", "/painel/alunos/x?para=1"],
    ["com âncora", "/painel/alunos/x#a"],
    ["barra invertida", "/painel/alunos/\\evil.com"],
    ["espaço", "/painel/alunos/ x"],
  ])("recusa: %s", (_nome, valor) => {
    expect(lerDepois(valor)).toBe(null);
  });
});

describe("enderecoDepoisDoCadastro", () => {
  it("volta para `depois` com ?para=<id>", () => {
    expect(
      enderecoDepoisDoCadastro(`/painel/alunos/${RESP}/transferir`, TURMA_A),
    ).toBe(`/painel/alunos/${RESP}/transferir?para=${TURMA_A}`);
  });

  it("sem `depois` válido, abre a ficha do novo aluno", () => {
    expect(enderecoDepoisDoCadastro("", TURMA_A)).toBe(
      `/painel/alunos/${TURMA_A}`,
    );
    expect(enderecoDepoisDoCadastro("//evil.com", TURMA_A)).toBe(
      `/painel/alunos/${TURMA_A}`,
    );
  });
});
