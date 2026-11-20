import { ESTUDIO } from "@/estudio";
import { ambiente } from "../ambiente";
import { fimDoDiaEmSaoPaulo, formatarDataCurta } from "./texto";

export function eventoJaPassou(
  evento: { inicio: Date; fim: Date | null },
  agora: Date,
): boolean {
  // Sem fim, o evento passa à meia-noite (São Paulo) do dia do início.
  const limite = (evento.fim ?? fimDoDiaEmSaoPaulo(evento.inicio)).getTime();
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

/** Endereço público absoluto da página de um evento. */
export function urlDoEvento(
  slug: string,
  base: string = ambiente.BETTER_AUTH_URL,
): string {
  return new URL(`/eventos/${slug}`, base).toString();
}

export function linkCompartilharWhatsapp(texto: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${texto}\n${url}`)}`;
}

/** Aceita só convites https://chat.whatsapp.com/<código>. */
export function linkGrupoWhatsappValido(url: string): boolean {
  return /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]+$/.test(url);
}
