import { describe, expect, it } from "vitest";
import {
  DIAS_SEMANA,
  dataHoraLocalParaInstante,
  formatarDataCurta,
  formatarDataEvento,
  formatarDias,
  formatarHora,
  formatarHorario,
  gerarSlug,
  instanteParaDataHoraLocal,
  urlDaGrade,
} from "./texto";

describe("gerarSlug", () => {
  it("remove acentos, pontuação e espaços sobrando", () => {
    expect(gerarSlug("Samba de Gafieira")).toBe("samba-de-gafieira");
    expect(gerarSlug("  Forró & Xote!! ")).toBe("forro-xote");
    expect(gerarSlug("Baile de Dezembro 2026")).toBe("baile-de-dezembro-2026");
  });
});

describe("DIAS_SEMANA", () => {
  it("usa sab na URL e sáb na exibição", () => {
    expect(DIAS_SEMANA).toHaveLength(7);
    expect(DIAS_SEMANA[6]).toEqual({
      numero: 6,
      curto: "sab",
      exibicao: "sáb",
    });
    expect(DIAS_SEMANA[0]?.exibicao).toBe("dom");
  });
});

describe("formatarDias", () => {
  it("junta os dias em ordem", () => {
    expect(formatarDias([4, 2])).toBe("ter e qui");
    expect(formatarDias([1, 3, 5])).toBe("seg, qua e sex");
    expect(formatarDias([6])).toBe("sáb");
  });
});

describe("formatarHora", () => {
  it("hora do banco em texto curto", () => {
    expect(formatarHora("19:00:00")).toBe("19h");
    expect(formatarHora("08:05")).toBe("8h05");
  });
});

describe("formatarHorario", () => {
  it("omite minutos zerados", () => {
    expect(formatarHorario("19:00:00", "20:00:00")).toBe("19h–20h");
    expect(formatarHorario("19:30", "20:30")).toBe("19h30–20h30");
  });
});

describe("fuso de São Paulo", () => {
  it("converte datetime-local em instante", () => {
    expect(dataHoraLocalParaInstante("2026-12-13T21:00").toISOString()).toBe(
      "2026-12-14T00:00:00.000Z",
    );
  });
  it("converte instante em datetime-local", () => {
    expect(instanteParaDataHoraLocal(new Date("2026-12-14T00:00:00Z"))).toBe(
      "2026-12-13T21:00",
    );
  });
  it("respeita o horário de verão histórico (UTC-2)", () => {
    expect(dataHoraLocalParaInstante("2018-12-13T21:00").toISOString()).toBe(
      "2018-12-13T23:00:00.000Z",
    );
  });
});

describe("formatarDataEvento", () => {
  it("sem fim", () => {
    expect(formatarDataEvento(new Date("2026-12-14T00:00:00Z"), null)).toBe(
      "dom, 13 de dezembro · 21h",
    );
  });
  it("fim na madrugada seguinte mostra só a hora", () => {
    expect(
      formatarDataEvento(
        new Date("2026-12-14T00:00:00Z"),
        new Date("2026-12-14T05:00:00Z"),
      ),
    ).toBe("dom, 13 de dezembro · 21h–2h");
  });
  it("fim em outro dia depois do meio-dia mostra as duas datas", () => {
    expect(
      formatarDataEvento(
        new Date("2026-12-13T12:00:00Z"),
        new Date("2026-12-14T21:00:00Z"),
      ),
    ).toBe("dom, 13 de dezembro, 9h – seg, 14 de dezembro, 18h");
  });
});

describe("formatarDataCurta", () => {
  it("usa dia/mês no fuso de São Paulo", () => {
    expect(formatarDataCurta(new Date("2026-12-14T00:00:00Z"))).toBe("13/12");
  });
});

describe("urlDaGrade", () => {
  it("monta o endereço com os filtros em ordem fixa", () => {
    expect(urlDaGrade("forro", {})).toBe("/grade/forro");
    expect(urlDaGrade("forro", { dia: "ter", modulo: "iniciante" })).toBe(
      "/grade/forro?modulo=iniciante&dia=ter",
    );
    expect(urlDaGrade("forro", { dia: "sab" })).toBe("/grade/forro?dia=sab");
  });
});
