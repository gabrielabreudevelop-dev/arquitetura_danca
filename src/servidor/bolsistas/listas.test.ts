import { describe, expect, it } from "vitest";
import type {
  PessoaDeContato,
  UltimoContato,
} from "../contatos/pessoa-de-contato";
import type { BolsistaCarregado } from "./carga";
import {
  contarBolsistas,
  filtrarBolsistas,
  lerFiltrosBolsistas,
  linhasBolsistasSemVir,
  urlBolsistas,
} from "./listas";

const HOJE = "2026-11-26";
const AGORA = new Date("2026-11-26T15:00:00Z");
let seq = 0;

function contatoDe(
  id: string,
  o: Partial<PessoaDeContato> = {},
): PessoaDeContato {
  return {
    pessoaId: id,
    nome: `Contato ${id}`,
    whatsapp: "5527999990000",
    ehResponsavel: false,
    usandoNumeroDoResponsavel: false,
    naoQuerContato: false,
    ...o,
  };
}

function contatoHaDias(dias: number): UltimoContato {
  return {
    grupoId: `g${dias}`,
    em: new Date(AGORA.getTime() - dias * 86_400_000),
    por: "Ana",
    resultado: null,
  };
}

function bolsista(
  nome: string,
  o: Partial<BolsistaCarregado> & {
    sv?: Partial<Record<7 | 15 | 30, boolean>>;
    ultima?: string | null;
  } = {},
): BolsistaCarregado {
  seq++;
  const { sv, ultima = null, ...resto } = o;
  const sem = (j: 7 | 15 | 30) => ({
    semVir: sv?.[j] ?? false,
    ultimaPresenca: ultima,
  });
  return {
    id: `b${seq}`,
    nome,
    whatsapp: null,
    email: null,
    instagram: null,
    nascimento: "1990-01-01",
    menor: false,
    ativo: true,
    preferencia: "os_dois",
    acordos: [],
    historico: [],
    diasHoje: [2],
    dias: new Map(),
    responsavel: null,
    contato: contatoDe(`p${seq}`),
    ultimoContato: null,
    ultimoContatoGeral: null,
    mes: { combinados: 0, presentes: 0, fora: 0 },
    semVir: { 7: sem(7), 15: sem(15), 30: sem(30) },
    ...resto,
  };
}

describe("lerFiltrosBolsistas e urlBolsistas", () => {
  it("valores inválidos voltam aos padrões", () => {
    expect(lerFiltrosBolsistas({ situacao: "x", janela: "9" })).toEqual({
      situacao: "ativos",
      janela: 15,
    });
  });

  it("lê busca, inativos e janela", () => {
    expect(
      lerFiltrosBolsistas({
        busca: " ana ",
        situacao: "inativos",
        janela: "30",
      }),
    ).toEqual({ busca: "ana", situacao: "inativos", janela: 30 });
  });

  it("a url omite os padrões e mantém a ordem", () => {
    expect(urlBolsistas({ situacao: "ativos", janela: 15 })).toBe(
      "/painel/bolsistas",
    );
    expect(
      urlBolsistas({ busca: "ana", situacao: "inativos", janela: 7 }),
    ).toBe("/painel/bolsistas?busca=ana&situacao=inativos&janela=7");
  });
});

describe("filtrarBolsistas", () => {
  const todos = [
    bolsista("Zélia"),
    bolsista("Ângela"),
    bolsista("Bia", { ativo: false }),
  ];

  it("separa ativos e inativos, em ordem de nome", () => {
    expect(
      filtrarBolsistas(todos, { situacao: "ativos", janela: 15 }).map(
        (b) => b.nome,
      ),
    ).toEqual(["Ângela", "Zélia"]);
    expect(
      filtrarBolsistas(todos, { situacao: "inativos", janela: 15 }).map(
        (b) => b.nome,
      ),
    ).toEqual(["Bia"]);
  });

  it("busca por nome sem acento", () => {
    expect(
      filtrarBolsistas(todos, {
        busca: "angela",
        situacao: "ativos",
        janela: 15,
      }).map((b) => b.nome),
    ).toEqual(["Ângela"]);
  });
});

describe("contarBolsistas", () => {
  it("ativos e porDia (seg→dom, só dias com algum)", () => {
    const todos = [
      bolsista("A", { diasHoje: [2, 4] }),
      bolsista("B", { diasHoje: [0, 2] }),
      bolsista("C", { ativo: false, diasHoje: [2] }),
      bolsista("D", { diasHoje: null }),
    ];
    const c = contarBolsistas(todos, 15);
    expect(c.ativos).toBe(3);
    expect(c.porDia).toEqual([
      { dia: 2, quantidade: 2 },
      { dia: 4, quantidade: 1 },
      { dia: 0, quantidade: 1 },
    ]);
  });

  it("bate com filtrarBolsistas e com a soma das linhas sem vir", () => {
    const irmaoA = bolsista("Irmão A", {
      menor: true,
      contato: contatoDe("resp", { ehResponsavel: true }),
      sv: { 15: true },
      ultima: "2026-11-01",
    });
    const irmaoB = bolsista("Irmão B", {
      menor: true,
      contato: contatoDe("resp", { ehResponsavel: true }),
      sv: { 15: true },
      ultima: "2026-11-02",
    });
    const todos = [
      irmaoA,
      irmaoB,
      bolsista("Outro", { sv: { 15: true } }),
      bolsista("Bloqueado", {
        sv: { 15: true },
        contato: contatoDe("bq", { naoQuerContato: true }),
      }),
      bolsista("Em dia"),
      bolsista("Inativo", { ativo: false }),
    ];
    const c = contarBolsistas(todos, 15);
    const linhas = linhasBolsistasSemVir(todos, 15, HOJE, AGORA);
    expect(c.ativos).toBe(
      filtrarBolsistas(todos, { situacao: "ativos", janela: 15 }).length,
    );
    expect(c.semVir).toBe(linhas.reduce((s, l) => s + l.bolsistas.length, 0));
    expect(c.semVir).toBe(3);
  });
});

describe("linhasBolsistasSemVir", () => {
  it("irmãos menores com o mesmo responsável ficam numa linha", () => {
    const resp = contatoDe("resp", { ehResponsavel: true });
    const linhas = linhasBolsistasSemVir(
      [
        bolsista("Bruno", { contato: resp, sv: { 7: true } }),
        bolsista("Alice", { contato: resp, sv: { 7: true } }),
      ],
      7,
      HOJE,
      AGORA,
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0].bolsistas.map((b) => b.nome)).toEqual(["Alice", "Bruno"]);
  });

  it("ordena pela última presença mais antiga, nunca veio primeiro", () => {
    const linhas = linhasBolsistasSemVir(
      [
        bolsista("Recente", { sv: { 7: true }, ultima: "2026-11-20" }),
        bolsista("Antiga", { sv: { 7: true }, ultima: "2026-10-01" }),
        bolsista("Nunca", { sv: { 7: true }, ultima: null }),
      ],
      7,
      HOJE,
      AGORA,
    );
    expect(linhas.map((l) => l.bolsistas[0].nome)).toEqual([
      "Nunca",
      "Antiga",
      "Recente",
    ]);
  });

  it("contatados há menos de 7 dias vão para o fim, na mesma ordem", () => {
    const linhas = linhasBolsistasSemVir(
      [
        bolsista("A", {
          sv: { 7: true },
          ultima: "2026-10-01",
          ultimoContatoGeral: contatoHaDias(2),
        }),
        bolsista("B", { sv: { 7: true }, ultima: "2026-10-10" }),
        bolsista("C", {
          sv: { 7: true },
          ultima: "2026-10-20",
          ultimoContatoGeral: contatoHaDias(10),
        }),
      ],
      7,
      HOJE,
      AGORA,
    );
    expect(linhas.map((l) => l.bolsistas[0].nome)).toEqual(["B", "C", "A"]);
    expect(linhas[2].recente?.grupoId).toBe("g2");
    expect(linhas[1].recente).toBeNull();
  });

  it("o recente cruza os tipos de lista; o último contato não", () => {
    const aluno = contatoHaDias(1);
    const [linha] = linhasBolsistasSemVir(
      [bolsista("A", { sv: { 7: true }, ultimoContatoGeral: aluno })],
      7,
      HOJE,
      AGORA,
    );
    expect(linha.recente).toEqual(aluno);
    expect(linha.ultimoContato).toBeNull();
  });

  it("quem não quer contato, inativos e quem não está sem vir ficam fora", () => {
    const linhas = linhasBolsistasSemVir(
      [
        bolsista("Bloq", {
          sv: { 7: true },
          contato: contatoDe("x", { naoQuerContato: true }),
        }),
        bolsista("Inativo", { ativo: false, sv: { 7: true } }),
        bolsista("Em dia", { sv: { 15: true } }),
      ],
      7,
      HOJE,
      AGORA,
    );
    expect(linhas).toEqual([]);
  });
});
