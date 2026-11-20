import { describe, expect, it } from "vitest";
import {
  eventoJaPassou,
  linkCompartilharWhatsapp,
  linkGrupoWhatsappValido,
  linkIngresso,
  linkWhatsapp,
  urlDoEvento,
} from "./eventos";

describe("eventoJaPassou", () => {
  const inicio = new Date("2026-12-14T00:00:00Z");
  it("sem fim, passa à meia-noite de São Paulo do dia do início", () => {
    const e = { inicio, fim: null };
    expect(eventoJaPassou(e, new Date("2026-12-14T02:59:59Z"))).toBe(false);
    expect(eventoJaPassou(e, new Date("2026-12-14T03:00:00Z"))).toBe(true);
    const manha = { inicio: new Date("2026-12-13T13:00:00Z"), fim: null };
    expect(eventoJaPassou(manha, new Date("2026-12-14T02:59:59Z"))).toBe(false);
    expect(eventoJaPassou(manha, new Date("2026-12-14T03:00:00Z"))).toBe(true);
    const madruga = { inicio: new Date("2026-12-14T03:30:00Z"), fim: null };
    expect(eventoJaPassou(madruga, new Date("2026-12-15T02:59:59Z"))).toBe(
      false,
    );
    expect(eventoJaPassou(madruga, new Date("2026-12-15T03:00:00Z"))).toBe(
      true,
    );
  });
  it("com fim, vale o fim", () => {
    const e = { inicio, fim: new Date("2026-12-14T05:00:00Z") };
    expect(eventoJaPassou(e, new Date("2026-12-14T04:59:59Z"))).toBe(false);
    expect(eventoJaPassou(e, new Date("2026-12-14T05:00:00Z"))).toBe(true);
  });
});

describe("linkWhatsapp", () => {
  it("com e sem mensagem", () => {
    expect(linkWhatsapp()).toBe("https://wa.me/5527999891561");
    expect(linkWhatsapp("Olá & tchau")).toBe(
      "https://wa.me/5527999891561?text=Ol%C3%A1%20%26%20tchau",
    );
  });
});

describe("linkIngresso", () => {
  const base = {
    titulo: "Baile de Dezembro",
    inicio: new Date("2026-12-14T00:00:00Z"),
  };
  it("sem link externo, abre o WhatsApp com mensagem", () => {
    const url = linkIngresso({ ...base, linkIngresso: null });
    expect(decodeURIComponent(url)).toContain(
      "Olá! Quero garantir meu ingresso para o Baile de Dezembro (13/12). Vi no site do estúdio.",
    );
  });
  it("com link externo, usa o link", () => {
    expect(
      linkIngresso({ ...base, linkIngresso: "https://sympla.com.br/x" }),
    ).toBe("https://sympla.com.br/x");
  });
});

describe("linkCompartilharWhatsapp", () => {
  it("monta texto e url", () => {
    expect(
      linkCompartilharWhatsapp("Baile · sáb", "https://x.com/eventos/baile"),
    ).toBe(
      `https://wa.me/?text=${encodeURIComponent("Baile · sáb\nhttps://x.com/eventos/baile")}`,
    );
  });
});

describe("linkGrupoWhatsappValido", () => {
  it("aceita só convites https do WhatsApp", () => {
    expect(linkGrupoWhatsappValido("https://chat.whatsapp.com/AbC123xyz")).toBe(
      true,
    );
    for (const ruim of [
      "https://chat.whatsapp.com/",
      "http://chat.whatsapp.com/AbC",
      "https://chat.whatsapp.com/AbC/extra",
      "https://evil.com/?https://chat.whatsapp.com/AbC",
    ]) {
      expect(linkGrupoWhatsappValido(ruim)).toBe(false);
    }
  });
});

describe("urlDoEvento", () => {
  it("monta o endereço absoluto a partir da base", () => {
    expect(urlDoEvento("baile", "https://app.exemplo.com.br")).toBe(
      "https://app.exemplo.com.br/eventos/baile",
    );
    expect(urlDoEvento("baile", "https://app.exemplo.com.br/")).toBe(
      "https://app.exemplo.com.br/eventos/baile",
    );
  });
});
