import { describe, expect, it } from "vitest";
import {
  contaDaExtensao,
  contaDaPausa,
  contaDaTransferencia,
  diasDaQuantidade,
  filtrarPorNome,
  fimPeloPlanoOuVazio,
  fraseDoFim,
  lerAlvoAnular,
  textoRestam,
} from "./calculos";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const TERCA_QUINTA = { turmaId: "t1", diasPorSemana: 2 };
const SEXTA = { turmaId: "t2", diasPorSemana: 1 };

describe("fimPeloPlanoOuVazio", () => {
  it("calcula o fim pelo plano", () => {
    expect(
      fimPeloPlanoOuVazio("2026-11-05", { quantidade: 1, unidade: "meses" }),
    ).toBe("2026-12-04");
    expect(
      fimPeloPlanoOuVazio("2026-11-05", { quantidade: 15, unidade: "dias" }),
    ).toBe("2026-11-19");
  });

  it("sem plano ou com data inválida: vazio", () => {
    expect(fimPeloPlanoOuVazio("2026-11-05", undefined)).toBe("");
    expect(
      fimPeloPlanoOuVazio("2026-02-30", { quantidade: 1, unidade: "meses" }),
    ).toBe("");
    expect(fimPeloPlanoOuVazio("", { quantidade: 1, unidade: "meses" })).toBe(
      "",
    );
  });
});

describe("fraseDoFim", () => {
  it("mostra o antes e o depois", () => {
    expect(fraseDoFim("2026-12-08", "2026-12-12")).toBe(
      "Fim passa de 08/12 para 12/12",
    );
  });
});

describe("diasDaQuantidade", () => {
  it("dias: a própria quantidade", () => {
    expect(diasDaQuantidade("5", "dias", [], "")).toBe(5);
  });

  it("aulas com uma turma só: usa ela", () => {
    expect(diasDaQuantidade("1", "aulas", [TERCA_QUINTA], "")).toBe(4);
  });

  it("aulas com duas turmas: precisa da escolhida", () => {
    expect(diasDaQuantidade("1", "aulas", [TERCA_QUINTA, SEXTA], "")).toBe(
      null,
    );
    expect(diasDaQuantidade("1", "aulas", [TERCA_QUINTA, SEXTA], "t2")).toBe(7);
  });

  it("quantidade inválida, sem turma ou turma sem dias: nulo", () => {
    for (const q of ["", "0", "-1", "1.5", "abc"]) {
      expect(diasDaQuantidade(q, "dias", [], "")).toBe(null);
    }
    expect(diasDaQuantidade("1", "aulas", [], "")).toBe(null);
    expect(
      diasDaQuantidade("1", "aulas", [{ turmaId: "t3", diasPorSemana: 0 }], ""),
    ).toBe(null);
  });
});

describe("contaDaExtensao", () => {
  it("dias", () => {
    expect(contaDaExtensao("2026-12-08", "4", "dias", [], "")).toBe(
      "Fim passa de 08/12 para 12/12 (+4 dias).",
    );
  });

  it("aulas, com os dias calculados", () => {
    expect(
      contaDaExtensao("2026-12-08", "2", "aulas", [TERCA_QUINTA], ""),
    ).toBe("Fim passa de 08/12 para 15/12 (2 aulas = 7 dias).");
    expect(contaDaExtensao("2026-12-08", "1", "aulas", [SEXTA], "")).toBe(
      "Fim passa de 08/12 para 15/12 (1 aula = 7 dias).",
    );
  });

  it("sem conta possível: nulo", () => {
    expect(contaDaExtensao("2026-12-08", "", "dias", [], "")).toBe(null);
  });
});

describe("contaDaPausa", () => {
  it("dias parados e o novo fim", () => {
    expect(contaDaPausa("2026-12-01", "2026-12-20", "2026-12-31")).toBe(
      "19 dias parados. Fim passa de 31/12 para 19/01.",
    );
    expect(contaDaPausa("2026-12-01", "2026-12-02", "2026-12-31")).toBe(
      "1 dia parado. Fim passa de 31/12 para 01/01.",
    );
  });

  it("volta inválida ou antes do início: nulo", () => {
    expect(contaDaPausa("2026-12-01", "", "2026-12-31")).toBe(null);
    expect(contaDaPausa("2026-12-01", "2026-12-01", "2026-12-31")).toBe(null);
    expect(contaDaPausa("", "2026-12-20", "2026-12-31")).toBe(null);
  });

  it("sem fim conhecido: só os dias", () => {
    expect(contaDaPausa("2026-12-01", "2026-12-20", null)).toBe(
      "19 dias parados.",
    );
  });
});

describe("contaDaTransferencia", () => {
  it("diz como fica o fim de quem cede", () => {
    expect(
      contaDaTransferencia({
        nome: "Ana",
        fimAtual: "2026-12-08",
        restantes: 14,
        quantidade: "4",
        unidade: "dias",
        turmas: [],
        turmaId: "",
      }),
    ).toBe("Fim de Ana passa de 08/12 para 04/12 (−4 dias).");
  });

  it("acima do que resta: avisa", () => {
    expect(
      contaDaTransferencia({
        nome: "Ana",
        fimAtual: "2026-12-08",
        restantes: 3,
        quantidade: "1",
        unidade: "aulas",
        turmas: [TERCA_QUINTA],
        turmaId: "",
      }),
    ).toBe("1 aula = 4 dias: mais do que os 3 dias que restam.");
  });

  it("sem conta possível: nulo", () => {
    expect(
      contaDaTransferencia({
        nome: "Ana",
        fimAtual: "2026-12-08",
        restantes: 3,
        quantidade: "x",
        unidade: "dias",
        turmas: [],
        turmaId: "",
      }),
    ).toBe(null);
  });
});

describe("textoRestam", () => {
  it("singular e plural", () => {
    expect(textoRestam(9)).toBe("Restam 9 dias para transferir.");
    expect(textoRestam(1)).toBe("Resta 1 dia para transferir.");
  });
});

describe("filtrarPorNome", () => {
  const lista = [
    { id: "1", nome: "João Souza" },
    { id: "2", nome: "Ana Lima" },
    { id: "3", nome: "Joana Prado" },
  ];

  it("sem acento nem maiúsculas", () => {
    expect(filtrarPorNome(lista, "joao").map((p) => p.id)).toEqual(["1"]);
    expect(filtrarPorNome(lista, "  JO ").map((p) => p.id)).toEqual(["1", "3"]);
  });

  it("busca vazia: todos", () => {
    expect(filtrarPorNome(lista, "")).toHaveLength(3);
  });
});

describe("lerAlvoAnular", () => {
  it("aceita os quatro tipos com um uuid", () => {
    for (const tipo of ["ajuste", "periodo", "trancamento", "transferencia"]) {
      expect(lerAlvoAnular(tipo, ID)).toEqual({ tipo, id: ID });
    }
  });

  it("normaliza o uuid para minúsculas", () => {
    expect(lerAlvoAnular("ajuste", ID.toUpperCase())).toEqual({
      tipo: "ajuste",
      id: ID,
    });
  });

  it("recusa tipo desconhecido, lote (Tarefa 15) e alvo que não é uuid", () => {
    expect(lerAlvoAnular("lote", ID)).toBe(null);
    expect(lerAlvoAnular("constructor", ID)).toBe(null);
    expect(lerAlvoAnular("ajuste", "x")).toBe(null);
    expect(lerAlvoAnular(undefined, ID)).toBe(null);
    expect(lerAlvoAnular(["ajuste"], ID)).toBe(null);
  });
});
