import type { EstadoFormulario } from "../_formulario/estado";

/** Estado do formulário de novo professor: além dos erros, pode apontar uma pessoa que já existe. */
export type EstadoProfessor = EstadoFormulario & {
  existente?: { pessoaId: string; nome: string; jaProfessor: boolean };
};
