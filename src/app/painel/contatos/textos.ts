import type { UltimoContato } from "@/servidor/alunos/carga";
import {
  type DataIso,
  diasEntre,
  formatarDataCompleta,
  formatarDia,
  hojeEmSaoPaulo,
} from "@/servidor/alunos/datas";
import type { FiltrosContatos } from "@/servidor/alunos/listas";
import { textoDoResultado } from "../alunos/textos";

/** Dia de um instante em São Paulo: "05/11", ou "30/12/2025" se for de outro ano. */
function dia(em: Date, hoje: DataIso): string {
  const data = hojeEmSaoPaulo(em);
  return data.slice(0, 4) === hoje.slice(0, 4)
    ? formatarDia(data)
    : formatarDataCompleta(data);
}

function haQuanto(em: Date, hoje: DataIso): string {
  const dias = diasEntre(hojeEmSaoPaulo(em), hoje);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}

/**
 * "último contato: 05/11 · vai pensar · Gabriel", "último contato: —" ou,
 * para quem foi contatado nos últimos 7 dias, "contatado há 3 dias por Gabriel".
 */
export function textoDoUltimoContato(
  linha: { ultimoContato: UltimoContato | null; recente: UltimoContato | null },
  hoje: DataIso,
): string {
  const { ultimoContato: c, recente } = linha;
  if (!c) return "último contato: —";
  const resultado = c.resultado ? textoDoResultado(c.resultado) : null;
  if (recente) {
    const texto = `contatado ${haQuanto(c.em, hoje)} por ${c.por}`;
    return resultado ? `${texto} · ${resultado}` : texto;
  }
  return [`último contato: ${dia(c.em, hoje)}`, resultado, c.por]
    .filter(Boolean)
    .join(" · ");
}

const FINALIDADE: Record<FiltrosContatos["lista"], string> = {
  vence_em_breve: "renovação",
  vencido: "convite para voltar",
};

/** Aviso do topo quando não há mensagem pronta ativa para a lista. */
export function textoSemMensagem(lista: FiltrosContatos["lista"]): string {
  return `Não há mensagem pronta de ${FINALIDADE[lista]} ativa. O WhatsApp vai abrir sem texto.`;
}

/** Título do estado vazio de cada lista, conforme os filtros. */
export function textoVazio(f: FiltrosContatos): string {
  if (f.lista === "vence_em_breve") {
    return `Ninguém vence nos próximos ${f.janela} dias.`;
  }
  if (f.semContato) {
    return f.todos
      ? "Todos os vencidos já receberam contato."
      : "Todos os vencidos dos últimos 90 dias já receberam contato.";
  }
  return f.todos
    ? "Nenhum aluno vencido."
    : "Ninguém venceu nos últimos 90 dias.";
}
