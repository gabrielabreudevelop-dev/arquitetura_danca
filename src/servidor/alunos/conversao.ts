/** Limites de um lançamento (R15): dez anos em dias, ou o equivalente em aulas. */
export const LIMITE_DIAS = 3650;
export const LIMITE_AULAS = 520;

/**
 * Quantos dias de calendário valem `aulas` aulas para quem vem
 * `diasPorSemana` vezes por semana (arredondado para cima).
 */
export function diasPorAulas(aulas: number, diasPorSemana: number): number {
  if (!Number.isInteger(aulas) || aulas <= 0) {
    throw new Error("Número de aulas inválido");
  }
  if (!Number.isInteger(diasPorSemana) || diasPorSemana <= 0) {
    throw new Error("Dias por semana inválidos");
  }
  return Math.ceil((aulas * 7) / diasPorSemana);
}
