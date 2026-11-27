import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  acordosBolsista,
  bloqueiosContato,
  contatos,
  situacoesBolsista,
} from "@/servidor/banco/esquema";
import { alterarDias } from "@/servidor/bolsistas/cadastro";
import { obterFichaBolsista } from "@/servidor/bolsistas/ficha";
import { criarBancoDeTeste } from "../apoio/banco";
import {
  criarAdministracao,
  criarAluno,
  criarAula,
  criarBolsista,
  criarModulo,
  criarRitmo,
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

describe("obterFichaBolsista", () => {
  it("devolve null para id inválido, inexistente e aluno sem papel de bolsista", async () => {
    const aluno = await criarAluno(banco.db);
    expect(await obterFichaBolsista(banco.db, "nao-e-uuid", HOJE)).toBeNull();
    expect(await obterFichaBolsista(banco.db, randomUUID(), HOJE)).toBeNull();
    expect(await obterFichaBolsista(banco.db, aluno.id, HOJE)).toBeNull();
  });

  it("versões: a vigente primeiro, ate = véspera da seguinte, mesmo dia fica só a mais recente", async () => {
    const b = await criarBolsista(banco.db, {
      criadoPor: adm.id,
      dias: [2],
      desde: "2026-09-01",
    });
    ok(
      await alterarDias(
        banco.db,
        {
          pessoaId: b.id,
          dias: [2, 4],
          vigenteDesde: "2026-11-01",
          feitoPor: adm.id,
        },
        HOJE,
      ),
    );
    // Corrigida no mesmo dia: só a de criado_em mais recente aparece.
    ok(
      await alterarDias(
        banco.db,
        {
          pessoaId: b.id,
          dias: [1, 3],
          vigenteDesde: "2026-11-01",
          feitoPor: adm.id,
        },
        HOJE,
      ),
    );
    const ficha = await obterFichaBolsista(banco.db, b.id, HOJE);
    expect(ficha?.bolsista.id).toBe(b.id);
    expect(ficha?.versoes).toEqual([
      { dias: [1, 3], desde: "2026-11-01", ate: null },
      { dias: [2], desde: "2026-09-01", ate: "2026-10-31" },
    ]);
  });

  it("meses: atual sempre, anteriores só com combinados ou presença, decrescente", async () => {
    const turma = await criarTurma(banco.db, { dias: [2, 4] });
    const b = await criarBolsista(banco.db, {
      criadoPor: adm.id,
      dias: [2],
      desde: "2026-09-01",
    });
    // set: terça 15/09 e 22/09 com chamada; presente só em 15/09.
    const a1 = await criarAula(banco.db, {
      turmaId: turma.id,
      data: "2026-09-15",
      criadoPor: adm.id,
    });
    await criarAula(banco.db, {
      turmaId: turma.id,
      data: "2026-09-22",
      criadoPor: adm.id,
    });
    await marcarPresenca(banco.db, {
      aulaId: a1.id,
      pessoaId: b.id,
      por: adm.id,
    });
    // nov: quinta 05/11 (fora do combinado) com presença; terça 03/11 sem presença.
    const a3 = await criarAula(banco.db, {
      turmaId: turma.id,
      data: "2026-11-05",
      criadoPor: adm.id,
    });
    await criarAula(banco.db, {
      turmaId: turma.id,
      data: "2026-11-03",
      criadoPor: adm.id,
    });
    await marcarPresenca(banco.db, {
      aulaId: a3.id,
      pessoaId: b.id,
      por: adm.id,
    });
    const ficha = await obterFichaBolsista(banco.db, b.id, HOJE);
    expect(ficha?.meses).toEqual([
      { mes: "nov", combinados: 1, presentes: 0, fora: 1 },
      { mes: "set", combinados: 2, presentes: 1, fora: 0 },
    ]);
  });

  it("meses: o mês atual aparece mesmo vazio", async () => {
    // Domingo: nenhuma aula de outros testes cai num dia combinado.
    const b = await criarBolsista(banco.db, {
      criadoPor: adm.id,
      dias: [0],
      desde: "2026-11-01",
    });
    const ficha = await obterFichaBolsista(banco.db, b.id, HOJE);
    expect(ficha?.meses).toEqual([
      { mes: "nov", combinados: 0, presentes: 0, fora: 0 },
    ]);
  });

  it("presenças: rótulo da turma, mais recentes primeiro, no máximo 20, sem desmarcadas", async () => {
    const ritmo = await criarRitmo(banco.db, { nome: "Forró" });
    const modulo = await criarModulo(banco.db, { nome: "Iniciante" });
    const turma = await criarTurma(banco.db, {
      ritmoId: ritmo.id,
      moduloId: modulo.id,
      dias: [2],
    });
    const b = await criarBolsista(banco.db, {
      criadoPor: adm.id,
      desde: "2026-06-01",
    });
    // 30 terças: 16/06 em diante, semanais.
    const datas: string[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(Date.UTC(2026, 5, 16 + 7 * i));
      datas.push(d.toISOString().slice(0, 10));
    }
    const usadas = datas.filter((d) => d <= HOJE);
    for (const data of usadas) {
      const aula = await criarAula(banco.db, {
        turmaId: turma.id,
        data,
        criadoPor: adm.id,
      });
      await marcarPresenca(banco.db, {
        aulaId: aula.id,
        pessoaId: b.id,
        por: adm.id,
      });
    }
    const ficha = await obterFichaBolsista(banco.db, b.id, HOJE);
    expect(usadas.length).toBeGreaterThan(20);
    expect(ficha?.presencas).toHaveLength(20);
    expect(ficha?.presencas[0]).toEqual({
      data: "2026-11-24",
      rotulo: "Forró Iniciante · ter 19h",
    });
    expect(ficha?.presencas[19]?.data).toBe(usadas[usadas.length - 20]);
  });

  it("histórico: ativação, inativação com e sem motivo e dias, mais recente primeiro, com o nome de quem fez", async () => {
    const b = await criarBolsista(banco.db, {
      criadoPor: adm.id,
      dias: [2, 4],
      desde: "2026-11-01",
    });
    const outro = await criarAdministracao(banco.db);
    // Linhas criadas pela fábrica ficam mais antigas que as do teste.
    const antigo = new Date("2026-11-01T12:00:00Z");
    await banco.db
      .update(situacoesBolsista)
      .set({ criadoEm: antigo })
      .where(eq(situacoesBolsista.pessoaId, b.id));
    await banco.db
      .update(acordosBolsista)
      .set({ criadoEm: new Date(antigo.getTime() + 1000) })
      .where(eq(acordosBolsista.pessoaId, b.id));
    await banco.db.insert(situacoesBolsista).values({
      pessoaId: b.id,
      tipo: "inativacao",
      data: "2026-11-10",
      motivo: "viagem",
      criadoPor: outro.id,
      criadoEm: new Date("2026-11-10T12:00:00Z"),
    });
    await banco.db.insert(situacoesBolsista).values({
      pessoaId: b.id,
      tipo: "ativacao",
      data: "2026-11-15",
      criadoPor: adm.id,
      criadoEm: new Date("2026-11-15T12:00:00Z"),
    });
    await banco.db.insert(situacoesBolsista).values({
      pessoaId: b.id,
      tipo: "inativacao",
      data: "2026-11-20",
      criadoPor: adm.id,
      criadoEm: new Date("2026-11-20T12:00:00Z"),
    });
    await banco.db.insert(acordosBolsista).values({
      pessoaId: b.id,
      dias: [1],
      vigenteDesde: "2026-11-16",
      criadoPor: outro.id,
      criadoEm: new Date("2026-11-16T12:00:00Z"),
    });
    const ficha = await obterFichaBolsista(banco.db, b.id, HOJE);
    const recentes = ficha?.historico.slice(0, 4);
    expect(recentes).toEqual([
      {
        em: new Date("2026-11-20T12:00:00Z"),
        texto: "Inativado",
        por: adm.nome,
      },
      {
        em: new Date("2026-11-16T12:00:00Z"),
        texto: "Dias: seg (desde 16/11)",
        por: outro.nome,
      },
      { em: new Date("2026-11-15T12:00:00Z"), texto: "Ativado", por: adm.nome },
      {
        em: new Date("2026-11-10T12:00:00Z"),
        texto: "Inativado · viagem",
        por: outro.nome,
      },
    ]);
    expect(ficha?.historico).toHaveLength(6);
    expect(ficha?.historico.slice(4).map((h) => h.texto)).toEqual([
      "Dias: ter · qui (desde 01/11)",
      "Ativado",
    ]);
  });

  it("contatos: só listas de bolsista, e o bloqueio de contato", async () => {
    const b = await criarBolsista(banco.db, { criadoPor: adm.id });
    const grupo = randomUUID();
    const grupoAluno = randomUUID();
    const base = {
      alunoId: b.id,
      pessoaContatoId: b.id,
      whatsapp: "+5511999999999",
      criadoPor: adm.id,
    };
    await banco.db.insert(contatos).values([
      {
        ...base,
        grupoId: grupo,
        lista: "bolsista_ausente",
        resultado: "nao_respondeu",
        criadoEm: new Date("2026-11-10T12:00:00Z"),
      },
      {
        ...base,
        grupoId: grupoAluno,
        lista: "vencido",
        criadoEm: new Date("2026-11-11T12:00:00Z"),
      },
    ]);
    await banco.db.insert(bloqueiosContato).values({
      pessoaId: b.id,
      marcadoPor: adm.id,
      marcadoEm: new Date("2026-11-12T12:00:00Z"),
    });
    const ficha = await obterFichaBolsista(banco.db, b.id, HOJE);
    expect(ficha?.contatos).toEqual([
      {
        em: new Date("2026-11-10T12:00:00Z"),
        por: adm.nome,
        mensagem: null,
        resultado: "nao_respondeu",
        grupoId: grupo,
      },
    ]);
    expect(ficha?.naoQuerContato).toEqual({
      em: new Date("2026-11-12T12:00:00Z"),
      por: adm.nome,
    });
  });
});
