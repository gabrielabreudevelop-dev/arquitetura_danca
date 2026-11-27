import { describe, expect, it } from "vitest";
import { diasMarcados, lerDadosBolsista, lerDias } from "./dados";

const RESP = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

function form(campos: [string, string][]): FormData {
  const f = new FormData();
  for (const [k, v] of campos) f.append(k, v);
  return f;
}

const BASICO: [string, string][] = [
  ["nome", "Bruno Lima"],
  ["nascimento", "2000-05-10"],
  ["whatsapp", "27 99999-0000"],
  ["email", ""],
  ["instagram", ""],
];

describe("lerDias", () => {
  it("lê as caixas marcadas como números de 0 a 6", () => {
    expect(
      lerDias(
        form([
          ["dias", "2"],
          ["dias", "4"],
          ["dias", "0"],
        ]),
      ),
    ).toEqual([2, 4, 0]);
  });

  it("ignora o que não é dia da semana", () => {
    expect(
      lerDias(
        form([
          ["dias", "abc"],
          ["dias", "7"],
          ["dias", "-1"],
          ["dias", "3"],
        ]),
      ),
    ).toEqual([3]);
  });

  it("sem caixa marcada, nenhum dia", () => {
    expect(lerDias(form([]))).toEqual([]);
  });
});

describe("diasMarcados", () => {
  it("volta o texto dos valores para os dias", () => {
    expect(diasMarcados("2,4")).toEqual(new Set([2, 4]));
    expect(diasMarcados("")).toEqual(new Set());
    expect(diasMarcados(undefined)).toEqual(new Set());
  });
});

describe("lerDadosBolsista", () => {
  it("lê os dados da pessoa, os dias e a preferência, sem turmas", () => {
    const { dados, valores } = lerDadosBolsista(
      form([
        ...BASICO,
        ["dias", "2"],
        ["dias", "4"],
        ["preferencia", "conduzir"],
      ]),
    );
    expect(dados).toEqual({
      nome: "Bruno Lima",
      nascimento: "2000-05-10",
      whatsapp: "27 99999-0000",
      email: "",
      instagram: "",
      responsavel: { nome: "", whatsapp: "", email: "", novo: false },
      confirmarWhatsappRepetido: false,
      dias: [2, 4],
      preferencia: "conduzir",
    });
    expect(valores.dias).toBe("2,4");
    expect(valores.preferencia).toBe("conduzir");
    expect(valores).not.toHaveProperty("turmaIds");
  });

  it("responsável já cadastrado e confirmação do WhatsApp repetido", () => {
    const { dados, valores } = lerDadosBolsista(
      form([
        ...BASICO,
        ["nascimento", "2012-05-10"],
        ["responsavelId", RESP],
        ["responsavelExistenteNome", "Carla Lima"],
        ["confirmarWhatsappRepetido", "1"],
        ["preferencia", "os_dois"],
      ]),
    );
    expect(dados.responsavel).toEqual({ pessoaId: RESP });
    expect(dados.confirmarWhatsappRepetido).toBe(true);
    expect(dados.dias).toEqual([]);
    expect(valores.responsavelExistenteNome).toBe("Carla Lima");
    expect(valores.dias).toBe("");
  });

  it("sem preferência marcada, texto vazio (o serviço recusa)", () => {
    const { dados } = lerDadosBolsista(form(BASICO));
    expect(dados.preferencia).toBe("");
  });
});
