import { describe, expect, it } from "vitest";
import type { EventoPublico } from "./consultas";
import { metadadosDoEvento, metadadosPadrao } from "./metadados";
import { formatarDataEvento } from "./texto";

const BASE = "https://app.exemplo.com.br";

const evento: EventoPublico = {
  id: "e1",
  titulo: "Baile de Dezembro",
  slug: "baile-de-dezembro",
  descricao: null,
  local: "Salão do estúdio",
  inicio: new Date("2026-12-13T00:00:00Z"),
  fim: null,
  preco: "R$ 35 antecipado",
  linkIngresso: null,
  esgotado: false,
  capa: { id: "c1", largura: 960, altura: 1200 },
};

function imagens(m: ReturnType<typeof metadadosDoEvento>) {
  return (m.openGraph as { images: unknown[] }).images;
}

describe("metadadosDoEvento", () => {
  it("usa a capa com largura e altura reais", () => {
    const m = metadadosDoEvento(evento, BASE);
    expect(m.title).toBe("Baile de Dezembro");
    expect(imagens(m)[0]).toEqual({
      url: "https://app.exemplo.com.br/capas/c1",
      width: 960,
      height: 1200,
      alt: "Baile de Dezembro",
    });
  });

  it("sem capa usa a imagem gerada 1200x630", () => {
    const m = metadadosDoEvento({ ...evento, capa: null }, BASE);
    expect(imagens(m)[0]).toEqual({
      url: "https://app.exemplo.com.br/og/evento/baile-de-dezembro",
      width: 1200,
      height: 630,
      alt: "Baile de Dezembro",
    });
  });

  it("descrição: data, local e preço; Esgotado na frente quando esgotado", () => {
    const data = formatarDataEvento(evento.inicio, evento.fim);
    expect(metadadosDoEvento(evento, BASE).description).toBe(
      `${data} · Salão do estúdio · R$ 35 antecipado`,
    );
    expect(
      metadadosDoEvento({ ...evento, esgotado: true }, BASE).description,
    ).toMatch(/^Esgotado · /);
  });

  it("sem local e sem preço, a descrição é só a data", () => {
    const m = metadadosDoEvento({ ...evento, local: null, preco: null }, BASE);
    expect(m.description).toBe(formatarDataEvento(evento.inicio, evento.fim));
  });

  it("tem tipo, idioma, nome do site, url, base e cartão do Twitter", () => {
    const m = metadadosDoEvento(evento, BASE);
    expect(m.openGraph).toMatchObject({
      type: "website",
      locale: "pt_BR",
      siteName: "Arquitetura da Dança",
      url: "https://app.exemplo.com.br/eventos/baile-de-dezembro",
      title: "Baile de Dezembro",
    });
    expect(m.twitter).toMatchObject({ card: "summary_large_image" });
    expect(m.metadataBase?.toString()).toBe("https://app.exemplo.com.br/");
  });
});

describe("metadadosPadrao", () => {
  it("usa a imagem padrão e o endereço da página", () => {
    const m = metadadosPadrao(BASE, {
      titulo: "Eventos",
      descricao: "Próximos eventos.",
      caminho: "/eventos",
    });
    expect(m.title).toBe("Eventos");
    expect(m.description).toBe("Próximos eventos.");
    expect(m.openGraph).toMatchObject({
      type: "website",
      locale: "pt_BR",
      url: "https://app.exemplo.com.br/eventos",
      title: "Eventos",
      images: [
        {
          url: "https://app.exemplo.com.br/og/padrao",
          width: 1200,
          height: 630,
          alt: "Arquitetura da Dança",
        },
      ],
    });
    expect(m.twitter).toMatchObject({ card: "summary_large_image" });
  });
});
