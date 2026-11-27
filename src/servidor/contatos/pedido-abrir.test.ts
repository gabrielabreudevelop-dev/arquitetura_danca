import { describe, expect, it, vi } from "vitest";
import {
  codigoDoErro,
  mensagemDoErro,
  responderAbrir,
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
      janela: 7,
      visto: null,
      confirmar: false,
    });
  });

  it("lê a janela da lista: 7, 15 ou 30; inválida vira o padrão da lista", () => {
    const janela = (lista: string, valor?: string) => {
      const campos: [string, string][] = [
        ["aluno", A],
        ["lista", lista],
      ];
      if (valor !== undefined) campos.push(["janela", valor]);
      const r = validarPedidoAbrir(cabecalhos(MESMA), formulario(campos));
      return r.tipo === "ok" ? r.janela : null;
    };
    expect(janela("bolsista_ausente")).toBe(15);
    expect(janela("bolsista_ausente", "7")).toBe(7);
    expect(janela("bolsista_ausente", "30")).toBe(30);
    expect(janela("bolsista_ausente", "x")).toBe(15);
    expect(janela("bolsista_ausente", "14")).toBe(15);
    expect(janela("vence_em_breve", "30")).toBe(30);
    expect(janela("vencido")).toBe(7);
  });

  it("lê o último contato visto e a confirmação (R17)", () => {
    expect(
      validarPedidoAbrir(
        cabecalhos(MESMA),
        formulario([
          ["aluno", A],
          ["lista", "vencido"],
          ["visto", B.toUpperCase()],
          ["confirmar", "1"],
        ]),
      ),
    ).toMatchObject({ tipo: "ok", visto: B, confirmar: true });
  });

  it("visto vazio ou inválido vale como nenhum; confirmar só com 1", () => {
    for (const [visto, confirmar] of [
      ["", "0"],
      ["abc", "sim"],
    ]) {
      expect(
        validarPedidoAbrir(
          cabecalhos(MESMA),
          formulario([
            ["aluno", A],
            ["lista", "vencido"],
            ["visto", visto],
            ["confirmar", confirmar],
          ]),
        ),
      ).toMatchObject({ tipo: "ok", visto: null, confirmar: false });
    }
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

  it("aceita as cinco listas e normaliza os ids", () => {
    for (const lista of [
      "vence_em_breve",
      "vencido",
      "ficha",
      "bolsista_ausente",
      "ficha_bolsista",
    ]) {
      const r = validarPedidoAbrir(
        cabecalhos(MESMA),
        formulario([
          ["aluno", A.toUpperCase()],
          ["lista", lista],
        ]),
      );
      expect(r).toEqual({
        tipo: "ok",
        alunoIds: [A],
        lista,
        janela: lista === "bolsista_ausente" ? 15 : 7,
        visto: null,
        confirmar: false,
      });
    }
  });
});

describe("códigos de erro", () => {
  it("cada erro conhecido do serviço tem código e volta à mesma mensagem", () => {
    for (const mensagem of [
      "Aluno não encontrado.",
      "Esses alunos não têm o mesmo contato.",
      "Bolsista não encontrado.",
      "Esses bolsistas não têm o mesmo contato.",
      "Este bolsista está inativo. Reative antes.",
      "Este bolsista voltou a vir. A lista foi atualizada.",
      "Esta pessoa pediu para não ser contatada.",
      "Cadastre um WhatsApp antes de chamar.",
      "Este aluno está encerrado. Reabra o cadastro antes.",
      "Outra pessoa da equipe já chamou este contato hoje. Confira antes de chamar de novo.",
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

describe("responderAbrir", () => {
  const PEDIDO_OK = () =>
    formulario([
      ["aluno", A],
      ["lista", "vencido"],
    ]);

  function dependencias(
    registrar: Parameters<typeof responderAbrir>[2]["registrar"],
    sessao: { pessoaId: string } | null = { pessoaId: B },
  ) {
    return { sessao: vi.fn(async () => sessao), registrar: vi.fn(registrar) };
  }

  it("origem errada: 403 sem olhar a sessão", async () => {
    const d = dependencias(async () => ({ ok: true, valor: { url: "x" } }));
    expect(
      await responderAbrir(
        cabecalhos({ host: "painel.exemplo.dev", origin: "https://evil.com" }),
        PEDIDO_OK(),
        d,
      ),
    ).toEqual({ status: 403 });
    expect(d.sessao).not.toHaveBeenCalled();
    expect(d.registrar).not.toHaveBeenCalled();
  });

  it("sem sessão da administração: 403 sem registrar", async () => {
    const d = dependencias(
      async () => ({ ok: true, valor: { url: "x" } }),
      null,
    );
    expect(await responderAbrir(cabecalhos(MESMA), PEDIDO_OK(), d)).toEqual({
      status: 403,
    });
    expect(d.registrar).not.toHaveBeenCalled();
  });

  it("formulário inválido: volta com o código, sem registrar", async () => {
    const d = dependencias(async () => ({ ok: true, valor: { url: "x" } }));
    expect(
      await responderAbrir(
        cabecalhos(MESMA),
        formulario([["lista", "vencido"]]),
        d,
      ),
    ).toEqual({ status: 303, location: "/painel/contatos?erro=aluno" });
    expect(d.registrar).not.toHaveBeenCalled();
  });

  it("registrado: 303 para o link, com quem fez", async () => {
    const d = dependencias(async () => ({
      ok: true,
      valor: { url: "https://wa.me/5527999990000" },
    }));
    expect(await responderAbrir(cabecalhos(MESMA), PEDIDO_OK(), d)).toEqual({
      status: 303,
      location: "https://wa.me/5527999990000",
    });
    expect(d.registrar).toHaveBeenCalledWith({
      alunoIds: [A],
      lista: "vencido",
      janela: 7,
      feitoPor: B,
      visto: null,
      confirmar: false,
    });
  });

  describe("chamado há pouco por outra pessoa (R17)", () => {
    const RECENTE = async () => ({
      ok: false as const,
      erros: {
        _: "Outra pessoa da equipe já chamou este contato hoje. Confira antes de chamar de novo.",
      },
    });

    it("lista: volta à mesma lista e filtros, marcando a linha do aluno", async () => {
      const d = dependencias(RECENTE);
      const form = formulario([
        ["aluno", A],
        ["lista", "vencido"],
        ["visto", B],
        ["todos", "1"],
        ["sem_contato", "1"],
      ]);
      expect(await responderAbrir(cabecalhos(MESMA), form, d)).toEqual({
        status: 303,
        location: `/painel/contatos?lista=vencido&todos=1&sem_contato=1&erro=recente&aluno=${A}`,
      });
      expect(d.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ visto: B, confirmar: false }),
      );
    });

    it("vence em breve com janela de 30 dias", async () => {
      const d = dependencias(RECENTE);
      const form = formulario([
        ["aluno", A],
        ["lista", "vence_em_breve"],
        ["janela", "30"],
      ]);
      expect(await responderAbrir(cabecalhos(MESMA), form, d)).toEqual({
        status: 303,
        location: `/painel/contatos?janela=30&erro=recente&aluno=${A}`,
      });
    });

    it("ficha: volta à ficha do aluno", async () => {
      const d = dependencias(RECENTE);
      const form = formulario([
        ["aluno", A],
        ["lista", "ficha"],
      ]);
      expect(await responderAbrir(cabecalhos(MESMA), form, d)).toEqual({
        status: 303,
        location: `/painel/alunos/${A}?erro=recente`,
      });
    });

    it("com confirmar=1, o registro recebe a confirmação", async () => {
      const d = dependencias(async () => ({
        ok: true,
        valor: { url: "https://wa.me/5527999990000" },
      }));
      const form = formulario([
        ["aluno", A],
        ["lista", "vencido"],
        ["confirmar", "1"],
      ]);
      await responderAbrir(cabecalhos(MESMA), form, d);
      expect(d.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ confirmar: true }),
      );
    });
  });

  describe("listas de bolsista", () => {
    const INATIVO = async () => ({
      ok: false as const,
      erros: { _: "Este bolsista está inativo. Reative antes." },
    });
    const RECENTE = async () => ({
      ok: false as const,
      erros: {
        _: "Outra pessoa da equipe já chamou este contato hoje. Confira antes de chamar de novo.",
      },
    });

    it("erro vindo da ficha volta para a ficha do bolsista", async () => {
      const d = dependencias(INATIVO);
      const form = formulario([
        ["aluno", A],
        ["lista", "ficha_bolsista"],
      ]);
      expect(await responderAbrir(cabecalhos(MESMA), form, d)).toEqual({
        status: 303,
        location: `/painel/bolsistas/${A}?erro=inativo`,
      });
    });

    it("contato recente na ficha volta para a ficha com o código", async () => {
      const d = dependencias(RECENTE);
      const form = formulario([
        ["aluno", A],
        ["lista", "ficha_bolsista"],
      ]);
      expect(await responderAbrir(cabecalhos(MESMA), form, d)).toEqual({
        status: 303,
        location: `/painel/bolsistas/${A}?erro=recente`,
      });
    });

    it("erro vindo da lista volta para a aba de bolsistas, mantendo a janela", async () => {
      const d = dependencias(INATIVO);
      const form = formulario([
        ["aluno", A],
        ["lista", "bolsista_ausente"],
        ["janela", "30"],
      ]);
      expect(await responderAbrir(cabecalhos(MESMA), form, d)).toEqual({
        status: 303,
        location: `/painel/contatos?lista=bolsista_ausente&janela=30&erro=inativo`,
      });
    });

    it("recente na lista marca a linha do bolsista", async () => {
      const d = dependencias(RECENTE);
      const form = formulario([
        ["aluno", A],
        ["lista", "bolsista_ausente"],
      ]);
      expect(await responderAbrir(cabecalhos(MESMA), form, d)).toEqual({
        status: 303,
        location: `/painel/contatos?lista=bolsista_ausente&erro=recente&aluno=${A}`,
      });
    });

    it("fora da lista volta para a aba com a mesma janela, e o registro recebe a janela", async () => {
      const d = dependencias(async () => ({
        ok: false as const,
        erros: { _: "Este bolsista voltou a vir. A lista foi atualizada." },
      }));
      const form = formulario([
        ["aluno", A],
        ["lista", "bolsista_ausente"],
        ["janela", "7"],
      ]);
      expect(await responderAbrir(cabecalhos(MESMA), form, d)).toEqual({
        status: 303,
        location: `/painel/contatos?lista=bolsista_ausente&janela=7&erro=fora_da_lista`,
      });
      expect(d.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ lista: "bolsista_ausente", janela: 7 }),
      );
      expect(mensagemDoErro("fora_da_lista")).toBe(
        "Este bolsista voltou a vir. A lista foi atualizada.",
      );
    });

    it("bolsista não encontrado volta para a ficha com o código próprio", async () => {
      const d = dependencias(async () => ({
        ok: false as const,
        erros: { _: "Bolsista não encontrado." },
      }));
      const form = formulario([
        ["aluno", A],
        ["lista", "ficha_bolsista"],
      ]);
      expect(await responderAbrir(cabecalhos(MESMA), form, d)).toEqual({
        status: 303,
        location: `/painel/bolsistas/${A}?erro=bolsista`,
      });
    });

    it("janela inválida é descartada", async () => {
      const d = dependencias(INATIVO);
      const form = formulario([
        ["aluno", A],
        ["lista", "bolsista_ausente"],
        ["janela", "x"],
      ]);
      expect(await responderAbrir(cabecalhos(MESMA), form, d)).toEqual({
        status: 303,
        location: `/painel/contatos?lista=bolsista_ausente&erro=inativo`,
      });
    });
  });

  it("erro do serviço: volta com o código da mensagem", async () => {
    const d = dependencias(async () => ({
      ok: false,
      erros: { _: "Esta pessoa pediu para não ser contatada." },
    }));
    expect(await responderAbrir(cabecalhos(MESMA), PEDIDO_OK(), d)).toEqual({
      status: 303,
      location: "/painel/contatos?erro=bloqueado",
    });
  });

  it("falha inesperada: volta com erro genérico e não registra dados no log", async () => {
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const d = dependencias(async () => {
        throw new Error(
          "Failed query: insert … params: 5527999990000,Oi, Ana! Sentimos falta",
        );
      });
      expect(await responderAbrir(cabecalhos(MESMA), PEDIDO_OK(), d)).toEqual({
        status: 303,
        location: "/painel/contatos?erro=erro",
      });
      expect(espiao).toHaveBeenCalledTimes(1);
      expect(espiao).toHaveBeenCalledWith("Falha ao registrar um contato.");
    } finally {
      espiao.mockRestore();
    }
  });
});
