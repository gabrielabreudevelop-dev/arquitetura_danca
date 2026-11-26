/** Valores dos contatos que também servem às telas (sem dependência de banco). */

/** Lista de onde saiu o contato. */
export const LISTAS = ["vence_em_breve", "vencido", "ficha"] as const;
export type ListaContato = (typeof LISTAS)[number];

/** Resultados de um contato, na ordem do seletor. */
export const RESULTADOS = [
  "vai_renovar",
  "vai_pensar",
  "nao_respondeu",
  "nao_volta",
  "nao_quer_contato",
] as const;
export type ResultadoContato = (typeof RESULTADOS)[number];
