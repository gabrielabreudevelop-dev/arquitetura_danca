import { describe, expect, it } from "vitest";
import type { ResumoPeriodo } from "@/servidor/alunos/estado";
import { textoDoEstado, textoDoPeriodo, textoDoResultado } from "./textos";

function resumo(
  estado: ResumoPeriodo["estado"],
  ultimo: { inicio: string; fim: string; fimEfetivo: string } | null = {
    inicio: "2026-09-01",
    fim: "2026-12-01",
    fimEfetivo: "2026-12-12",
  },
  trancadoDesde?: string,
): ResumoPeriodo {
  return {
    estado,
    ultimo: ultimo && { id: "p1", diasAjustes: 0, ...ultimo },
    trancamentoAberto: trancadoDesde
      ? { id: "t1", periodoId: "p1", inicio: trancadoDesde, volta: null }
      : null,
  };
}

describe("textoDoEstado", () => {
  it("vigente diz quando vence (fim efetivo)", () => {
    expect(textoDoEstado(resumo("vigente"))).toBe("vence em 12/12");
  });

  it("vencido diz quando venceu", () => {
    const r = resumo("vencido", {
      inicio: "2026-08-03",
      fim: "2026-11-02",
      fimEfetivo: "2026-11-02",
    });
    expect(textoDoEstado(r)).toBe("venceu em 02/11");
  });

  it("trancado diz desde quando", () => {
    expect(textoDoEstado(resumo("trancado", undefined, "2026-11-22"))).toBe(
      "trancado desde 22/11",
    );
  });

  it("começa em breve diz quando começa", () => {
    const r = resumo("comeca_em_breve", {
      inicio: "2026-12-01",
      fim: "2027-02-28",
      fimEfetivo: "2027-02-28",
    });
    expect(textoDoEstado(r)).toBe("começa em 01/12");
  });

  it("sem período e encerrado", () => {
    expect(textoDoEstado(resumo("sem_periodo", null))).toBe("sem período");
    expect(textoDoEstado(resumo("encerrado"))).toBe("encerrado");
  });
});

describe("textoDoPeriodo", () => {
  it("com ajustes que estendem", () => {
    const r = resumo("vigente", {
      inicio: "2026-09-01",
      fim: "2026-12-01",
      fimEfetivo: "2026-12-08",
    });
    expect(textoDoPeriodo("Trimestral", r)).toBe(
      "Trimestral · 01/09 a 01/12, estendido até 08/12",
    );
  });

  it("sem ajustes", () => {
    const r = resumo("vigente", {
      inicio: "2026-09-01",
      fim: "2026-12-01",
      fimEfetivo: "2026-12-01",
    });
    expect(textoDoPeriodo("Trimestral", r)).toBe("Trimestral · 01/09 a 01/12");
  });

  it("com dias cedidos encurta o fim", () => {
    const r = resumo("vigente", {
      inicio: "2026-09-01",
      fim: "2026-12-01",
      fimEfetivo: "2026-11-20",
    });
    expect(textoDoPeriodo("Trimestral", r)).toBe(
      "Trimestral · 01/09 a 01/12, encurtado até 20/11",
    );
  });

  it("período recebido em transferência não tem plano", () => {
    const r = resumo("vigente", {
      inicio: "2026-11-10",
      fim: "2026-11-23",
      fimEfetivo: "2026-11-23",
    });
    expect(textoDoPeriodo(null, r)).toBe("Período recebido · 10/11 a 23/11");
  });

  it("sem período, nada", () => {
    expect(textoDoPeriodo(null, resumo("sem_periodo", null))).toBeNull();
  });
});

describe("textoDoResultado", () => {
  it("traduz o resultado do contato", () => {
    expect(textoDoResultado("vai_pensar")).toBe("vai pensar");
    expect(textoDoResultado("nao_quer_contato")).toBe("não quer contato");
  });
});
