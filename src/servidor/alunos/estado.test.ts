import { describe, expect, it } from "vitest";
import {
  calcularEstado,
  diasRestantes,
  fimEfetivo,
  type PeriodoParaEstado,
  type TrancamentoParaEstado,
  ultimoPeriodo,
  venceEmBreve,
  vencidoDesde,
} from "./estado";

const HOJE = "2026-11-22";

function periodo(
  inicio: string,
  fim: string,
  diasAjustes = 0,
  id = `${inicio}`,
): PeriodoParaEstado {
  return { id, inicio, fim, diasAjustes };
}

function tranca(inicio: string, volta: string | null): TrancamentoParaEstado {
  return { id: "t1", periodoId: "p1", inicio, volta };
}

function resumo(
  periodos: PeriodoParaEstado[],
  trancamentos: TrancamentoParaEstado[] = [],
  encerrado = false,
  hoje = HOJE,
) {
  return calcularEstado({ encerrado, periodos, trancamentos }, hoje);
}

describe("fimEfetivo e ultimoPeriodo", () => {
  it("soma os dias dos ajustes ao fim", () => {
    expect(fimEfetivo(periodo("2026-11-01", "2026-11-20", 3))).toBe(
      "2026-11-23",
    );
  });

  it("sem limite no início: o período vazio termina no dia anterior ao início (R14)", () => {
    expect(fimEfetivo(periodo("2026-11-10", "2026-11-12", -3))).toBe(
      "2026-11-09",
    );
  });

  it("no mesmo início, o último é o que não está vazio", () => {
    const vazio = periodo("2026-12-01", "2026-12-31", -31, "vazio");
    const novo = periodo("2026-12-01", "2026-12-20", 0, "novo");
    expect(ultimoPeriodo([vazio, novo])?.id).toBe("novo");
    expect(ultimoPeriodo([novo, vazio])?.id).toBe("novo");
  });

  it("o último período é o de maior início", () => {
    const a = periodo("2026-12-01", "2026-12-31");
    const b = periodo("2026-11-01", "2026-11-30");
    expect(ultimoPeriodo([b, a])?.inicio).toBe("2026-12-01");
    expect(ultimoPeriodo([])).toBeNull();
  });
});

describe("calcularEstado", () => {
  it("sem períodos é sem_periodo", () => {
    const r = resumo([]);
    expect(r.estado).toBe("sem_periodo");
    expect(r.ultimo).toBeNull();
    expect(r.trancamentoAberto).toBeNull();
  });

  it("encerrado vence o período vigente", () => {
    expect(resumo([periodo("2026-11-01", "2026-11-30")], [], true).estado).toBe(
      "encerrado",
    );
  });

  it("o último dia ainda conta como vigente", () => {
    expect(resumo([periodo("2026-11-01", "2026-11-22")]).estado).toBe(
      "vigente",
    );
  });

  it("um dia depois do fim é vencido", () => {
    expect(resumo([periodo("2026-11-01", "2026-11-21")]).estado).toBe(
      "vencido",
    );
  });

  it("ajustes estendem o fim efetivo", () => {
    const r = resumo([periodo("2026-11-01", "2026-11-20", 3)]);
    expect(r.estado).toBe("vigente");
    expect(r.ultimo?.fimEfetivo).toBe("2026-11-23");
  });

  it("vencido com renovação futura começa em breve", () => {
    const r = resumo([
      periodo("2026-10-01", "2026-10-31"),
      periodo("2026-12-01", "2026-12-31"),
    ]);
    expect(r.estado).toBe("comeca_em_breve");
    expect(r.ultimo?.inicio).toBe("2026-12-01");
  });

  it("só período futuro também começa em breve", () => {
    expect(resumo([periodo("2026-12-01", "2026-12-31")]).estado).toBe(
      "comeca_em_breve",
    );
  });

  it("período vigente com renovação futura continua vigente", () => {
    const r = resumo([
      periodo("2026-11-01", "2026-11-30"),
      periodo("2026-12-01", "2027-02-28"),
    ]);
    expect(r.estado).toBe("vigente");
    expect(venceEmBreve(r, HOJE, 7)).toBe(false);
  });

  it("ultimo vale também para encerrado e vencido", () => {
    const r = resumo([periodo("2026-10-01", "2026-10-31")], [], true);
    expect(r.estado).toBe("encerrado");
    expect(r.ultimo?.fimEfetivo).toBe("2026-10-31");
  });

  describe("período vazio (todos os dias cedidos, R14)", () => {
    it("com início hoje, não é vigente: é vencido e o fim exibido é a véspera do início", () => {
      const r = resumo([periodo("2026-11-22", "2026-12-21", -30)]);
      expect(r.estado).toBe("vencido");
      expect(r.ultimo?.fimEfetivo).toBe("2026-11-21");
    });

    it("com início no futuro, conta como vencido, não como começa em breve", () => {
      const r = resumo([periodo("2026-12-01", "2026-12-10", -10)]);
      expect(r.estado).toBe("vencido");
      expect(r.ultimo?.fimEfetivo).toBe("2026-11-30");
    });

    it("um período anterior ainda vigente continua valendo", () => {
      const r = resumo([
        periodo("2026-11-01", "2026-11-30"),
        periodo("2026-12-01", "2026-12-10", -10),
      ]);
      expect(r.estado).toBe("vigente");
    });
  });

  describe("trancamento", () => {
    const vigente = [periodo("2026-11-01", "2026-11-30")];

    it("sem volta e já iniciado é trancado", () => {
      const t = tranca("2026-11-10", null);
      const r = resumo(vigente, [t]);
      expect(r.estado).toBe("trancado");
      expect(r.trancamentoAberto).toEqual(t);
    });

    it("volta hoje já não está trancado", () => {
      const r = resumo(vigente, [tranca("2026-11-10", "2026-11-22")]);
      expect(r.estado).toBe("vigente");
      expect(r.trancamentoAberto).toBeNull();
    });

    it("volta amanhã ainda está trancado", () => {
      expect(resumo(vigente, [tranca("2026-11-10", "2026-11-23")]).estado).toBe(
        "trancado",
      );
    });

    it("trancamento que começa depois de hoje não tranca hoje", () => {
      const r = resumo(vigente, [tranca("2026-11-25", null)]);
      expect(r.estado).toBe("vigente");
      expect(r.trancamentoAberto).toBeNull();
    });
  });
});

describe("venceEmBreve", () => {
  const com = (fim: string) => resumo([periodo("2026-11-01", fim)]);

  it("inclui o limite da janela", () => {
    expect(venceEmBreve(com("2026-11-22"), HOJE, 7)).toBe(true);
    expect(venceEmBreve(com("2026-11-29"), HOJE, 7)).toBe(true);
    expect(venceEmBreve(com("2026-11-30"), HOJE, 7)).toBe(false);
    expect(venceEmBreve(com("2026-11-30"), HOJE, 15)).toBe(true);
  });

  it("só vale para vigente", () => {
    expect(
      venceEmBreve(resumo([periodo("2026-10-01", "2026-10-31")]), HOJE, 30),
    ).toBe(false);
  });
});

describe("vencidoDesde", () => {
  it("considera o fim efetivo dentro da janela de dias", () => {
    const r = (fim: string) => resumo([periodo("2026-06-01", fim)]);
    expect(vencidoDesde(r("2026-08-24"), HOJE, 90)).toBe(true);
    expect(vencidoDesde(r("2026-08-23"), HOJE, 90)).toBe(false);
  });

  it("só vale para vencido", () => {
    expect(
      vencidoDesde(resumo([periodo("2026-11-01", "2026-11-30")]), HOJE, 90),
    ).toBe(false);
  });
});

describe("diasRestantes", () => {
  it("conta o dia de hoje", () => {
    expect(
      diasRestantes(resumo([periodo("2026-11-01", "2026-11-30")]), HOJE),
    ).toBe(9);
  });

  it("usa só o último período, a partir do início dele", () => {
    const r = resumo([
      periodo("2026-11-01", "2026-11-30"),
      periodo("2026-12-01", "2026-12-10"),
    ]);
    expect(diasRestantes(r, HOJE)).toBe(10);
  });

  it("é 0 quando não está vigente", () => {
    expect(
      diasRestantes(resumo([periodo("2026-10-01", "2026-10-31")]), HOJE),
    ).toBe(0);
    expect(diasRestantes(resumo([]), HOJE)).toBe(0);
  });
});
