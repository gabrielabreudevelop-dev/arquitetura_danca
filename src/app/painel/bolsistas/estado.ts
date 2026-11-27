import type { EstadoPessoa } from "../_pessoa/campos";

/**
 * Estado do formulário de bolsista: além dos erros e das perguntas comuns
 * (`responsavelExistente`, `whatsappRepetido`), pode trazer `existente`: o
 * e-mail já é de alguém ("Tornar bolsista", ou a ficha se já for bolsista).
 */
export type EstadoBolsista = EstadoPessoa & {
  existente?: { pessoaId: string; nome: string; jaBolsista: boolean };
};
