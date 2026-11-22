import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { obterFicha } from "@/servidor/alunos/ficha";
import { anularLote, confirmarLote } from "@/servidor/alunos/lotes";
import { matricular } from "@/servidor/alunos/matriculas";
import { anularPeriodo } from "@/servidor/alunos/periodos";
import { anularTrancamento, trancar } from "@/servidor/alunos/trancamentos";
import {
  anularTransferencia,
  transferir,
} from "@/servidor/alunos/transferencias";
import {
  ajustesPeriodo,
  bloqueiosContato,
  contatos,
  encerramentosAluno,
  lotesExtensao,
  loteTurmas,
  matriculas,
  mensagensProntas,
  periodosContratados,
  trancamentos,
  transferencias,
} from "@/servidor/banco/esquema";
import { criarBancoDeTeste } from "../apoio/banco";
import {
  criarAdministracao,
  criarAluno,
  criarModulo,
  criarPeriodo,
  criarPlano,
  criarProfessor,
  criarRitmo,
  criarTurma,
} from "../apoio/fabricas";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
let adm: Awaited<ReturnType<typeof criarAdministracao>>;

const HOJE = "2026-11-22";
const em = (iso: string) => new Date(`${iso}T15:00:00Z`);

beforeAll(async () => {
  banco = await criarBancoDeTeste();
  adm = await criarAdministracao(banco.db);
});
afterAll(async () => {
  await banco.encerrar();
});

async function turmaForro() {
  const ritmo = await criarRitmo(banco.db, { nome: "Forró" });
  const modulo = await criarModulo(banco.db, { nome: "Iniciante" });
  return criarTurma(banco.db, { ritmoId: ritmo.id, moduloId: modulo.id });
}

describe("obterFicha", () => {
  it("devolve null para id inválido, inexistente ou de quem não é aluno", async () => {
    const professor = await criarProfessor(banco.db);
    expect(await obterFicha(banco.db, "xyz", HOJE)).toBeNull();
    expect(await obterFicha(banco.db, randomUUID(), HOJE)).toBeNull();
    expect(await obterFicha(banco.db, professor.id, HOJE)).toBeNull();
  });

  it("junta tudo num histórico único, do mais recente ao mais antigo", async () => {
    const db = banco.db;
    const plano = await criarPlano(db, { nome: "Trimestral" });
    const ana = await criarAluno(db, { nome: "Ana Souza" });
    const joao = await criarAluno(db, { nome: "João Souza" });
    const turma = await turmaForro();

    const [periodo] = await db
      .insert(periodosContratados)
      .values({
        alunoId: ana.id,
        inicio: "2026-09-01",
        fim: "2026-12-01",
        planoId: plano.id,
        criadoPor: adm.id,
        criadoEm: em("2026-09-01"),
      })
      .returning();

    const [lote] = await db
      .insert(lotesExtensao)
      .values({
        todoEstudio: false,
        quantidadeDigitada: 1,
        unidadeDigitada: "aulas",
        motivo: "feriado 15/11",
        criadoPor: adm.id,
        criadoEm: em("2026-11-15"),
      })
      .returning();
    await db.insert(loteTurmas).values({ loteId: lote.id, turmaId: turma.id });
    const [loteTodo] = await db
      .insert(lotesExtensao)
      .values({
        todoEstudio: true,
        quantidadeDigitada: 3,
        unidadeDigitada: "dias",
        motivo: "recesso",
        criadoPor: adm.id,
        criadoEm: em("2026-11-16"),
      })
      .returning();

    const [extensao, linhaLote, linhaLoteTodo] = await db
      .insert(ajustesPeriodo)
      .values([
        {
          periodoId: periodo.id,
          tipo: "extensao",
          dias: 5,
          quantidadeDigitada: 5,
          unidadeDigitada: "dias",
          motivo: "feriado",
          criadoPor: adm.id,
          criadoEm: em("2026-10-01"),
        },
        {
          periodoId: periodo.id,
          tipo: "extensao",
          dias: 4,
          quantidadeDigitada: 1,
          unidadeDigitada: "aulas",
          turmaConversaoId: turma.id,
          motivo: "feriado 15/11",
          loteId: lote.id,
          criadoPor: adm.id,
          criadoEm: em("2026-11-15"),
        },
        {
          periodoId: periodo.id,
          tipo: "extensao",
          dias: 3,
          quantidadeDigitada: 3,
          unidadeDigitada: "dias",
          motivo: "recesso",
          loteId: loteTodo.id,
          criadoPor: adm.id,
          criadoEm: em("2026-11-16"),
        },
        {
          periodoId: periodo.id,
          tipo: "extensao",
          dias: 1,
          quantidadeDigitada: 1,
          unidadeDigitada: "dias",
          motivo: "engano",
          criadoPor: adm.id,
          criadoEm: em("2026-10-05"),
          anuladoEm: em("2026-10-06"),
          anuladoPor: adm.id,
          motivoAnulacao: "lançado errado",
        },
      ])
      .returning();

    // Trancamento fechado, com a linha do livro (que não vira item próprio).
    const [fechado] = await db
      .insert(trancamentos)
      .values({
        periodoId: periodo.id,
        inicio: "2026-12-01",
        volta: "2026-12-20",
        criadoPor: adm.id,
        criadoEm: em("2026-11-17"),
      })
      .returning();
    await db.insert(ajustesPeriodo).values({
      periodoId: periodo.id,
      tipo: "trancamento",
      dias: 19,
      quantidadeDigitada: 19,
      unidadeDigitada: "dias",
      trancamentoId: fechado.id,
      criadoPor: adm.id,
      criadoEm: em("2026-11-17"),
    });

    // Transferência de Ana para João (João recebe um período novo).
    const [periodoJoao] = await db
      .insert(periodosContratados)
      .values({
        alunoId: joao.id,
        inicio: "2026-11-24",
        fim: "2026-11-28",
        origem: "transferencia",
        criadoPor: adm.id,
        criadoEm: em("2026-11-18"),
      })
      .returning();
    const [transf] = await db
      .insert(transferencias)
      .values({
        periodoOrigemId: periodo.id,
        periodoDestinoId: periodoJoao.id,
        dias: 14,
        motivo: "viagem",
        criadoPor: adm.id,
        criadoEm: em("2026-11-18"),
      })
      .returning();
    await db.insert(ajustesPeriodo).values([
      {
        periodoId: periodo.id,
        tipo: "transferencia_saida",
        dias: -14,
        quantidadeDigitada: 14,
        unidadeDigitada: "dias",
        motivo: "viagem",
        transferenciaId: transf.id,
        criadoPor: adm.id,
        criadoEm: em("2026-11-18"),
      },
    ]);

    // Matrículas: uma aberta e uma encerrada.
    await db
      .insert(matriculas)
      .values([
        {
          alunoId: ana.id,
          turmaId: turma.id,
          entrada: "2026-03-03",
          criadoPor: adm.id,
          criadoEm: new Date("2026-03-03T16:00:00Z"),
        },
        {
          alunoId: ana.id,
          turmaId: (await criarTurma(db)).id,
          entrada: "2026-01-10",
          saida: "2026-03-03",
          criadoPor: adm.id,
          saidaPor: adm.id,
          criadoEm: em("2026-01-10"),
        },
      ])
      .returning();

    // Encerramento e reabertura.
    await db.insert(encerramentosAluno).values([
      {
        alunoId: ana.id,
        tipo: "encerramento",
        data: "2026-11-19",
        motivo: "mudou de cidade",
        criadoPor: adm.id,
        criadoEm: em("2026-11-19"),
      },
      {
        alunoId: ana.id,
        tipo: "reabertura",
        data: "2026-11-20",
        criadoPor: adm.id,
        criadoEm: em("2026-11-20"),
      },
    ]);

    const ficha = await obterFicha(db, ana.id, HOJE);
    expect(ficha).not.toBeNull();
    if (!ficha) return;
    expect(ficha.aluno.nome).toBe("Ana Souza");

    const rotulo = ficha.aluno.matriculas[0]?.rotulo;
    expect(rotulo).toBe("Forró Iniciante · ter e qui 19h");
    const rotuloAntiga = ficha.matriculasEncerradas[0]?.rotulo;
    expect(ficha.matriculasEncerradas).toEqual([
      { rotulo: rotuloAntiga, entrada: "2026-01-10", saida: "2026-03-03" },
    ]);

    expect(ficha.historico.map((i) => [i.tipo, i.texto])).toEqual([
      ["reabertura", "Cadastro reaberto"],
      ["encerramento", "Encerrado · mudou de cidade"],
      ["ajuste", "−14 dias · transferidos para João Souza"],
      ["trancamento", "Trancado de 01/12 a 20/12 (19 dias)"],
      ["ajuste", "+3 dias · recesso · lote estúdio todo"],
      ["ajuste", "+1 aula (4 dias) · feriado 15/11 · lote Forró Iniciante"],
      ["ajuste", "+1 dia · engano"],
      ["ajuste", "+5 dias · feriado"],
      ["periodo", "Período Trimestral · 01/09 a 01/12"],
      ["matricula", `Entrou em ${rotulo}`],
      ["saida_turma", `Saiu de ${rotuloAntiga}`],
      ["matricula", `Entrou em ${rotuloAntiga}`],
    ]);
    // Ordem sempre decrescente por `em`.
    const instantes = ficha.historico.map((i) => i.em.getTime());
    expect(instantes).toEqual([...instantes].sort((x, y) => y - x));

    const por = (texto: string) =>
      ficha.historico.find((i) => i.texto === texto);
    expect(por("+5 dias · feriado")).toMatchObject({
      por: adm.nome,
      anulado: null,
      anular: { tipo: "ajuste", id: extensao.id },
    });
    expect(
      por("+1 aula (4 dias) · feriado 15/11 · lote Forró Iniciante")?.anular,
    ).toEqual({ tipo: "ajuste", id: linhaLote.id });
    expect(por("+3 dias · recesso · lote estúdio todo")?.anular).toEqual({
      tipo: "ajuste",
      id: linhaLoteTodo.id,
    });
    expect(por("−14 dias · transferidos para João Souza")?.anular).toEqual({
      tipo: "transferencia",
      id: transf.id,
    });
    expect(por("Trancado de 01/12 a 20/12 (19 dias)")).toMatchObject({
      anular: { tipo: "trancamento", id: fechado.id },
    });
    expect(por("Trancado de 01/12 a 20/12 (19 dias)")?.destrancar).toBe(
      undefined,
    );
    expect(por("Período Trimestral · 01/09 a 01/12")?.anular).toEqual({
      tipo: "periodo",
      id: periodo.id,
    });
    // Item anulado: mostra a anulação e não oferece anular de novo.
    expect(por("+1 dia · engano")).toMatchObject({
      anular: null,
      anulado: {
        em: em("2026-10-06"),
        por: adm.nome,
        motivo: "lançado errado",
      },
    });
  });

  it("mostra período recebido, linha recebida, trancamento aberto e linhas antigas sem autor", async () => {
    const db = banco.db;
    const ana = await criarAluno(db, { nome: "Ana Souza" });
    const joao = await criarAluno(db, { nome: "João Souza" });
    const periodoAna = await criarPeriodo(db, {
      alunoId: ana.id,
      inicio: "2026-11-01",
      fim: "2026-11-30",
      criadoPor: adm.id,
    });
    const [periodoJoao] = await db
      .insert(periodosContratados)
      .values({
        alunoId: joao.id,
        inicio: "2026-11-24",
        fim: "2026-11-28",
        origem: "transferencia",
        criadoPor: adm.id,
        criadoEm: em("2026-11-10"),
      })
      .returning();
    const [transf] = await db
      .insert(transferencias)
      .values({
        periodoOrigemId: periodoAna.id,
        periodoDestinoId: periodoJoao.id,
        dias: 14,
        motivo: "viagem",
        criadoPor: adm.id,
        criadoEm: em("2026-11-10"),
      })
      .returning();
    await db
      .insert(ajustesPeriodo)
      .values({
        periodoId: periodoJoao.id,
        tipo: "transferencia_entrada",
        dias: 14,
        quantidadeDigitada: 14,
        unidadeDigitada: "dias",
        motivo: "viagem",
        transferenciaId: transf.id,
        criadoPor: adm.id,
        criadoEm: em("2026-11-11"),
      })
      .returning();
    const [aberto] = await db
      .insert(trancamentos)
      .values({
        periodoId: periodoJoao.id,
        inicio: "2026-11-22",
        criadoPor: adm.id,
        criadoEm: em("2026-11-22"),
      })
      .returning();
    // Linha do tempo antiga: período sem autor.
    await db.insert(periodosContratados).values({
      alunoId: joao.id,
      inicio: "2026-01-01",
      fim: "2026-01-31",
      criadoEm: em("2026-01-01"),
    });

    const ficha = await obterFicha(db, joao.id, HOJE);
    expect(ficha?.historico.map((i) => i.texto)).toEqual([
      "Trancado desde 22/11",
      "+14 dias · recebidos de Ana Souza",
      "Período recebido · 24/11 a 28/11",
      "Período · 01/01 a 31/01",
    ]);
    const [trancado, recebidos, recebido, antigo] = ficha?.historico ?? [];
    expect(trancado).toMatchObject({
      destrancar: aberto.id,
      anular: { tipo: "trancamento", id: aberto.id },
    });
    expect(recebidos.anular).toEqual({ tipo: "transferencia", id: transf.id });
    expect(recebido.anular).toEqual({ tipo: "transferencia", id: transf.id });
    expect(antigo.por).toBe("—");
  });

  it("traz contatos (mais novo primeiro), não-quer-contato e podeExcluir", async () => {
    const db = banco.db;
    const aluno = await criarAluno(db, { nome: "Bruno Lima" });
    expect((await obterFicha(db, aluno.id, HOJE))?.podeExcluir).toBe(true);
    const [msg] = await db
      .insert(mensagensProntas)
      .values({
        nome: "Convite de teste da ficha",
        finalidade: "retorno",
        ativa: false,
        texto: "Oi",
      })
      .returning();
    const grupo1 = randomUUID();
    const grupo2 = randomUUID();
    const base = {
      alunoId: aluno.id,
      pessoaContatoId: aluno.id,
      whatsapp: "+5511999999999",
      lista: "vencido" as const,
      criadoPor: adm.id,
    };
    await db.insert(contatos).values([
      {
        ...base,
        grupoId: grupo1,
        mensagemId: msg.id,
        criadoEm: em("2026-11-05"),
        resultado: "vai_pensar",
      },
      { ...base, grupoId: grupo2, criadoEm: em("2026-11-10") },
    ]);
    await db.insert(bloqueiosContato).values({
      pessoaId: aluno.id,
      marcadoPor: adm.id,
      marcadoEm: em("2026-11-12"),
    });
    const ficha = await obterFicha(db, aluno.id, HOJE);
    expect(ficha?.contatos).toEqual([
      {
        em: em("2026-11-10"),
        por: adm.nome,
        mensagem: null,
        resultado: null,
        grupoId: grupo2,
      },
      {
        em: em("2026-11-05"),
        por: adm.nome,
        mensagem: "Convite de teste da ficha",
        resultado: "vai_pensar",
        grupoId: grupo1,
      },
    ]);
    expect(ficha?.naoQuerContato).toEqual({
      em: em("2026-11-12"),
      por: adm.nome,
    });
    expect(ficha?.podeExcluir).toBe(false);
  });

  describe("anulações feitas pelos serviços", () => {
    function ok<T>(r: { ok: true; valor: T } | { ok: false; erros: unknown }) {
      if (!r.ok) throw new Error(JSON.stringify(r.erros));
      return r.valor;
    }
    const anulado = { por: () => adm.nome, motivo: "erro de lançamento" };

    it("transferência anulada: linha de saída, linha de entrada e período recebido", async () => {
      const db = banco.db;
      const plano = await criarPlano(db);
      const ana = await criarAluno(db, { nome: "Ana Souza" });
      const joao = await criarAluno(db, { nome: "João Souza" });
      const bia = await criarAluno(db, { nome: "Bia Souza" });
      for (const a of [ana, joao]) {
        await criarPeriodo(db, {
          alunoId: a.id,
          inicio: "2026-11-01",
          fim: "2026-11-30",
          criadoPor: adm.id,
          planoId: plano.id,
        });
      }
      const t = async (de: string, para: string) =>
        ok(
          await transferir(
            db,
            {
              deAlunoId: de,
              paraAlunoId: para,
              quantidade: 2,
              unidade: "dias",
              motivo: "Viagem",
              feitoPor: adm.id,
            },
            HOJE,
          ),
        );
      const paraJoao = await t(ana.id, joao.id);
      const paraBia = await t(ana.id, bia.id);
      ok(
        await anularTransferencia(db, {
          transferenciaId: paraJoao.transferenciaId,
          motivo: anulado.motivo,
          feitoPor: adm.id,
        }),
      );
      ok(
        await anularTransferencia(db, {
          transferenciaId: paraBia.transferenciaId,
          motivo: anulado.motivo,
          feitoPor: adm.id,
        }),
      );
      for (const id of [ana.id, joao.id, bia.id]) {
        const ficha = await obterFicha(db, id, HOJE);
        const itens = ficha?.historico.filter(
          (i) =>
            i.texto.includes("transferidos") ||
            i.texto.includes("recebidos") ||
            i.texto.startsWith("Período recebido"),
        );
        expect(itens?.length).toBeGreaterThan(0);
        for (const i of itens ?? []) {
          expect(i.anular).toBeNull();
          expect(i.anulado).toMatchObject({
            por: adm.nome,
            motivo: anulado.motivo,
          });
          expect(i.anulado?.em).toBeInstanceOf(Date);
        }
      }
    });

    it("trancamento anulado", async () => {
      const db = banco.db;
      const ana = await criarAluno(db, { nome: "Ana Souza" });
      await criarPeriodo(db, {
        alunoId: ana.id,
        inicio: "2026-11-01",
        fim: "2026-12-31",
        criadoPor: adm.id,
      });
      const { trancamentoId } = ok(
        await trancar(
          db,
          { alunoId: ana.id, inicio: "2026-11-22", feitoPor: adm.id },
          HOJE,
        ),
      );
      ok(
        await anularTrancamento(db, {
          trancamentoId,
          motivo: anulado.motivo,
          feitoPor: adm.id,
        }),
      );
      const item = (await obterFicha(db, ana.id, HOJE))?.historico.find(
        (i) => i.tipo === "trancamento",
      );
      expect(item).toMatchObject({
        anular: null,
        anulado: { por: adm.nome, motivo: anulado.motivo },
      });
      expect(item?.destrancar).toBeUndefined();
    });

    it("lote anulado: a linha do aluno vem anulada", async () => {
      const db = banco.db;
      const plano = await criarPlano(db);
      const turma = await criarTurma(db);
      const ana = await criarAluno(db, { nome: "Ana Souza" });
      await criarPeriodo(db, {
        alunoId: ana.id,
        inicio: "2026-11-01",
        fim: "2026-12-31",
        criadoPor: adm.id,
        planoId: plano.id,
      });
      ok(
        await matricular(db, {
          alunoId: ana.id,
          turmaId: turma.id,
          entrada: HOJE,
          feitoPor: adm.id,
        }),
      );
      const { loteId } = ok(
        await confirmarLote(
          db,
          {
            escopo: { tipo: "turmas", turmaIds: [turma.id] },
            quantidade: 3,
            unidade: "dias",
            motivo: "Recesso",
            feitoPor: adm.id,
          },
          HOJE,
        ),
      );
      ok(
        await anularLote(db, {
          loteId,
          motivo: anulado.motivo,
          feitoPor: adm.id,
        }),
      );
      const item = (await obterFicha(db, ana.id, HOJE))?.historico.find(
        (i) => i.tipo === "ajuste",
      );
      expect(item?.texto).toContain("+3 dias · Recesso · lote ");
      expect(item).toMatchObject({
        anular: null,
        anulado: { por: adm.nome, motivo: anulado.motivo },
      });
    });

    it("período anulado", async () => {
      const db = banco.db;
      const ana = await criarAluno(db, { nome: "Ana Souza" });
      const periodo = await criarPeriodo(db, {
        alunoId: ana.id,
        inicio: "2026-11-01",
        fim: "2026-11-30",
        criadoPor: adm.id,
      });
      ok(
        await anularPeriodo(db, {
          periodoId: periodo.id,
          motivo: anulado.motivo,
          feitoPor: adm.id,
        }),
      );
      const item = (await obterFicha(db, ana.id, HOJE))?.historico[0];
      expect(item).toMatchObject({
        tipo: "periodo",
        anular: null,
        anulado: { por: adm.nome, motivo: anulado.motivo },
      });
    });

    it("mostra anulado se só o pai foi anulado (defesa)", async () => {
      const db = banco.db;
      const ana = await criarAluno(db, { nome: "Ana Souza" });
      const periodo = await criarPeriodo(db, {
        alunoId: ana.id,
        inicio: "2026-11-01",
        fim: "2026-11-30",
        criadoPor: adm.id,
      });
      const [lote] = await db
        .insert(lotesExtensao)
        .values({
          todoEstudio: true,
          quantidadeDigitada: 2,
          unidadeDigitada: "dias",
          motivo: "Recesso",
          criadoPor: adm.id,
          anuladoEm: em("2026-11-20"),
          anuladoPor: adm.id,
          motivoAnulacao: "defesa",
        })
        .returning();
      await db.insert(ajustesPeriodo).values({
        periodoId: periodo.id,
        tipo: "extensao",
        dias: 2,
        quantidadeDigitada: 2,
        unidadeDigitada: "dias",
        motivo: "Recesso",
        loteId: lote.id,
        criadoPor: adm.id,
      });
      const item = (await obterFicha(db, ana.id, HOJE))?.historico.find(
        (i) => i.tipo === "ajuste",
      );
      expect(item).toMatchObject({
        anular: null,
        anulado: { motivo: "defesa", em: em("2026-11-20") },
      });
    });
  });
});
