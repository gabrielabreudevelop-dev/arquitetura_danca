import { type Janela, lerFiltrosAlunos } from "@/servidor/alunos/listas";

export const DIMENSOES_DO_DASH = [
  "turma",
  "ritmo",
  "modulo",
  "professor",
] as const;
export type Por = (typeof DIMENSOES_DO_DASH)[number];

export type VisaoDoDash = { janela: Janela; por: Por };

export function lerPor(valor: string | string[] | undefined): Por {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  return DIMENSOES_DO_DASH.find((d) => d === texto) ?? "turma";
}

/** `?janela=` e `?por=` do dash; valor inválido vira o padrão (7 dias, turma). */
export function lerVisaoDoDash(
  params: Record<string, string | string[] | undefined>,
): VisaoDoDash {
  return {
    janela: lerFiltrosAlunos({ janela: params.janela }).janela,
    por: lerPor(params.por),
  };
}

/** Endereço do dash; trocar um parâmetro mantém o outro, e os padrões ficam de fora. */
export function urlDash({ janela, por }: VisaoDoDash): string {
  const busca = new URLSearchParams();
  if (janela !== 7) busca.set("janela", String(janela));
  if (por !== "turma") busca.set("por", por);
  const consulta = busca.toString();
  return `/painel${consulta ? `?${consulta}` : ""}`;
}
