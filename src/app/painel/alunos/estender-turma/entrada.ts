import { formatarDia } from "@/servidor/alunos/datas";
import type { EscopoLote, LinhaPrevia } from "@/servidor/alunos/lotes";
import type { EstadoFormulario } from "../../_formulario/estado";
import { lerTexto } from "../../_formulario/ler-texto";

export function textoDosDias(dias: number): string {
  return `${dias} ${dias === 1 ? "dia" : "dias"}`;
}

/** "Ana Souza · 08/12 → 12/12 (+4 dias)". */
export function linhaDaPrevia(
  l: Pick<LinhaPrevia, "nome" | "fimAntes" | "fimDepois" | "dias">,
): string {
  return `${l.nome} · ${formatarDia(l.fimAntes)} → ${formatarDia(l.fimDepois)} (+${textoDosDias(l.dias)})`;
}

/**
 * Escopo do formulário: "Estúdio todo" (`estudio`) ou as turmas marcadas
 * (`turmaIds`). Os dois juntos são recusados, para não ampliar o lote em silêncio.
 */
export function lerEscopo(
  form: FormData,
):
  | { ok: true; escopo: EscopoLote }
  | { ok: false; erros: Record<string, string> } {
  const turmaIds = form.getAll("turmaIds").map(String);
  if (lerTexto(form, "estudio") === "1") {
    if (turmaIds.length > 0) {
      return {
        ok: false,
        erros: {
          turmaIds: "Escolha o estúdio todo ou turmas, não os dois.",
        },
      };
    }
    return { ok: true, escopo: { tipo: "estudio" } };
  }
  return { ok: true, escopo: { tipo: "turmas", turmaIds } };
}

/**
 * Estado do formulário de extensão: além dos erros e valores, a prévia
 * ("Ver quem recebe") e `em`, o instante da resposta (a tela mostra a mais nova
 * entre "Ver quem recebe" e "Confirmar extensão").
 */
export type EstadoLote = EstadoFormulario & {
  previa?: { linhas: LinhaPrevia[] };
  em?: number;
};
