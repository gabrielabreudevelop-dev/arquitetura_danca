import { describe, expect, it } from "vitest";
import type { UltimoContato } from "@/servidor/alunos/carga";
import { textoDoUltimoContato, textoSemMensagem, textoVazio } from "./textos";

const HOJE = "2026-11-22";

function contato(em: string, resultado: string | null = null): UltimoContato {
  return { grupoId: "g", em: new Date(em), por: "Gabriel", resultado };
}

describe("textoDoUltimoContato", () => {
  it("sem contato", () => {
    expect(
      textoDoUltimoContato({ ultimoContato: null, recente: null }, HOJE),
    ).toBe("último contato: —");
  });

  it("contato antigo: data, resultado e quem fez", () => {
    const c = contato("2026-11-05T15:00:00Z", "vai_pensar");
    expect(
      textoDoUltimoContato({ ultimoContato: c, recente: null }, HOJE),
    ).toBe("último contato: 05/11 · vai pensar · Gabriel");
    const sem = contato("2026-11-05T15:00:00Z");
    expect(
      textoDoUltimoContato({ ultimoContato: sem, recente: null }, HOJE),
    ).toBe("último contato: 05/11 · Gabriel");
  });

  it("contato de outro ano mostra o ano", () => {
    const c = contato("2025-12-30T15:00:00Z");
    expect(
      textoDoUltimoContato({ ultimoContato: c, recente: null }, HOJE),
    ).toBe("último contato: 30/12/2025 · Gabriel");
  });

  it("contato recente: há quantos dias e por quem (dia de São Paulo)", () => {
    const tres = contato("2026-11-19T15:00:00Z", "nao_respondeu");
    expect(
      textoDoUltimoContato({ ultimoContato: tres, recente: tres }, HOJE),
    ).toBe("contatado há 3 dias por Gabriel · não respondeu");
    // 01:00 UTC do dia 22 ainda é dia 21 em São Paulo.
    const ontem = contato("2026-11-22T01:00:00Z");
    expect(
      textoDoUltimoContato({ ultimoContato: ontem, recente: ontem }, HOJE),
    ).toBe("contatado ontem por Gabriel");
    const hoje = contato("2026-11-22T12:00:00Z");
    expect(
      textoDoUltimoContato({ ultimoContato: hoje, recente: hoje }, HOJE),
    ).toBe("contatado hoje por Gabriel");
  });
});

describe("textos fixos", () => {
  it("aviso sem mensagem ativa", () => {
    expect(textoSemMensagem("vence_em_breve")).toBe(
      "Não há mensagem pronta de renovação ativa. O WhatsApp vai abrir sem texto.",
    );
    expect(textoSemMensagem("vencido")).toBe(
      "Não há mensagem pronta de convite para voltar ativa. O WhatsApp vai abrir sem texto.",
    );
  });

  it("listas vazias", () => {
    expect(
      textoVazio({
        lista: "vence_em_breve",
        janela: 15,
        todos: false,
        semContato: false,
      }),
    ).toBe("Ninguém vence nos próximos 15 dias.");
    expect(
      textoVazio({
        lista: "vencido",
        janela: 7,
        todos: false,
        semContato: false,
      }),
    ).toBe("Ninguém venceu nos últimos 90 dias.");
    expect(
      textoVazio({
        lista: "vencido",
        janela: 7,
        todos: true,
        semContato: false,
      }),
    ).toBe("Nenhum aluno vencido.");
    expect(
      textoVazio({
        lista: "vencido",
        janela: 7,
        todos: false,
        semContato: true,
      }),
    ).toBe("Todos os vencidos dos últimos 90 dias já receberam contato.");
    expect(
      textoVazio({
        lista: "vencido",
        janela: 7,
        todos: true,
        semContato: true,
      }),
    ).toBe("Todos os vencidos já receberam contato.");
  });
});
