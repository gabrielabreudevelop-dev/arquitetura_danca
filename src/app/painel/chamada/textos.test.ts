import { describe, expect, it } from "vitest";
import {
  comMaiuscula,
  contar,
  lerPresentes,
  lerVersao,
  naDia,
  nomesDe,
  textoDaContagem,
  textoDaSituacao,
  tituloDoDia,
} from "./textos";

describe("contar", () => {
  it("conta quem está marcado, pela preferência", () => {
    expect(
      contar([
        { preferencia: "conduzir" },
        { preferencia: "conduzir" },
        { preferencia: "ser_conduzido" },
        { preferencia: "os_dois" },
      ]),
    ).toEqual({ vieram: 4, conduzir: 2, ser_conduzido: 1, os_dois: 1 });
    expect(contar([])).toEqual({
      vieram: 0,
      conduzir: 0,
      ser_conduzido: 0,
      os_dois: 0,
    });
  });
});

describe("textoDaContagem", () => {
  it("plural e singular", () => {
    expect(
      textoDaContagem({ vieram: 4, conduzir: 2, ser_conduzido: 2, os_dois: 0 }),
    ).toBe("4 vieram · 2 conduzem · 2 são conduzidos · 0 os dois");
    expect(
      textoDaContagem({ vieram: 3, conduzir: 1, ser_conduzido: 1, os_dois: 1 }),
    ).toBe("3 vieram · 1 conduz · 1 é conduzido · 1 os dois");
    expect(
      textoDaContagem({ vieram: 1, conduzir: 0, ser_conduzido: 0, os_dois: 1 }),
    ).toBe("1 veio · 0 conduzem · 0 são conduzidos · 1 os dois");
  });

  it("ninguém marcado", () => {
    expect(
      textoDaContagem({ vieram: 0, conduzir: 0, ser_conduzido: 0, os_dois: 0 }),
    ).toBe("Ninguém marcado");
  });
});

describe("textoDaSituacao", () => {
  it("as três situações", () => {
    expect(
      textoDaSituacao({ situacao: "sem_chamada", presentes: 0, motivo: null }),
    ).toBe("Sem chamada");
    expect(
      textoDaSituacao({ situacao: "realizada", presentes: 3, motivo: null }),
    ).toBe("3 presentes");
    expect(
      textoDaSituacao({ situacao: "realizada", presentes: 1, motivo: null }),
    ).toBe("1 presente");
    expect(
      textoDaSituacao({ situacao: "realizada", presentes: 0, motivo: null }),
    ).toBe("Ninguém veio");
    expect(
      textoDaSituacao({
        situacao: "nao_houve",
        presentes: 0,
        motivo: "feriado",
      }),
    ).toBe("Não houve aula · feriado");
    expect(
      textoDaSituacao({ situacao: "nao_houve", presentes: 0, motivo: null }),
    ).toBe("Não houve aula");
  });
});

describe("tituloDoDia", () => {
  it("dia da semana por extenso e a data; ano só se for outro", () => {
    expect(tituloDoDia("2026-11-24", "2026-11-26")).toBe("terça, 24/11");
    expect(tituloDoDia("2026-11-29", "2026-11-30")).toBe("domingo, 29/11");
    expect(tituloDoDia("2025-12-27", "2026-01-02")).toBe("sábado, 27/12/2025");
  });
});

describe("lerPresentes", () => {
  it("todos os campos `presentes`, sem vazios nem repetidos", () => {
    const form = new FormData();
    form.append("presentes", "A");
    form.append("presentes", " ");
    form.append("presentes", "b");
    form.append("presentes", "a");
    form.append("outro", "c");
    expect(lerPresentes(form)).toEqual(["a", "b"]);
    expect(lerPresentes(new FormData())).toEqual([]);
  });
});

describe("lerVersao", () => {
  it("inteiro não negativo; outra coisa vira -1 (o serviço avisa que mudou)", () => {
    const f = (v?: string) => {
      const form = new FormData();
      if (v !== undefined) form.set("versao", v);
      return lerVersao(form);
    };
    expect(f("0")).toBe(0);
    expect(f("7")).toBe(7);
    expect(f("")).toBe(-1);
    expect(f("1.5")).toBe(-1);
    expect(f("-2")).toBe(-1);
    expect(f("x")).toBe(-1);
    expect(f()).toBe(-1);
  });
});

describe("nomesDe", () => {
  it("nomes dos ids na ordem alfabética; ids sem nome ficam de fora", () => {
    const pessoas = [
      { pessoaId: "1", nome: "Carla" },
      { pessoaId: "2", nome: "Ana" },
      { pessoaId: "3", nome: "Bruno" },
    ];
    expect(nomesDe(["1", "2", "9"], pessoas)).toEqual(["Ana", "Carla"]);
    expect(nomesDe([], pessoas)).toEqual([]);
  });
});

describe("comMaiuscula", () => {
  it("só a primeira letra", () => {
    expect(comMaiuscula("terça, 24/11")).toBe("Terça, 24/11");
    expect(comMaiuscula("")).toBe("");
  });
});

describe("naDia", () => {
  it("“na” para dias de semana e “no” para sábado e domingo", () => {
    expect(naDia("2026-11-24")).toBe("na terça");
    expect(naDia("2026-11-23")).toBe("na segunda");
    expect(naDia("2026-11-28")).toBe("no sábado");
    expect(naDia("2026-11-29")).toBe("no domingo");
  });
});
