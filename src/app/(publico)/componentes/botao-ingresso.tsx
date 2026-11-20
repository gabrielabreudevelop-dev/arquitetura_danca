import type { EventoPublico } from "@/servidor/vitrine/consultas";
import { linkIngresso } from "@/servidor/vitrine/eventos";

/**
 * Botão principal de um evento: "Garantir meu ingresso" abre o link de
 * ingresso (ou o WhatsApp do estúdio com mensagem pronta) numa nova aba.
 * Evento esgotado não tem botão: no lugar, o aviso "Ingressos esgotados".
 */
export function BotaoIngresso({
  evento,
}: {
  evento: Pick<
    EventoPublico,
    "titulo" | "inicio" | "linkIngresso" | "esgotado"
  >;
}) {
  if (evento.esgotado) {
    return (
      <p className="inline-flex min-h-12 items-center font-semibold">
        Ingressos esgotados
      </p>
    );
  }
  return (
    <a
      href={linkIngresso(evento)}
      target="_blank"
      rel="noopener"
      className="inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-acao px-6 font-semibold text-fundo hover:bg-acao-escura md:w-auto"
    >
      Garantir meu ingresso
    </a>
  );
}
