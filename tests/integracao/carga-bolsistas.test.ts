import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { carregarAlunos } from "@/servidor/alunos/carga";
import { contatos } from "@/servidor/banco/esquema";
import { alterarDias, mudarSituacao } from "@/servidor/bolsistas/cadastro";
import { carregarBolsistas } from "@/servidor/bolsistas/carga";
import {
  desfazerNaoHouve,
  marcarNaoHouve,
  salvarChamada,
} from "@/servidor/bolsistas/chamada";
import { criarBancoDeTeste } from "../apoio/banco";
import {
  criarAdministracao,
  criarAluno,
  criarAula,
  criarBolsista,
  criarTurma,
  marcarPresenca,
} from "../apoio/fabricas";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
let adm: Awaited<ReturnType<typeof criarAdministracao>>;
const HOJE = "2026-11-26"; // quinta

beforeAll(async () => {
  banco = await criarBancoDeTeste();
  adm = await criarAdministracao(banco.db);
});
afterAll(async () => {
  await banco.encerrar();
});

function ok<T>(r: { ok: true; valor: T } | { ok: false; erros: unknown }): T {
  if (!r.ok) throw new Error(JSON.stringify(r.erros));
  return r.valor;
}

async function contatar(
  alunoId: string,
  pessoaContatoId: string,
  lista: "vencido" | "bolsista_ausente",
  grupoId: string,
  criadoEm: Date,
) {
  await banco.db.insert(contatos).values({
    grupoId,
    alunoId,
    pessoaContatoId,
    whatsapp: "5527999990000",
    lista,
    criadoPor: adm.id,
    criadoEm,
  });
}

describe("carregarBolsistas", () => {
  it("mes: acordo mudado, inativação no meio do mês, nao_houve e dia sem chamada", async () => {
    const turma = await criarTurma(banco.db, { dias: [2, 4] });
    const outra = await criarTurma(banco.db, { dias: [1] });
    // Acordo: terças desde 01/11; quintas a partir de 12/11 (terças e quintas).
    const b = await criarBolsista(banco.db, {
      criadoPor: adm.id,
      dias: [2],
      desde: "2026-11-01",
    });
    ok(
      await alterarDias(
        banco.db,
        {
          pessoaId: b.id,
          dias: [2, 4],
          vigenteDesde: "2026-11-12",
          feitoPor: adm.id,
        },
        HOJE,
      ),
    );
    // Inativa a partir de 20/11.
    ok(
      await mudarSituacao(
        banco.db,
        {
          pessoaId: b.id,
          tipo: "inativacao",
          data: "2026-11-20",
          feitoPor: adm.id,
        },
        HOJE,
      ),
    );
    const aula = (data: string, situacao?: "nao_houve") =>
      criarAula(banco.db, {
        turmaId: turma.id,
        data,
        criadoPor: adm.id,
        ...(situacao ? { situacao, motivo: "feriado" } : {}),
      });
    // ter 03: combinado, veio. ter 10: combinado, faltou. qui 12: combinado, veio.
    const a03 = await aula("2026-11-03");
    await marcarPresenca(banco.db, {
      aulaId: a03.id,
      pessoaId: b.id,
      por: adm.id,
    });
    await aula("2026-11-10");
    const a12 = await aula("2026-11-12");
    await marcarPresenca(banco.db, {
      aulaId: a12.id,
      pessoaId: b.id,
      por: adm.id,
    });
    // qui 05: acordo ainda só terças, veio (fora do combinado).
    const a05 = await aula("2026-11-05");
    await marcarPresenca(banco.db, {
      aulaId: a05.id,
      pessoaId: b.id,
      por: adm.id,
    });
    // ter 17: nao_houve (não conta). qui 19: sem chamada nenhuma (não conta).
    await aula("2026-11-17", "nao_houve");
    // ter 24 (inativo): aula realizada e veio, mas inativo não conta como fora.
    const a24 = await aula("2026-11-24");
    await marcarPresenca(banco.db, {
      aulaId: a24.id,
      pessoaId: b.id,
      por: adm.id,
    });
    // Aula de outra turma na segunda 02: sem presença, não muda nada.
    await criarAula(banco.db, {
      turmaId: outra.id,
      data: "2026-11-02",
      criadoPor: adm.id,
    });

    const [c] = await carregarBolsistas(banco.db, HOJE, { ids: [b.id] });
    expect(c.mes).toEqual({ combinados: 3, presentes: 2, fora: 1 });
    expect(c.ativo).toBe(false);
    expect(c.diasHoje).toEqual([2, 4]);
    expect(c.acordos).toHaveLength(2);
    expect(c.historico.map((h) => h.tipo)).toEqual(["ativacao", "inativacao"]);
    // Dia com aula "nao_houve" não é dia com chamada.
    expect(c.dias.get("2026-11-17")?.comChamada ?? false).toBe(false);
    expect(c.dias.get("2026-11-03")?.presente).toBe(true);
  });

  it("'não houve' desfeito sem chamada salva não conta como dia com chamada", async () => {
    // Quartas: nenhuma outra aula deste arquivo cai em quarta.
    const turma = await criarTurma(banco.db, { dias: [3] });
    const b = await criarBolsista(banco.db, {
      criadoPor: adm.id,
      dias: [3],
      desde: "2026-11-01",
    });
    // qua 18 (fora da janela de 7 dias): chamada vazia salva e confirmada.
    ok(
      await salvarChamada(
        banco.db,
        {
          turmaId: turma.id,
          data: "2026-11-18",
          presentes: [],
          versao: 0,
          confirmarVazia: true,
          feitoPor: adm.id,
        },
        HOJE,
      ),
    );
    // qua 25: marcou "não houve" por engano e desfez; ninguém fez chamada.
    ok(
      await marcarNaoHouve(
        banco.db,
        {
          turmaId: turma.id,
          data: "2026-11-25",
          motivo: "feriado",
          feitoPor: adm.id,
        },
        HOJE,
      ),
    );
    ok(
      await desfazerNaoHouve(
        banco.db,
        { turmaId: turma.id, data: "2026-11-25", feitoPor: adm.id },
        HOJE,
      ),
    );
    const [c] = await carregarBolsistas(banco.db, HOJE, { ids: [b.id] });
    expect(c.mes).toEqual({ combinados: 1, presentes: 0, fora: 0 });
    expect(c.dias.get("2026-11-25")?.comChamada ?? false).toBe(false);
    expect(c.dias.get("2026-11-18")?.comChamada).toBe(true);
    expect(c.semVir[7].semVir).toBe(false);
    expect(c.semVir[15].semVir).toBe(true);
  });

  it("dias cobre o mês anterior inteiro quando mais antigo que hoje − 30", async () => {
    const turma = await criarTurma(banco.db, { dias: [2] });
    const b = await criarBolsista(banco.db, {
      criadoPor: adm.id,
      desde: "2026-09-01",
    });
    const velha = await criarAula(banco.db, {
      turmaId: turma.id,
      data: "2026-10-01",
      criadoPor: adm.id,
    });
    await marcarPresenca(banco.db, {
      aulaId: velha.id,
      pessoaId: b.id,
      por: adm.id,
    });
    const fora = await criarAula(banco.db, {
      turmaId: turma.id,
      data: "2026-09-29",
      criadoPor: adm.id,
    });
    await marcarPresenca(banco.db, {
      aulaId: fora.id,
      pessoaId: b.id,
      por: adm.id,
    });
    const [c] = await carregarBolsistas(banco.db, HOJE, { ids: [b.id] });
    expect(c.dias.has("2026-10-01")).toBe(true);
    expect(c.dias.has("2026-09-29")).toBe(false);
    expect(c.semVir[30].ultimaPresenca).toBe("2026-10-01");
  });

  it("ultimaPresenca vem de toda a história, mesmo fora da janela carregada", async () => {
    const turma = await criarTurma(banco.db, { dias: [2] });
    const b = await criarBolsista(banco.db, {
      criadoPor: adm.id,
      desde: "2026-01-01",
    });
    const aula = await criarAula(banco.db, {
      turmaId: turma.id,
      data: "2026-08-28",
      criadoPor: adm.id,
    });
    await marcarPresenca(banco.db, {
      aulaId: aula.id,
      pessoaId: b.id,
      por: adm.id,
    });
    const nunca = await criarBolsista(banco.db, { criadoPor: adm.id });
    const r = await carregarBolsistas(banco.db, HOJE, {
      ids: [b.id, nunca.id],
    });
    const c = r.find((x) => x.id === b.id);
    expect(c?.semVir[15].ultimaPresenca).toBe("2026-08-28");
    expect(c?.semVir[30].ultimaPresenca).toBe("2026-08-28");
    expect(c?.dias.has("2026-08-28")).toBe(false);
    expect(
      r.find((x) => x.id === nunca.id)?.semVir[15].ultimaPresenca,
    ).toBeNull();
  });

  it("pessoa aluno + bolsista aparece nas duas cargas com a mesma pessoa de contato", async () => {
    const b = await criarBolsista(banco.db, {
      criadoPor: adm.id,
      tambemAluno: true,
    });
    const [comoBolsista] = await carregarBolsistas(banco.db, HOJE, {
      ids: [b.id],
    });
    const [comoAluno] = await carregarAlunos(banco.db, HOJE, { ids: [b.id] });
    expect(comoBolsista.contato.pessoaId).toBe(comoAluno.contato.pessoaId);
    expect(comoBolsista.contato).toEqual(comoAluno.contato);
  });

  it("menor: contato é o responsável; contato e bloqueio por pessoa de contato", async () => {
    const resp = await criarAluno(banco.db);
    const b = await criarBolsista(banco.db, {
      criadoPor: adm.id,
      nascimento: "2015-05-05",
    });
    const { responsabilidades } = await import("@/servidor/banco/esquema");
    await banco.db
      .insert(responsabilidades)
      .values({ responsavelId: resp.id, alunoId: b.id });
    const [c] = await carregarBolsistas(banco.db, HOJE, { ids: [b.id] });
    expect(c.menor).toBe(true);
    expect(c.responsavel?.id).toBe(resp.id);
    expect(c.contato.pessoaId).toBe(resp.id);
    expect(c.contato.ehResponsavel).toBe(true);
  });

  it("ultimoContato separa os tipos de lista; o geral cruza", async () => {
    const b = await criarBolsista(banco.db, {
      criadoPor: adm.id,
      tambemAluno: true,
    });
    const antigo = new Date("2026-11-10T12:00:00Z");
    const novo = new Date("2026-11-24T12:00:00Z");
    const g1 = crypto.randomUUID();
    const g2 = crypto.randomUUID();
    await contatar(b.id, b.id, "bolsista_ausente", g1, antigo);
    await contatar(b.id, b.id, "vencido", g2, novo);

    const [comoBolsista] = await carregarBolsistas(banco.db, HOJE, {
      ids: [b.id],
    });
    const [comoAluno] = await carregarAlunos(banco.db, HOJE, { ids: [b.id] });
    expect(comoBolsista.ultimoContato?.grupoId).toBe(g1);
    expect(comoBolsista.ultimoContatoGeral?.grupoId).toBe(g2);
    expect(comoAluno.ultimoContato?.grupoId).toBe(g2);
    expect(comoAluno.ultimoContatoGeral?.grupoId).toBe(g2);

    // Sem filtro de ids, o mesmo resultado.
    const todos = await carregarBolsistas(banco.db, HOJE);
    expect(todos.find((x) => x.id === b.id)?.ultimoContato?.grupoId).toBe(g1);
  });

  it("ids inválidos ou vazios devolvem lista vazia", async () => {
    expect(await carregarBolsistas(banco.db, HOJE, { ids: [] })).toEqual([]);
    expect(await carregarBolsistas(banco.db, HOJE, { ids: ["x"] })).toEqual([]);
  });
});
