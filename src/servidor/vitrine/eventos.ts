import { ESTUDIO } from "@/estudio";
import { formatarDataCurta } from "./texto";

/** Sem horário de fim, o evento é considerado em andamento por 3 horas. */
const DURACAO_PADRAO_MS = 3 * 60 * 60 * 1000;

export function eventoJaPassou(
  evento: { inicio: Date; fim: Date | null },
  agora: Date,
): boolean {
  const limite =
    evento.fim?.getTime() ?? evento.inicio.getTime() + DURACAO_PADRAO_MS;
  return agora.getTime() >= limite;
}

/** Link de conversa com o WhatsApp do estúdio, com mensagem opcional. */
export function linkWhatsapp(mensagem?: string): string {
  const base = `https://wa.me/${ESTUDIO.whatsapp.numero}`;
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}

/** Link externo de ingresso, ou WhatsApp do estúdio com mensagem pronta. */
export function linkIngresso(evento: {
  titulo: string;
  inicio: Date;
  linkIngresso: string | null;
}): string {
  if (evento.linkIngresso) return evento.linkIngresso;
  return linkWhatsapp(
    `Olá! Quero garantir meu ingresso para o ${evento.titulo} (${formatarDataCurta(evento.inicio)}). Vi no site do estúdio.`,
  );
}

export function linkCompartilharWhatsapp(texto: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${texto}\n${url}`)}`;
}

/** Aceita só convites https://chat.whatsapp.com/<código>. */
export function linkGrupoWhatsappValido(url: string): boolean {
  return /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]+$/.test(url);
}
