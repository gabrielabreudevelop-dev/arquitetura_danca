/**
 * Estado do período contratado de um aluno, calculado só a partir do livro
 * de lançamentos (períodos, ajustes e trancamentos não anulados). Funções
 * puras: dash, listas, contatos e ficha usam esta única fonte.
 */
import { type DataIso, diasEntre, somarDias } from "./datas";

/** Só períodos não anulados; `diasAjustes` é a soma dos ajustes não anulados. */
export type PeriodoParaEstado = {
  id: string;
  inicio: DataIso;
  fim: DataIso;
  diasAjustes: number;
};

/** Só trancamentos não anulados. */
export type TrancamentoParaEstado = {
  id: string;
  periodoId: string;
  inicio: DataIso;
  volta: DataIso | null;
};

export type EstadoPeriodo =
  | "encerrado"
  | "trancado"
  | "vigente"
  | "comeca_em_breve"
  | "vencido"
  | "sem_periodo";

export type ResumoPeriodo = {
  estado: EstadoPeriodo;
  /** Último período (maior início), seja qual for o estado. */
  ultimo: (PeriodoParaEstado & { fimEfetivo: DataIso }) | null;
  /** Trancamento ativo hoje, se houver. */
  trancamentoAberto: TrancamentoParaEstado | null;
};

/**
 * Fim do período com os ajustes, sem limite (R14). Quem cede todos os dias
 * deixa o período "vazio": o fim efetivo fica na véspera do início, como no
 * histórico. As anulações que o deixariam ainda mais curto são recusadas.
 */
export function fimEfetivo(p: PeriodoParaEstado): DataIso {
  return somarDias(p.fim, p.diasAjustes);
}

/** Período cujo fim efetivo ficou antes do início: nunca está vigente. */
export function estaVazio(p: PeriodoParaEstado): boolean {
  return fimEfetivo(p) < p.inicio;
}

/**
 * O período de maior início. No mesmo início (um período novo que começa
 * onde um vazio começaria), vale o que não está vazio.
 */
export function ultimoPeriodo(
  periodos: PeriodoParaEstado[],
): PeriodoParaEstado | null {
  let ultimo: PeriodoParaEstado | null = null;
  for (const p of periodos) {
    if (
      ultimo === null ||
      p.inicio > ultimo.inicio ||
      (p.inicio === ultimo.inicio && fimEfetivo(p) > fimEfetivo(ultimo))
    ) {
      ultimo = p;
    }
  }
  return ultimo;
}

export function calcularEstado(
  entrada: {
    encerrado: boolean;
    periodos: PeriodoParaEstado[];
    trancamentos: TrancamentoParaEstado[];
  },
  hoje: DataIso,
): ResumoPeriodo {
  const { encerrado, periodos, trancamentos } = entrada;
  const ultimoBruto = ultimoPeriodo(periodos);
  const ultimo = ultimoBruto
    ? { ...ultimoBruto, fimEfetivo: fimEfetivo(ultimoBruto) }
    : null;
  const trancamentoAberto =
    trancamentos.find(
      (t) => t.inicio <= hoje && (t.volta === null || t.volta > hoje),
    ) ?? null;

  const resumo = (estado: EstadoPeriodo): ResumoPeriodo => ({
    estado,
    ultimo,
    trancamentoAberto,
  });

  if (encerrado) return resumo("encerrado");
  if (trancamentoAberto) return resumo("trancado");
  if (ultimo === null) return resumo("sem_periodo");
  if (periodos.some((p) => p.inicio <= hoje && hoje <= fimEfetivo(p))) {
    return resumo("vigente");
  }
  // Período vazio conta como vencido, mesmo com início no futuro (R14).
  if (ultimo.inicio > hoje && !estaVazio(ultimo)) {
    return resumo("comeca_em_breve");
  }
  return resumo("vencido");
}

/** Vigente cujo último período termina até `janela` dias a partir de hoje (inclusive). */
export function venceEmBreve(
  r: ResumoPeriodo,
  hoje: DataIso,
  janela: number,
): boolean {
  return (
    r.estado === "vigente" &&
    r.ultimo !== null &&
    r.ultimo.fimEfetivo <= somarDias(hoje, janela)
  );
}

/** Vencido cujo último período terminou há no máximo `dias` dias. */
export function vencidoDesde(
  r: ResumoPeriodo,
  hoje: DataIso,
  dias: number,
): boolean {
  return (
    r.estado === "vencido" &&
    r.ultimo !== null &&
    r.ultimo.fimEfetivo >= somarDias(hoje, -dias)
  );
}

/** Dias que faltam no último período, contando hoje; 0 se não estiver vigente. */
export function diasRestantes(r: ResumoPeriodo, hoje: DataIso): number {
  if (r.estado !== "vigente" || r.ultimo === null) return 0;
  const desde = hoje > r.ultimo.inicio ? hoje : r.ultimo.inicio;
  return diasEntre(desde, r.ultimo.fimEfetivo) + 1;
}
