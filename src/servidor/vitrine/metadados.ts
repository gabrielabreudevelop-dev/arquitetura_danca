import type { Metadata } from "next";
import { ESTUDIO } from "@/estudio";
import type { EventoPublico } from "./consultas";
import { urlDoEvento } from "./eventos";
import { formatarDataEvento } from "./texto";

/**
 * Metadados da prévia de link (Open Graph e Twitter). Todo endereço é
 * absoluto, montado a partir de `base` (a URL pública, `BETTER_AUTH_URL`):
 * quem chama lê o ambiente, para o módulo servir também a páginas
 * pré-renderizadas no build, onde não há variáveis de ambiente.
 */

const LARGURA_PREVIA = 1200;
const ALTURA_PREVIA = 630;

function absoluta(caminho: string, base: string): string {
  return new URL(caminho, base).toString();
}

export function metadadosDoEvento(
  evento: EventoPublico,
  base: string,
): Metadata {
  const descricao = [
    evento.esgotado ? "Esgotado" : "",
    formatarDataEvento(evento.inicio, evento.fim),
    evento.local ?? "",
    evento.preco ?? "",
  ]
    .filter(Boolean)
    .join(" · ");

  const imagem = evento.capa
    ? {
        url: absoluta(`/capas/${evento.capa.id}`, base),
        width: evento.capa.largura,
        height: evento.capa.altura,
        alt: evento.titulo,
      }
    : {
        url: absoluta(`/og/evento/${evento.slug}`, base),
        width: LARGURA_PREVIA,
        height: ALTURA_PREVIA,
        alt: evento.titulo,
      };

  return {
    metadataBase: new URL(base),
    title: evento.titulo,
    description: descricao,
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: ESTUDIO.nome,
      url: urlDoEvento(evento.slug, base),
      title: evento.titulo,
      description: descricao,
      images: [imagem],
    },
    twitter: {
      card: "summary_large_image",
      title: evento.titulo,
      description: descricao,
      images: [imagem.url],
    },
  };
}

export function metadadosPadrao(
  base: string,
  pagina: { titulo: string; descricao: string; caminho: string },
): Metadata {
  const imagem = absoluta("/og/padrao", base);
  return {
    metadataBase: new URL(base),
    title: pagina.titulo,
    description: pagina.descricao,
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: ESTUDIO.nome,
      url: absoluta(pagina.caminho, base),
      title: pagina.titulo,
      description: pagina.descricao,
      images: [
        {
          url: imagem,
          width: LARGURA_PREVIA,
          height: ALTURA_PREVIA,
          alt: ESTUDIO.nome,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: pagina.titulo,
      description: pagina.descricao,
      images: [imagem],
    },
  };
}
