/**
 * R16: toda escrita do M2 passa por `executarTraduzindo` (ou
 * `transacaoComErros`), então uma falha do banco nunca sobe com a consulta e
 * os parâmetros (dados pessoais) na mensagem. O banco falso rejeita qualquer
 * consulta com um `DrizzleQueryError` cheio de dados.
 */
import { DrizzleQueryError } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cadastrarAluno, tornarAluno } from "./alunos/cadastro";
import { matricular } from "./alunos/matriculas";
import { anularAjuste, estender } from "./alunos/periodos";
import type { Banco } from "./banco/cliente";
import { MENSAGEM_FALHA_BANCO } from "./cadastros/comum";
import {
  excluirMensagem,
  salvarMensagem,
} from "./configuracoes/mensagens-prontas";
import { salvarPlano } from "./configuracoes/planos";
import { salvarUnidadeAjustes } from "./configuracoes/unidade";
import {
  desfazerNaoQuerContato,
  marcarNaoQuerContato,
  marcarResultado,
  registrarContato,
} from "./contatos/contatos";

const DADO = "Ana Souza +5527999990000";
const ID = "0b3f6f1e-5c1a-4f5e-9d2a-3a1c2b4d5e6f";

/** Qualquer cadeia de chamadas devolve o próprio proxy; esperar por ele rejeita. */
function bancoQueFalha(): Banco {
  const erro = () =>
    new DrizzleQueryError(
      "select $1",
      [DADO],
      Object.assign(new Error(DADO), { code: "XX000" }),
    );
  const proxy: unknown = new Proxy(() => {}, {
    get(_alvo, chave) {
      if (chave === "then") {
        return (_ok: unknown, falhou: (e: unknown) => unknown) =>
          falhou(erro());
      }
      return proxy;
    },
    apply() {
      return proxy;
    },
  });
  return proxy as Banco;
}

let log: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  log = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

const HOJE = "2026-11-25";

const casos: [string, (db: Banco) => Promise<unknown>][] = [
  [
    "registrarContato",
    (db) =>
      registrarContato(
        db,
        { alunoIds: [ID], lista: "vencido", feitoPor: ID },
        HOJE,
      ),
  ],
  [
    "marcarResultado",
    (db) =>
      marcarResultado(db, {
        pessoaId: ID,
        grupoIds: [ID],
        resultado: "vai_pensar",
        feitoPor: ID,
      }),
  ],
  [
    "marcarNaoQuerContato",
    (db) => marcarNaoQuerContato(db, { pessoaId: ID, feitoPor: ID }),
  ],
  [
    "desfazerNaoQuerContato",
    (db) => desfazerNaoQuerContato(db, { pessoaId: ID, feitoPor: ID }),
  ],
  ["excluirMensagem", (db) => excluirMensagem(db, ID)],
  [
    "salvarMensagem",
    (db) =>
      salvarMensagem(db, {
        nome: "Oi",
        finalidade: "retorno",
        texto: "Oi, {nome}!",
        ativa: true,
      }),
  ],
  ["salvarUnidadeAjustes", (db) => salvarUnidadeAjustes(db, "dias")],
  [
    "salvarPlano",
    (db) =>
      salvarPlano(db, {
        nome: "Mensal",
        quantidade: 1,
        unidade: "meses",
        ordem: 0,
        ativo: true,
      }),
  ],
  ["tornarAluno", (db) => tornarAluno(db, ID)],
  [
    "cadastrarAluno",
    (db) =>
      cadastrarAluno(
        db,
        {
          nome: "Ana Souza",
          nascimento: "1990-01-01",
          whatsapp: "27999990000",
          email: "",
          instagram: "",
        },
        ID,
        HOJE,
      ),
  ],
  [
    "matricular",
    (db) =>
      matricular(db, { alunoId: ID, turmaId: ID, entrada: HOJE, feitoPor: ID }),
  ],
  [
    "estender",
    (db) =>
      estender(
        db,
        {
          alunoId: ID,
          quantidade: 1,
          unidade: "dias",
          motivo: "X",
          feitoPor: ID,
        },
        HOJE,
      ),
  ],
  [
    "anularAjuste",
    (db) => anularAjuste(db, { ajusteId: ID, motivo: "X", feitoPor: ID }),
  ],
];

describe("escritas do M2 com o banco fora do ar", () => {
  it.each(
    casos,
  )('%s relança só "Falha no banco de dados."', async (_nome, chamar) => {
    const erro = await chamar(bancoQueFalha()).then(
      () => null,
      (e: unknown) => e,
    );
    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe(MENSAGEM_FALHA_BANCO);
    expect((erro as Error).cause).toBeUndefined();
    const logado = log.mock.calls.flat().map(String).join(" ");
    expect(logado).not.toContain("Ana");
  });
});
