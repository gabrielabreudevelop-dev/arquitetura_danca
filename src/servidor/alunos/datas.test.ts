import { describe, expect, it } from "vitest";
import {
  diasEntre,
  ehDataIso,
  ehMenor,
  fimPeloPlano,
  formatarDataCompleta,
  formatarDia,
  hojeEmSaoPaulo,
  idadeEm,
  somarDias,
  somarMeses,
} from "./datas";

describe("hojeEmSaoPaulo", () => {
  it("usa o dia de São Paulo, não o do UTC", () => {
    expect(hojeEmSaoPaulo(new Date("2026-11-23T02:30:00Z"))).toBe("2026-11-22");
    expect(hojeEmSaoPaulo(new Date("2026-11-23T03:00:00Z"))).toBe("2026-11-23");
  });
});

describe("somarDias e diasEntre", () => {
  it("soma dias atravessando mês e ano", () => {
    expect(somarDias("2026-12-30", 3)).toBe("2027-01-02");
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("conta a diferença em dias (ate - de)", () => {
    expect(diasEntre("2026-12-01", "2026-12-20")).toBe(19);
    expect(diasEntre("2026-12-20", "2026-12-01")).toBe(-19);
  });
});

describe("somarMeses", () => {
  it("mantém o dia quando ele existe", () => {
    expect(somarMeses("2026-11-05", 1)).toBe("2026-12-05");
  });
  it("dia inexistente no destino vira dia 1 do mês seguinte", () => {
    expect(somarMeses("2027-01-31", 1)).toBe("2027-03-01");
  });
});

describe("fimPeloPlano", () => {
  it.each([
    ["2026-11-05", { quantidade: 1, unidade: "meses" }, "2026-12-04"],
    ["2027-01-31", { quantidade: 1, unidade: "meses" }, "2027-02-28"],
    ["2028-01-31", { quantidade: 1, unidade: "meses" }, "2028-02-29"],
    ["2026-11-30", { quantidade: 3, unidade: "meses" }, "2027-02-28"],
    ["2026-11-05", { quantidade: 30, unidade: "dias" }, "2026-12-04"],
  ] as const)("%s + %o -> %s", (inicio, duracao, fim) => {
    expect(fimPeloPlano(inicio, duracao)).toBe(fim);
  });
});

describe("formatação", () => {
  it("formata dia e data completa", () => {
    expect(formatarDia("2026-12-08")).toBe("08/12");
    expect(formatarDataCompleta("2026-12-08")).toBe("08/12/2026");
  });
});

describe("idade", () => {
  it("conta anos completos", () => {
    expect(idadeEm("2008-11-23", "2026-11-22")).toBe(17);
    expect(idadeEm("2008-11-22", "2026-11-22")).toBe(18);
  });
  it("ehMenor acompanha a idade (< 18)", () => {
    expect(ehMenor("2008-11-23", "2026-11-22")).toBe(true);
    expect(ehMenor("2008-11-22", "2026-11-22")).toBe(false);
  });
  it("nascido em 29/02 faz 18 em 01/03", () => {
    expect(ehMenor("2008-02-29", "2026-02-28")).toBe(true);
    expect(ehMenor("2008-02-29", "2026-03-01")).toBe(false);
  });
});

describe("ehDataIso", () => {
  it("valida formato e existência do dia", () => {
    expect(ehDataIso("2026-02-30")).toBe(false);
    expect(ehDataIso("2026-02-28")).toBe(true);
    expect(ehDataIso("28/02/2026")).toBe(false);
  });
});
