import { describe, expect, it } from "vitest";
import type { DataIso } from "../alunos/datas";
import {
  acordoVigenteEm,
  ativoEm,
  type Dia,
  frequencia,
  type MudancaSituacao,
  semVir,
  ultimaMudanca,
  type VersaoAcordo,
} from "./regras";

const criado = (n: number) => new Date(2026, 0, 1, 0, 0, n);

const acordos: VersaoAcordo[] = [
  { dias: [2], vigenteDesde: "2026-09-01", criadoEm: criado(1) },
  { dias: [4], vigenteDesde: "2026-11-16", criadoEm: criado(2) },
];
const ativoDesdeSetembro: MudancaSituacao[] = [
  { tipo: "ativacao", data: "2026-09-01", criadoEm: criado(1) },
];

function mapa(
  chamadas: DataIso[],
  presentes: DataIso[],
  semAula: DataIso[] = [],
): Map<DataIso, Dia> {
  const m = new Map<DataIso, Dia>();
  for (const data of chamadas) {
    m.set(data, { data, comChamada: true, presente: presentes.includes(data) });
  }
  for (const data of semAula) {
    m.set(data, { data, comChamada: false, presente: false });
  }
  return m;
}

const chamadasNovembro = [
  "2026-11-03",
  "2026-11-05",
  "2026-11-10",
  "2026-11-12",
  "2026-11-17",
  "2026-11-26",
];
const presentesNovembro = ["2026-11-03", "2026-11-05", "2026-11-26"];

describe("acordoVigenteEm", () => {
  it("usa a versão de maior vigenteDesde até a data", () => {
    expect(acordoVigenteEm(acordos, "2026-11-10")).toEqual([2]);
    expect(acordoVigenteEm(acordos, "2026-11-19")).toEqual([4]);
    expect(acordoVigenteEm(acordos, "2026-11-16")).toEqual([4]);
  });

  it("devolve null antes de qualquer versão", () => {
    expect(acordoVigenteEm(acordos, "2026-08-31")).toBeNull();
    expect(acordoVigenteEm([], "2026-11-10")).toBeNull();
  });

  it("no empate de vigenteDesde vale a registrada por último", () => {
    const empate: VersaoAcordo[] = [
      { dias: [1], vigenteDesde: "2026-09-01", criadoEm: criado(5) },
      { dias: [3], vigenteDesde: "2026-09-01", criadoEm: criado(9) },
      { dias: [5], vigenteDesde: "2026-09-01", criadoEm: criado(2) },
    ];
    expect(acordoVigenteEm(empate, "2026-09-02")).toEqual([3]);
  });
});

describe("ativoEm", () => {
  const historico: MudancaSituacao[] = [
    { tipo: "ativacao", data: "2026-09-01", criadoEm: criado(1) },
    { tipo: "inativacao", data: "2026-11-10", criadoEm: criado(2) },
    { tipo: "ativacao", data: "2026-11-20", criadoEm: criado(3) },
  ];

  it("segue a última mudança até a data", () => {
    expect(ativoEm(historico, "2026-11-05")).toBe(true);
    expect(ativoEm(historico, "2026-11-10")).toBe(false);
    expect(ativoEm(historico, "2026-11-15")).toBe(false);
    expect(ativoEm(historico, "2026-11-20")).toBe(true);
  });

  it("é falso sem nenhuma mudança até a data", () => {
    expect(ativoEm(historico, "2026-08-31")).toBe(false);
    expect(ativoEm([], "2026-11-05")).toBe(false);
  });

  it("no empate de data vale a mudança registrada por último", () => {
    const h: MudancaSituacao[] = [
      { tipo: "ativacao", data: "2026-09-01", criadoEm: criado(1) },
      { tipo: "inativacao", data: "2026-09-01", criadoEm: criado(2) },
    ];
    expect(ativoEm(h, "2026-09-01")).toBe(false);
  });
});

describe("frequencia", () => {
  const dias = mapa(chamadasNovembro, presentesNovembro, ["2026-11-24"]);

  it("conta combinados, presentes e fora do acordo em novembro", () => {
    expect(
      frequencia(
        { acordos, historico: ativoDesdeSetembro, dias },
        "2026-11-01",
        "2026-11-26",
      ),
    ).toEqual({ combinados: 3, presentes: 2, fora: 1 });
  });

  it("deixa de fora os dias em que estava inativo", () => {
    const historico: MudancaSituacao[] = [
      ...ativoDesdeSetembro,
      { tipo: "inativacao", data: "2026-11-08", criadoEm: criado(2) },
      { tipo: "ativacao", data: "2026-11-20", criadoEm: criado(3) },
    ];
    expect(
      frequencia({ acordos, historico, dias }, "2026-11-01", "2026-11-26"),
    ).toEqual({ combinados: 2, presentes: 2, fora: 1 });
  });

  it("devolve zeros quando de é depois de ate", () => {
    expect(
      frequencia(
        { acordos, historico: ativoDesdeSetembro, dias },
        "2026-11-26",
        "2026-11-01",
      ),
    ).toEqual({ combinados: 0, presentes: 0, fora: 0 });
  });

  it("presença num dia do acordo sem chamada não conta como fora", () => {
    const dias = new Map<DataIso, Dia>([
      ["2026-11-10", { data: "2026-11-10", comChamada: false, presente: true }],
    ]);
    expect(
      frequencia(
        { acordos, historico: ativoDesdeSetembro, dias },
        "2026-11-01",
        "2026-11-26",
      ),
    ).toEqual({ combinados: 0, presentes: 0, fora: 0 });
  });

  it("presença antes de qualquer acordo conta como fora", () => {
    const historico: MudancaSituacao[] = [
      { tipo: "ativacao", data: "2026-08-01", criadoEm: criado(1) },
    ];
    const dias = mapa(["2026-08-15"], ["2026-08-15"]);
    expect(
      frequencia({ acordos, historico, dias }, "2026-08-01", "2026-08-31"),
    ).toEqual({ combinados: 0, presentes: 0, fora: 1 });
  });
});

describe("semVir", () => {
  const hoje = "2026-11-26";
  const soTerca: VersaoAcordo[] = [
    { dias: [2], vigenteDesde: "2026-09-01", criadoEm: criado(1) },
  ];

  it("é sem vir com terças com chamada e nenhuma presença no intervalo", () => {
    const dias = mapa(
      ["2026-11-03", "2026-11-17", "2026-11-24"],
      ["2026-11-03"],
    );
    expect(
      semVir(
        { acordos: soTerca, historico: ativoDesdeSetembro, dias },
        hoje,
        15,
      ),
    ).toEqual({ semVir: true, ultimaPresenca: "2026-11-03" });
  });

  it("não é sem vir quando nenhum dia do intervalo teve chamada", () => {
    const dias = mapa(["2026-11-03"], ["2026-11-03"], ["2026-11-17"]);
    expect(
      semVir(
        { acordos: soTerca, historico: ativoDesdeSetembro, dias },
        hoje,
        15,
      ).semVir,
    ).toBe(false);
  });

  it("não é sem vir quando veio fora do combinado no intervalo", () => {
    const dias = mapa(["2026-11-17", "2026-11-19"], ["2026-11-19"]);
    expect(
      semVir(
        { acordos: soTerca, historico: ativoDesdeSetembro, dias },
        hoje,
        15,
      ),
    ).toEqual({ semVir: false, ultimaPresenca: "2026-11-19" });
  });

  it("não é sem vir se está inativo hoje", () => {
    const historico: MudancaSituacao[] = [
      ...ativoDesdeSetembro,
      { tipo: "inativacao", data: "2026-11-05", criadoEm: criado(2) },
    ];
    const dias = mapa(["2026-11-17", "2026-11-24"], []);
    expect(semVir({ acordos: soTerca, historico, dias }, hoje, 15).semVir).toBe(
      false,
    );
  });

  it("não é sem vir se as chamadas do intervalo foram só enquanto inativo", () => {
    const historico: MudancaSituacao[] = [
      ...ativoDesdeSetembro,
      { tipo: "inativacao", data: "2026-11-05", criadoEm: criado(2) },
      { tipo: "ativacao", data: "2026-11-25", criadoEm: criado(3) },
    ];
    const dias = mapa(["2026-11-17", "2026-11-24"], []);
    expect(semVir({ acordos: soTerca, historico, dias }, hoje, 15).semVir).toBe(
      false,
    );
  });

  it("quem nunca veio e tem chamada combinada é sem vir, sem última presença", () => {
    const dias = mapa(["2026-11-17"], []);
    expect(
      semVir(
        { acordos: soTerca, historico: ativoDesdeSetembro, dias },
        hoje,
        15,
      ),
    ).toEqual({ semVir: true, ultimaPresenca: null });
  });

  const umaQuinta: VersaoAcordo[] = [
    { dias: [4], vigenteDesde: "2026-09-01", criadoEm: criado(1) },
  ];

  it("o primeiro dia da janela conta: janela 15 pega 12/11, janela 14 não", () => {
    const dias = mapa(["2026-11-12"], []);
    const e = { acordos: umaQuinta, historico: ativoDesdeSetembro, dias };
    expect(semVir(e, hoje, 15).semVir).toBe(true);
    expect(semVir(e, hoje, 14).semVir).toBe(false);
  });

  it("com janela 1 só hoje conta", () => {
    const e = (chamadas: DataIso[]) => ({
      acordos: umaQuinta,
      historico: ativoDesdeSetembro,
      dias: mapa(chamadas, []),
    });
    expect(semVir(e(["2026-11-26"]), hoje, 1).semVir).toBe(true);
    expect(semVir(e(["2026-11-19"]), hoje, 1).semVir).toBe(false);
  });
});

describe("ultimaMudanca", () => {
  it("sem histórico, nenhuma", () => {
    expect(ultimaMudanca([])).toBeNull();
  });

  it("a de maior data; no empate, a registrada por último", () => {
    const historico: MudancaSituacao[] = [
      { tipo: "ativacao", data: "2026-09-01", criadoEm: criado(1) },
      { tipo: "inativacao", data: "2026-10-12", criadoEm: criado(3) },
      { tipo: "ativacao", data: "2026-10-12", criadoEm: criado(4) },
      { tipo: "inativacao", data: "2026-10-01", criadoEm: criado(5) },
    ];
    expect(ultimaMudanca(historico)).toEqual(historico[2]);
  });
});
