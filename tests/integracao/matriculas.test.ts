import { and, eq, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MENSAGEM_ENCERRADO } from "@/servidor/alunos/cadastro";
import {
  contarMatriculasAbertas,
  matricular,
  moverAlunosDaTurma,
  tirarDaTurma,
  trocarDeTurma,
} from "@/servidor/alunos/matriculas";
import { matriculas, pessoaPapeis } from "@/servidor/banco/esquema";
import { criarBancoDeTeste } from "../apoio/banco";
import {
  criarAdministracao,
  criarAluno,
  criarMatricula,
  criarTurma,
} from "../apoio/fabricas";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
let adm: Awaited<ReturnType<typeof criarAdministracao>>;

beforeAll(async () => {
  banco = await criarBancoDeTeste();
  adm = await criarAdministracao(banco.db);
});
afterAll(async () => {
  await banco.encerrar();
});

const linhas = (alunoId: string) =>
  banco.db.select().from(matriculas).where(eq(matriculas.alunoId, alunoId));

const abertas = (alunoId: string) =>
  banco.db
    .select()
    .from(matriculas)
    .where(and(eq(matriculas.alunoId, alunoId), isNull(matriculas.saida)));

describe("matricular", () => {
  it("matricula em turma ativa, com a matrícula aberta", async () => {
    const aluno = await criarAluno(banco.db);
    const turma = await criarTurma(banco.db);
    const r = await matricular(banco.db, {
      alunoId: aluno.id,
      turmaId: turma.id,
      entrada: "2026-11-22",
      feitoPor: adm.id,
    });
    expect(r.ok).toBe(true);
    const [m] = await abertas(aluno.id);
    expect(m).toMatchObject({
      turmaId: turma.id,
      entrada: "2026-11-22",
      saida: null,
      criadoPor: adm.id,
    });
    if (r.ok) expect(r.valor.matriculaId).toBe(m.id);
  });

  it("recusa a mesma turma de novo", async () => {
    const aluno = await criarAluno(banco.db);
    const turma = await criarTurma(banco.db);
    const dados = {
      alunoId: aluno.id,
      turmaId: turma.id,
      entrada: "2026-11-22",
      feitoPor: adm.id,
    };
    await matricular(banco.db, dados);
    const r = await matricular(banco.db, dados);
    expect(r).toEqual({
      ok: false,
      erros: { turmaId: "Já está nesta turma." },
    });
    expect(await linhas(aluno.id)).toHaveLength(1);
  });

  it("recusa turma desativada", async () => {
    const aluno = await criarAluno(banco.db);
    const turma = await criarTurma(banco.db, { ativa: false });
    const r = await matricular(banco.db, {
      alunoId: aluno.id,
      turmaId: turma.id,
      entrada: "2026-11-22",
      feitoPor: adm.id,
    });
    expect(r).toEqual({
      ok: false,
      erros: { turmaId: "Escolha uma turma ativa." },
    });
  });

  it("recusa aluno encerrado, turma inexistente e datas inválidas", async () => {
    const turma = await criarTurma(banco.db);
    const encerrado = await criarAluno(banco.db);
    await banco.db
      .update(pessoaPapeis)
      .set({ ativo: false })
      .where(eq(pessoaPapeis.pessoaId, encerrado.id));
    const base = { turmaId: turma.id, entrada: "2026-11-22", feitoPor: adm.id };
    expect(
      await matricular(banco.db, { ...base, alunoId: encerrado.id }),
    ).toEqual({ ok: false, erros: { _: MENSAGEM_ENCERRADO } });

    const aluno = await criarAluno(banco.db);
    expect(
      await matricular(banco.db, {
        ...base,
        alunoId: aluno.id,
        turmaId: "nao-e-uuid",
      }),
    ).toEqual({ ok: false, erros: { turmaId: "Turma não encontrada." } });
    expect(
      await matricular(banco.db, {
        ...base,
        alunoId: aluno.id,
        turmaId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toEqual({ ok: false, erros: { turmaId: "Turma não encontrada." } });
    expect(
      await matricular(banco.db, {
        ...base,
        alunoId: aluno.id,
        entrada: "2026-02-30",
      }),
    ).toEqual({ ok: false, erros: { entrada: "Informe uma data válida." } });
    expect(await linhas(aluno.id)).toHaveLength(0);
  });
});

describe("tirarDaTurma", () => {
  it("fecha a matrícula com a saída e quem fez", async () => {
    const aluno = await criarAluno(banco.db);
    const turma = await criarTurma(banco.db);
    const m = await criarMatricula(banco.db, {
      alunoId: aluno.id,
      turmaId: turma.id,
      entrada: "2026-11-01",
      criadoPor: adm.id,
    });
    const r = await tirarDaTurma(banco.db, {
      matriculaId: m.id,
      saida: "2026-11-22",
      feitoPor: adm.id,
    });
    expect(r).toEqual({ ok: true, valor: null });
    const [depois] = await linhas(aluno.id);
    expect(depois).toMatchObject({ saida: "2026-11-22", saidaPor: adm.id });
  });

  it("recusa saída antes da entrada, matrícula já fechada e id ruim", async () => {
    const aluno = await criarAluno(banco.db);
    const turma = await criarTurma(banco.db);
    const m = await criarMatricula(banco.db, {
      alunoId: aluno.id,
      turmaId: turma.id,
      entrada: "2026-11-10",
      criadoPor: adm.id,
    });
    expect(
      await tirarDaTurma(banco.db, {
        matriculaId: m.id,
        saida: "2026-11-09",
        feitoPor: adm.id,
      }),
    ).toEqual({
      ok: false,
      erros: { saida: "A saída não pode ser antes da entrada." },
    });
    expect(
      await tirarDaTurma(banco.db, {
        matriculaId: m.id,
        saida: "ontem",
        feitoPor: adm.id,
      }),
    ).toEqual({ ok: false, erros: { saida: "Informe uma data válida." } });
    await tirarDaTurma(banco.db, {
      matriculaId: m.id,
      saida: "2026-11-12",
      feitoPor: adm.id,
    });
    expect(
      await tirarDaTurma(banco.db, {
        matriculaId: m.id,
        saida: "2026-11-15",
        feitoPor: adm.id,
      }),
    ).toEqual({ ok: false, erros: { _: "Essa matrícula já foi encerrada." } });
    expect(
      await tirarDaTurma(banco.db, {
        matriculaId: "xyz",
        saida: "2026-11-15",
        feitoPor: adm.id,
      }),
    ).toEqual({ ok: false, erros: { _: "Matrícula não encontrada." } });
  });

  it("depois de tirar, matricular de novo cria outra linha", async () => {
    const aluno = await criarAluno(banco.db);
    const turma = await criarTurma(banco.db);
    const primeira = await matricular(banco.db, {
      alunoId: aluno.id,
      turmaId: turma.id,
      entrada: "2026-10-01",
      feitoPor: adm.id,
    });
    if (!primeira.ok) throw new Error("falhou");
    await tirarDaTurma(banco.db, {
      matriculaId: primeira.valor.matriculaId,
      saida: "2026-10-31",
      feitoPor: adm.id,
    });
    const segunda = await matricular(banco.db, {
      alunoId: aluno.id,
      turmaId: turma.id,
      entrada: "2026-11-15",
      feitoPor: adm.id,
    });
    expect(segunda.ok).toBe(true);
    expect(await linhas(aluno.id)).toHaveLength(2);
    expect(await abertas(aluno.id)).toHaveLength(1);
  });
});

describe("trocarDeTurma", () => {
  it("fecha a matrícula e abre a outra com a mesma data", async () => {
    const aluno = await criarAluno(banco.db);
    const [a, b] = [await criarTurma(banco.db), await criarTurma(banco.db)];
    const m = await criarMatricula(banco.db, {
      alunoId: aluno.id,
      turmaId: a.id,
      entrada: "2026-11-01",
      criadoPor: adm.id,
    });
    const r = await trocarDeTurma(banco.db, {
      matriculaId: m.id,
      novaTurmaId: b.id,
      data: "2026-11-22",
      feitoPor: adm.id,
    });
    expect(r.ok).toBe(true);
    const todas = await linhas(aluno.id);
    expect(todas).toHaveLength(2);
    expect(todas.find((x) => x.turmaId === a.id)).toMatchObject({
      saida: "2026-11-22",
      saidaPor: adm.id,
    });
    const nova = todas.find((x) => x.turmaId === b.id);
    expect(nova).toMatchObject({
      entrada: "2026-11-22",
      saida: null,
      criadoPor: adm.id,
    });
    if (r.ok) expect(r.valor.matriculaId).toBe(nova?.id);
  });

  it("não muda nada se já está na nova turma", async () => {
    const aluno = await criarAluno(banco.db);
    const [a, b] = [await criarTurma(banco.db), await criarTurma(banco.db)];
    const m = await criarMatricula(banco.db, {
      alunoId: aluno.id,
      turmaId: a.id,
      entrada: "2026-11-01",
      criadoPor: adm.id,
    });
    await criarMatricula(banco.db, {
      alunoId: aluno.id,
      turmaId: b.id,
      entrada: "2026-11-05",
      criadoPor: adm.id,
    });
    const r = await trocarDeTurma(banco.db, {
      matriculaId: m.id,
      novaTurmaId: b.id,
      data: "2026-11-22",
      feitoPor: adm.id,
    });
    expect(r).toEqual({
      ok: false,
      erros: { novaTurmaId: "Já está nesta turma." },
    });
    expect(await abertas(aluno.id)).toHaveLength(2);
  });

  it("recusa turma desativada, a mesma turma, data antes da entrada e matrícula fechada", async () => {
    const aluno = await criarAluno(banco.db);
    const a = await criarTurma(banco.db);
    const inativa = await criarTurma(banco.db, { ativa: false });
    const b = await criarTurma(banco.db);
    const m = await criarMatricula(banco.db, {
      alunoId: aluno.id,
      turmaId: a.id,
      entrada: "2026-11-10",
      criadoPor: adm.id,
    });
    const base = { matriculaId: m.id, data: "2026-11-22", feitoPor: adm.id };
    expect(
      await trocarDeTurma(banco.db, { ...base, novaTurmaId: inativa.id }),
    ).toEqual({
      ok: false,
      erros: { novaTurmaId: "Escolha uma turma ativa." },
    });
    expect(
      await trocarDeTurma(banco.db, { ...base, novaTurmaId: a.id }),
    ).toEqual({
      ok: false,
      erros: { novaTurmaId: "Já está nesta turma." },
    });
    expect(
      await trocarDeTurma(banco.db, {
        ...base,
        novaTurmaId: b.id,
        data: "2026-11-09",
      }),
    ).toEqual({
      ok: false,
      erros: { data: "A data não pode ser antes da entrada." },
    });
    expect(
      await trocarDeTurma(banco.db, {
        ...base,
        novaTurmaId: "xyz",
      }),
    ).toEqual({
      ok: false,
      erros: { novaTurmaId: "Turma não encontrada." },
    });
    expect(await abertas(aluno.id)).toHaveLength(1);
    await tirarDaTurma(banco.db, {
      matriculaId: m.id,
      saida: "2026-11-12",
      feitoPor: adm.id,
    });
    expect(
      await trocarDeTurma(banco.db, { ...base, novaTurmaId: b.id }),
    ).toEqual({ ok: false, erros: { _: "Essa matrícula já foi encerrada." } });
  });
});

describe("moverAlunosDaTurma", () => {
  it("move os alunos; quem já está no destino só sai da origem", async () => {
    const origem = await criarTurma(banco.db);
    const destino = await criarTurma(banco.db);
    const alunos = [
      await criarAluno(banco.db),
      await criarAluno(banco.db),
      await criarAluno(banco.db),
    ];
    for (const a of alunos) {
      await criarMatricula(banco.db, {
        alunoId: a.id,
        turmaId: origem.id,
        entrada: "2026-10-01",
        criadoPor: adm.id,
      });
    }
    await criarMatricula(banco.db, {
      alunoId: alunos[2].id,
      turmaId: destino.id,
      entrada: "2026-10-15",
      criadoPor: adm.id,
    });
    const r = await moverAlunosDaTurma(banco.db, {
      deTurmaId: origem.id,
      paraTurmaId: destino.id,
      data: "2026-11-22",
      feitoPor: adm.id,
    });
    expect(r).toEqual({ ok: true, valor: { movidos: 2 } });
    for (const a of alunos) {
      const doAluno = await abertas(a.id);
      expect(doAluno.map((x) => x.turmaId)).toEqual([destino.id]);
    }
    const [primeira] = (await linhas(alunos[0].id)).filter(
      (x) => x.turmaId === destino.id,
    );
    expect(primeira).toMatchObject({
      entrada: "2026-11-22",
      criadoPor: adm.id,
    });
    const [antiga] = (await linhas(alunos[0].id)).filter(
      (x) => x.turmaId === origem.id,
    );
    expect(antiga).toMatchObject({ saida: "2026-11-22", saidaPor: adm.id });
  });

  it("recusa destino desativado, igual à origem, e data antes de uma entrada (sem mudar nada)", async () => {
    const origem = await criarTurma(banco.db);
    const destino = await criarTurma(banco.db);
    const inativa = await criarTurma(banco.db, { ativa: false });
    const aluno = await criarAluno(banco.db);
    await criarMatricula(banco.db, {
      alunoId: aluno.id,
      turmaId: origem.id,
      entrada: "2026-11-10",
      criadoPor: adm.id,
    });
    const base = {
      deTurmaId: origem.id,
      data: "2026-11-22",
      feitoPor: adm.id,
    };
    expect(
      await moverAlunosDaTurma(banco.db, { ...base, paraTurmaId: inativa.id }),
    ).toEqual({
      ok: false,
      erros: { paraTurmaId: "Escolha uma turma ativa." },
    });
    expect(
      await moverAlunosDaTurma(banco.db, { ...base, paraTurmaId: origem.id }),
    ).toEqual({
      ok: false,
      erros: { paraTurmaId: "Escolha outra turma." },
    });
    const antes = await moverAlunosDaTurma(banco.db, {
      ...base,
      paraTurmaId: destino.id,
      data: "2026-11-09",
    });
    expect(antes.ok).toBe(false);
    if (!antes.ok) expect(antes.erros.data).toMatch(/antes da entrada/);
    expect((await abertas(aluno.id)).map((x) => x.turmaId)).toEqual([
      origem.id,
    ]);
  });

  it("pula alunos encerrados", async () => {
    const origem = await criarTurma(banco.db);
    const destino = await criarTurma(banco.db);
    const ativo = await criarAluno(banco.db);
    const encerrado = await criarAluno(banco.db);
    for (const a of [ativo, encerrado]) {
      await criarMatricula(banco.db, {
        alunoId: a.id,
        turmaId: origem.id,
        entrada: "2026-10-01",
        criadoPor: adm.id,
      });
    }
    await banco.db
      .update(pessoaPapeis)
      .set({ ativo: false })
      .where(eq(pessoaPapeis.pessoaId, encerrado.id));
    const r = await moverAlunosDaTurma(banco.db, {
      deTurmaId: origem.id,
      paraTurmaId: destino.id,
      data: "2026-11-22",
      feitoPor: adm.id,
    });
    expect(r).toEqual({ ok: true, valor: { movidos: 1 } });
    expect((await abertas(encerrado.id)).map((x) => x.turmaId)).toEqual([
      origem.id,
    ]);
  });
});

describe("casos extras", () => {
  it("mover mostra a maior entrada quando a data é anterior a alguma", async () => {
    const origem = await criarTurma(banco.db);
    const destino = await criarTurma(banco.db);
    for (const entrada of ["2026-11-07", "2026-11-10"]) {
      const aluno = await criarAluno(banco.db);
      await criarMatricula(banco.db, {
        alunoId: aluno.id,
        turmaId: origem.id,
        entrada,
        criadoPor: adm.id,
      });
    }
    const r = await moverAlunosDaTurma(banco.db, {
      deTurmaId: origem.id,
      paraTurmaId: destino.id,
      data: "2026-11-05",
      feitoPor: adm.id,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.data).toContain("(10/11)");
    const ok = await moverAlunosDaTurma(banco.db, {
      deTurmaId: origem.id,
      paraTurmaId: destino.id,
      data: "2026-11-10",
      feitoPor: adm.id,
    });
    expect(ok).toEqual({ ok: true, valor: { movidos: 2 } });
  });

  it("mover recusa turma de origem ou destino desconhecida", async () => {
    const turma = await criarTurma(banco.db);
    const base = { data: "2026-11-22", feitoPor: adm.id };
    const nenhuma = "11111111-1111-4111-8111-111111111111";
    expect(
      await moverAlunosDaTurma(banco.db, {
        ...base,
        deTurmaId: nenhuma,
        paraTurmaId: turma.id,
      }),
    ).toEqual({ ok: false, erros: { deTurmaId: "Turma não encontrada." } });
    expect(
      await moverAlunosDaTurma(banco.db, {
        ...base,
        deTurmaId: turma.id,
        paraTurmaId: "xyz",
      }),
    ).toEqual({ ok: false, erros: { paraTurmaId: "Turma não encontrada." } });
  });

  it("trocar recusa aluno encerrado e data inválida", async () => {
    const aluno = await criarAluno(banco.db);
    const [a, b] = [await criarTurma(banco.db), await criarTurma(banco.db)];
    const m = await criarMatricula(banco.db, {
      alunoId: aluno.id,
      turmaId: a.id,
      entrada: "2026-11-01",
      criadoPor: adm.id,
    });
    expect(
      await trocarDeTurma(banco.db, {
        matriculaId: m.id,
        novaTurmaId: b.id,
        data: "2026-13-01",
        feitoPor: adm.id,
      }),
    ).toEqual({ ok: false, erros: { data: "Informe uma data válida." } });
    await banco.db
      .update(pessoaPapeis)
      .set({ ativo: false })
      .where(eq(pessoaPapeis.pessoaId, aluno.id));
    expect(
      await trocarDeTurma(banco.db, {
        matriculaId: m.id,
        novaTurmaId: b.id,
        data: "2026-11-22",
        feitoPor: adm.id,
      }),
    ).toEqual({ ok: false, erros: { _: MENSAGEM_ENCERRADO } });
    expect(await abertas(aluno.id)).toHaveLength(1);
  });
});

describe("contarMatriculasAbertas", () => {
  it("conta só as abertas, por turma", async () => {
    const turma = await criarTurma(banco.db);
    const vazia = await criarTurma(banco.db);
    const [a, b] = [await criarAluno(banco.db), await criarAluno(banco.db)];
    for (const x of [a, b]) {
      await criarMatricula(banco.db, {
        alunoId: x.id,
        turmaId: turma.id,
        entrada: "2026-10-01",
        criadoPor: adm.id,
      });
    }
    await tirarDaTurma(banco.db, {
      matriculaId: (await linhas(b.id))[0].id,
      saida: "2026-11-01",
      feitoPor: adm.id,
    });
    const mapa = await contarMatriculasAbertas(banco.db);
    expect(mapa.get(turma.id)).toBe(1);
    expect(mapa.has(vazia.id)).toBe(false);
  });
});

describe("voltar à mesma turma (R18)", () => {
  const mensagem = (dia: string) =>
    `A entrada precisa ser depois da última saída desta turma (${dia}).`;

  async function saiuDe(turmaId: string, saida = "2026-10-31") {
    const aluno = await criarAluno(banco.db);
    const m = await criarMatricula(banco.db, {
      alunoId: aluno.id,
      turmaId,
      entrada: "2026-10-01",
      criadoPor: adm.id,
    });
    const r = await tirarDaTurma(banco.db, {
      matriculaId: m.id,
      saida,
      feitoPor: adm.id,
    });
    if (!r.ok) throw new Error(JSON.stringify(r.erros));
    return aluno;
  }

  it("matricular com entrada antes ou igual à última saída: recusa", async () => {
    const turma = await criarTurma(banco.db);
    const aluno = await saiuDe(turma.id);
    for (const entrada of ["2026-10-15", "2026-10-31"]) {
      expect(
        await matricular(banco.db, {
          alunoId: aluno.id,
          turmaId: turma.id,
          entrada,
          feitoPor: adm.id,
        }),
      ).toEqual({ ok: false, erros: { entrada: mensagem("31/10") } });
    }
    expect(await linhas(aluno.id)).toHaveLength(1);
    expect(
      (
        await matricular(banco.db, {
          alunoId: aluno.id,
          turmaId: turma.id,
          entrada: "2026-11-01",
          feitoPor: adm.id,
        })
      ).ok,
    ).toBe(true);
  });

  it("trocar para uma turma de onde saiu depois da data: recusa", async () => {
    const [a, b] = [await criarTurma(banco.db), await criarTurma(banco.db)];
    const aluno = await saiuDe(b.id, "2026-11-10");
    const m = await criarMatricula(banco.db, {
      alunoId: aluno.id,
      turmaId: a.id,
      entrada: "2026-11-01",
      criadoPor: adm.id,
    });
    expect(
      await trocarDeTurma(banco.db, {
        matriculaId: m.id,
        novaTurmaId: b.id,
        data: "2026-11-05",
        feitoPor: adm.id,
      }),
    ).toEqual({ ok: false, erros: { data: mensagem("10/11") } });
    expect(await abertas(aluno.id)).toMatchObject([{ turmaId: a.id }]);
  });

  it("mover alunos para uma turma de onde um deles saiu depois da data: recusa tudo", async () => {
    const [de, para] = [await criarTurma(banco.db), await criarTurma(banco.db)];
    const aluno = await saiuDe(para.id, "2026-11-10");
    await criarMatricula(banco.db, {
      alunoId: aluno.id,
      turmaId: de.id,
      entrada: "2026-11-01",
      criadoPor: adm.id,
    });
    expect(
      await moverAlunosDaTurma(banco.db, {
        deTurmaId: de.id,
        paraTurmaId: para.id,
        data: "2026-11-05",
        feitoPor: adm.id,
      }),
    ).toEqual({ ok: false, erros: { data: mensagem("10/11") } });
    expect(await abertas(aluno.id)).toMatchObject([{ turmaId: de.id }]);
  });
});
