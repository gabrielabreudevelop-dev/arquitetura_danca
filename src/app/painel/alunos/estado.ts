import type { EstadoFormulario } from "../_formulario/estado";

/**
 * Estado do formulário de aluno: além dos erros, pode trazer uma pergunta.
 * `existente`: o e-mail já é de alguém ("Tornar aluno"); `responsavelExistente`:
 * o responsável digitado já está cadastrado; `whatsappRepetido`: outra pessoa
 * já usa esse WhatsApp ("Salvar mesmo assim").
 */
export type EstadoAluno = EstadoFormulario & {
  existente?: { pessoaId: string; nome: string; jaAluno: boolean };
  responsavelExistente?: { pessoaId: string; nome: string };
  whatsappRepetido?: { pessoaId: string; nome: string };
};
