/** Valores dos contatos que também servem às telas (sem dependência de banco). */

/** Listas de contato de alunos. */
export const LISTAS_ALUNO = ["vence_em_breve", "vencido", "ficha"] as const;
/** Listas de contato de bolsistas (a lista "sem vir" e a ficha do bolsista). */
export const LISTAS_BOLSISTA = ["bolsista_ausente", "ficha_bolsista"] as const;

/** Lista de onde saiu o contato. */
export const LISTAS = [...LISTAS_ALUNO, ...LISTAS_BOLSISTA] as const;
export type ListaContato = (typeof LISTAS)[number];

/** Resultados de um contato de aluno, na ordem do seletor. */
export const RESULTADOS_ALUNO = [
  "vai_renovar",
  "vai_pensar",
  "nao_respondeu",
  "nao_volta",
  "nao_quer_contato",
] as const;
/** Resultados de um contato de bolsista, na ordem do seletor. */
export const RESULTADOS_BOLSISTA = [
  "vai_voltar",
  "vai_pensar",
  "nao_respondeu",
  "nao_volta",
  "nao_quer_contato",
] as const;

/** Todos os resultados que existem (cada tipo de contato aceita o seu conjunto). */
export const RESULTADOS = [
  "vai_renovar",
  "vai_voltar",
  "vai_pensar",
  "nao_respondeu",
  "nao_volta",
  "nao_quer_contato",
] as const;
export type ResultadoContato = (typeof RESULTADOS)[number];

/** A lista é de contato de bolsista? */
export function ehListaDeBolsista(lista: string): boolean {
  return (LISTAS_BOLSISTA as readonly string[]).includes(lista);
}
