/** Textos dos bolsistas: dias da semana e rótulos de preferência. */

import { DIAS_SEMANA } from "../vitrine/texto";

export type Preferencia = "os_dois" | "conduzir" | "ser_conduzido";

export const ROTULOS_PREFERENCIA: Record<Preferencia, string> = {
  os_dois: "os dois",
  conduzir: "prefere conduzir",
  ser_conduzido: "prefere ser conduzido",
};

/** Plural de cada dia, na ordem da tabela (0 = domingo … 6 = sábado). */
const PLURAIS = [
  "domingos",
  "segundas",
  "terças",
  "quartas",
  "quintas",
  "sextas",
  "sábados",
] as const;

/** Ordem de exibição: segunda a domingo. */
const ORDEM_SEG_DOM = [1, 2, 3, 4, 5, 6, 0] as const;

function ordenarSegDom(dias: number[]): number[] {
  const unicos = new Set(dias);
  return ORDEM_SEG_DOM.filter((d) => unicos.has(d));
}

/** Ex.: [4, 2] -> "ter · qui"; [0, 6] -> "sáb · dom". */
export function diasCurtos(dias: number[]): string {
  return ordenarSegDom(dias)
    .map((d) => DIAS_SEMANA[d]?.exibicao)
    .filter((n): n is NonNullable<typeof n> => n !== undefined)
    .join(" · ");
}

/** Ex.: [2, 4] -> "terças e quintas"; [1, 3, 5] -> "segundas, quartas e sextas". */
export function diasPorExtenso(dias: number[]): string {
  const nomes = ordenarSegDom(dias)
    .map((d) => PLURAIS[d])
    .filter((n): n is NonNullable<typeof n> => n !== undefined);
  if (nomes.length <= 1) return nomes.join("");
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}
