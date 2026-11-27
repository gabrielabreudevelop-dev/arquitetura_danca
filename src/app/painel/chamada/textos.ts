/**
 * Textos e leitura do formulário da chamada. Sem nada do servidor: o
 * formulário (componente cliente) usa a contagem para mostrá-la ao vivo.
 */

import {
  type DataIso,
  diaDaSemana,
  formatarDataCompleta,
  formatarDia,
} from "@/servidor/alunos/datas";
import type { Preferencia } from "@/servidor/bolsistas/textos";

export type Contagem = {
  vieram: number;
  conduzir: number;
  ser_conduzido: number;
  os_dois: number;
};

/** Dias da semana por extenso, 0 = domingo … 6 = sábado. */
const DIAS = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
] as const;

export function nomeDoDia(data: DataIso): string {
  return DIAS[diaDaSemana(data)] ?? "";
}

/** "na terça", "no sábado". */
export function naDia(data: DataIso): string {
  const dia = diaDaSemana(data);
  return `${dia === 0 || dia === 6 ? "no" : "na"} ${nomeDoDia(data)}`;
}

/** Primeira letra maiúscula, para começar uma frase. */
export function comMaiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "terça, 24/11"; com o ano quando não é o ano de hoje. */
export function tituloDoDia(data: DataIso, hoje: DataIso): string {
  const dia =
    data.slice(0, 4) === hoje.slice(0, 4)
      ? formatarDia(data)
      : formatarDataCompleta(data);
  return `${nomeDoDia(data)}, ${dia}`;
}

/** Contagem dos marcados pela preferência de cada um. */
export function contar(marcados: { preferencia: Preferencia }[]): Contagem {
  const c: Contagem = { vieram: 0, conduzir: 0, ser_conduzido: 0, os_dois: 0 };
  for (const m of marcados) {
    c.vieram++;
    c[m.preferencia]++;
  }
  return c;
}

/** "3 vieram · 1 conduz · 1 é conduzido · 1 os dois". */
export function textoDaContagem(c: Contagem): string {
  if (c.vieram === 0) return "Ninguém marcado";
  return [
    `${c.vieram} ${c.vieram === 1 ? "veio" : "vieram"}`,
    `${c.conduzir} ${c.conduzir === 1 ? "conduz" : "conduzem"}`,
    `${c.ser_conduzido} ${c.ser_conduzido === 1 ? "é conduzido" : "são conduzidos"}`,
    `${c.os_dois} os dois`,
  ].join(" · ");
}

/** Situação de uma aula na escolha do dia. */
export function textoDaSituacao(a: {
  situacao: "sem_chamada" | "realizada" | "nao_houve";
  presentes: number;
  motivo: string | null;
}): string {
  if (a.situacao === "sem_chamada") return "Sem chamada";
  if (a.situacao === "nao_houve")
    return a.motivo ? `Não houve aula · ${a.motivo}` : "Não houve aula";
  if (a.presentes === 0) return "Ninguém veio";
  return `${a.presentes} ${a.presentes === 1 ? "presente" : "presentes"}`;
}

/** Os campos `presentes` marcados, em minúsculas, sem vazios nem repetidos. */
export function lerPresentes(form: FormData): string[] {
  const ids = form
    .getAll("presentes")
    .map((v) => String(v).trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(ids)];
}

/** Versão da chamada que a tela mostrou; inválida vira -1 (o serviço avisa que mudou). */
export function lerVersao(form: FormData): number {
  const texto = String(form.get("versao") ?? "");
  return /^\d+$/.test(texto) ? Number(texto) : -1;
}

/** Nomes das pessoas dos ids, em ordem alfabética; ids desconhecidos ficam de fora. */
export function nomesDe(
  ids: string[],
  pessoas: { pessoaId: string; nome: string }[],
): string[] {
  const nomes = new Map(pessoas.map((p) => [p.pessoaId, p.nome]));
  return ids
    .flatMap((id) => {
      const nome = nomes.get(id);
      return nome === undefined ? [] : [nome];
    })
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}
