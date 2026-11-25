import { describe, expect, it } from "vitest";
import {
  codigoDoErro,
  mensagemDoErro,
  validarPedidoAbrir,
} from "./pedido-abrir";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

function cabecalhos(valores: Record<string, string>): Headers {
  return new Headers(valores);
}

function formulario(campos: [string, string][]): FormData {
  const form = new FormData();
  for (const [nome, valor] of campos) form.append(nome, valor);
  return form;
}

const MESMA = {
  host: "painel.exemplo.dev",
  origin: "https://painel.exemplo.dev",
};
const VALIDO = formulario([
  ["aluno", A],
  ["aluno", B],
  ["lista", "vencido"],
]);

describe("validarPedidoAbrir", () => {
  it("aceita pedido da mesma origem com alunos e lista válidos", () => {
    expect(validarPedidoAbrir(cabecalhos(MESMA), VALIDO)).toEqual({
      tipo: "ok",
      alunoIds: [A, B],
      lista: "vencido",
    });
  });

  it("aceita a porta no host (desenvolvimento)", () => {
    expect(
      validarPedidoAbrir(
        cabecalhos({ host: "localhost:3000", origin: "http://localhost:3000" }),
        VALIDO,
      ).tipo,
    ).toBe("ok");
  });

  it("usa o host repassado pelo proxy, quando houver", () => {
    expect(
      validarPedidoAbrir(
        cabecalhos({
          host: "app:3000",
          "x-forwarded-host": "painel.exemplo.dev",
          origin: "https://painel.exemplo.dev",
        }),
        VALIDO,
      ).tipo,
    ).toBe("ok");
  });

  it.each([
    ["sem Origin", { host: "painel.exemplo.dev" }],
    [
      "Origin de outro site",
      { host: "painel.exemplo.dev", origin: "https://evil.com" },
    ],
    ["Origin nula", { host: "painel.exemplo.dev", origin: "null" }],
    [
      "subdomínio parecido",
      {
        host: "painel.exemplo.dev",
        origin: "https://painel.exemplo.dev.evil.com",
      },
    ],
    [
      "porta diferente",
      { host: "localhost:3000", origin: "http://localhost:4000" },
    ],
    ["sem host", { origin: "https://painel.exemplo.dev" }],
  ])("recusa %s (403)", (_nome, valores) => {
    expect(validarPedidoAbrir(cabecalhos(valores), VALIDO)).toEqual({
      tipo: "proibido",
    });
  });

  it("a origem é conferida antes do formulário", () => {
    expect(
      validarPedidoAbrir(
        cabecalhos({ host: "painel.exemplo.dev", origin: "https://evil.com" }),
        formulario([["lista", "x"]]),
      ),
    ).toEqual({ tipo: "proibido" });
  });

  it.each([
    ["sem aluno", [["lista", "vencido"]]],
    [
      "aluno que não é uuid",
      [
        ["aluno", "abc"],
        ["lista", "vencido"],
      ],
    ],
    [
      "um dos alunos inválido",
      [
        ["aluno", A],
        ["aluno", "1 or 1=1"],
        ["lista", "vencido"],
      ],
    ],
  ] as [string, [string, string][]][])("%s → erro aluno", (_nome, campos) => {
    expect(validarPedidoAbrir(cabecalhos(MESMA), formulario(campos))).toEqual({
      tipo: "erro",
      codigo: "aluno",
    });
  });

  it.each([
    ["sem lista", [["aluno", A]]],
    [
      "lista fora do enum",
      [
        ["aluno", A],
        ["lista", "todos"],
      ],
    ],
  ] as [string, [string, string][]][])("%s → erro lista", (_nome, campos) => {
    expect(validarPedidoAbrir(cabecalhos(MESMA), formulario(campos))).toEqual({
      tipo: "erro",
      codigo: "lista",
    });
  });

  it("aceita as três listas e normaliza os ids", () => {
    for (const lista of ["vence_em_breve", "vencido", "ficha"]) {
      const r = validarPedidoAbrir(
        cabecalhos(MESMA),
        formulario([
          ["aluno", A.toUpperCase()],
          ["lista", lista],
        ]),
      );
      expect(r).toEqual({ tipo: "ok", alunoIds: [A], lista });
    }
  });
});

describe("códigos de erro", () => {
  it("cada erro conhecido do serviço tem código e volta à mesma mensagem", () => {
    for (const mensagem of [
      "Aluno não encontrado.",
      "Esses alunos não têm o mesmo contato.",
      "Esta pessoa pediu para não ser contatada.",
      "Cadastre um WhatsApp antes de chamar.",
      "Este aluno está encerrado. Reabra o cadastro antes.",
    ]) {
      const codigo = codigoDoErro(mensagem);
      expect(codigo).not.toBe("erro");
      expect(mensagemDoErro(codigo)).toBe(mensagem);
    }
  });

  it("mensagem desconhecida vira o código genérico", () => {
    expect(codigoDoErro("qualquer coisa")).toBe("erro");
    expect(mensagemDoErro("erro")).toBe(
      "Não foi possível abrir o WhatsApp. Tente de novo.",
    );
  });

  it("código desconhecido ou texto livre não vira mensagem", () => {
    expect(mensagemDoErro("<script>")).toBeNull();
    expect(mensagemDoErro("Aluno não encontrado.")).toBeNull();
    expect(mensagemDoErro(undefined)).toBeNull();
    expect(mensagemDoErro("constructor")).toBeNull();
  });
});
