import { formatarDia } from "@/servidor/alunos/datas";
import type { ResumoPeriodo } from "@/servidor/alunos/estado";

/** Estado do período em texto, como aparece na lista: "vence em 12/12", "sem período"... */
export function textoDoEstado(r: ResumoPeriodo): string {
  switch (r.estado) {
    case "encerrado":
      return "encerrado";
    case "trancado":
      return r.trancamentoAberto
        ? `trancado desde ${formatarDia(r.trancamentoAberto.inicio)}`
        : "trancado";
    case "sem_periodo":
      return "sem período";
  }
  const ultimo = r.ultimo;
  if (!ultimo) return "sem período";
  if (r.estado === "comeca_em_breve")
    return `começa em ${formatarDia(ultimo.inicio)}`;
  if (r.estado === "vencido")
    return `venceu em ${formatarDia(ultimo.fimEfetivo)}`;
  return `vence em ${formatarDia(ultimo.fimEfetivo)}`;
}

/**
 * O último período em texto: "Trimestral · 01/09 a 01/12, estendido até 08/12".
 * Sem plano (recebido em transferência): "Período recebido · …". Sem período: `null`.
 */
export function textoDoPeriodo(
  plano: string | null,
  r: ResumoPeriodo,
): string | null {
  const u = r.ultimo;
  if (!u) return null;
  let texto = `${plano ?? "Período recebido"} · ${formatarDia(u.inicio)} a ${formatarDia(u.fim)}`;
  if (u.fimEfetivo > u.fim)
    texto += `, estendido até ${formatarDia(u.fimEfetivo)}`;
  else if (u.fimEfetivo < u.fim)
    texto += `, encurtado até ${formatarDia(u.fimEfetivo)}`;
  return texto;
}

const RESULTADOS: Record<string, string> = {
  vai_renovar: "vai renovar",
  vai_pensar: "vai pensar",
  nao_respondeu: "não respondeu",
  nao_volta: "não volta",
  nao_quer_contato: "não quer contato",
};

/** Resultado de um contato em texto: "vai_pensar" → "vai pensar". */
export function textoDoResultado(resultado: string): string {
  return RESULTADOS[resultado] ?? resultado;
}
