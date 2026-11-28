import type { EstadoPessoa } from "../_pessoa/campos";

/**
 * Estado do formulário de aluno: além dos erros e das perguntas comuns
 * (`responsavelExistente`, `whatsappRepetido`), pode trazer `existente`: o
 * e-mail já é de alguém ("Tornar aluno").
 */
export type EstadoAluno = EstadoPessoa & {
  existente?: { pessoaId: string; nome: string; jaAluno: boolean };
};
