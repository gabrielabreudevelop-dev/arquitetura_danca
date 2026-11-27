import { urlContatos } from "@/servidor/alunos/listas";
import type { BolsistaCarregado } from "@/servidor/bolsistas/carga";
import { contarBolsistas, urlBolsistas } from "@/servidor/bolsistas/listas";

/** Janela do número "sem vir" do dash: a mesma da aba, que abre com ela. */
export const JANELA_SEM_VIR_DO_DASH = 15;

export type NumeroDoDash = { numero: number; href: string };

/**
 * Números de bolsistas do dash, cada um com o endereço da lista que abre. O
 * número vem de `contarBolsistas`, que usa as mesmas regras da lista.
 */
export function numerosDeBolsistas(bolsistas: BolsistaCarregado[]): {
  ativos: NumeroDoDash;
  semVir: NumeroDoDash;
} {
  const c = contarBolsistas(bolsistas, JANELA_SEM_VIR_DO_DASH);
  return {
    ativos: {
      numero: c.ativos,
      href: urlBolsistas({
        situacao: "ativos",
        janela: JANELA_SEM_VIR_DO_DASH,
      }),
    },
    semVir: {
      numero: c.semVir,
      href: urlContatos({
        lista: "bolsista_ausente",
        janela: JANELA_SEM_VIR_DO_DASH,
      }),
    },
  };
}
