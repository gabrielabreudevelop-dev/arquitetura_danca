import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  matriculas,
  pessoaPapeis,
  pessoas,
  turmaDias,
  turmas,
} from "@/servidor/banco/esquema";
import {
  excluirTurma,
  gravarTurmaComDias,
  listarTurmas,
  obterTurma,
  opcoesDeTurma,
  salvarTurma,
} from "@/servidor/cadastros/turmas";
import { criarBancoDeTeste } from "../apoio/banco";
import {
  criarModulo,
  criarProfessor,
  criarRitmo,
  criarTurma,
} from "../apoio/fabricas";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
beforeAll(async () => {
  banco = await criarBancoDeTeste();
});
afterAll(async () => {
  await banco.encerrar();
});

/** Dados válidos de uma turma nova, com ritmo, módulo e professor ativos. */
async function dadosValidos() {
  return {
    ritmoId: (await criarRitmo(banco.db)).id,
    moduloId: (await criarModulo(banco.db)).id,
    professorId: (await criarProfessor(banco.db)).id,
    dias: [2, 4],
    horarioInicio: "19:00",
    horarioFim: "20:00",
    linkGrupoWhatsapp: "",
    ativa: true,
  };
}

async function diasGravados(turmaId: string) {
  const linhas = await banco.db
    .select()
    .from(turmaDias)
    .where(eq(turmaDias.turmaId, turmaId));
  return linhas.map((l) => l.diaSemana).sort();
}

it("cria a turma de ter e qui e grava os dias", async () => {
  const r = await salvarTurma(banco.db, await dadosValidos());
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(await diasGravados(r.valor.id)).toEqual([2, 4]);
  const turma = await obterTurma(banco.db, r.valor.id);
  expect(turma?.dias).toEqual([2, 4]);
  expect(turma?.linkGrupoWhatsapp).toBeNull();
});

it("editar substitui os dias", async () => {
  const dados = await dadosValidos();
  const criada = await salvarTurma(banco.db, dados);
  if (!criada.ok) throw new Error("não criou");
  const r = await salvarTurma(banco.db, {
    ...dados,
    id: criada.valor.id,
    dias: [6],
  });
  expect(r.ok).toBe(true);
  expect(await diasGravados(criada.valor.id)).toEqual([6]);
});

it("editar uma turma que não existe devolve erro geral", async () => {
  const r = await salvarTurma(banco.db, {
    ...(await dadosValidos()),
    id: "00000000-0000-4000-8000-000000000000",
  });
  expect(r).toEqual({ ok: false, erros: { _: "Turma não encontrada." } });
});

it("exige ao menos um dia e só dias de 0 a 6", async () => {
  const dados = await dadosValidos();
  expect(await salvarTurma(banco.db, { ...dados, dias: [] })).toEqual({
    ok: false,
    erros: { dias: "Escolha pelo menos um dia." },
  });
  const r = await salvarTurma(banco.db, { ...dados, dias: [2, 9] });
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.erros.dias).toBeTruthy();
});

it("exige fim depois do início", async () => {
  const dados = await dadosValidos();
  for (const horarioFim of ["19:00", "18:30"]) {
    expect(
      await salvarTurma(banco.db, {
        ...dados,
        horarioInicio: "19:00",
        horarioFim,
      }),
    ).toEqual({
      ok: false,
      erros: { horarioFim: "O fim precisa ser depois do início." },
    });
  }
});

it("mostra o erro do horário junto com os de outros campos", async () => {
  const r = await salvarTurma(banco.db, {
    ...(await dadosValidos()),
    dias: [],
    horarioFim: "19:00",
  });
  expect(r).toEqual({
    ok: false,
    erros: {
      dias: "Escolha pelo menos um dia.",
      horarioFim: "O fim precisa ser depois do início.",
    },
  });
});

it("recusa horário vazio ou malformado", async () => {
  const dados = await dadosValidos();
  const r = await salvarTurma(banco.db, {
    ...dados,
    horarioInicio: "",
    horarioFim: "25:00",
  });
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.erros.horarioInicio).toBe("Informe o horário.");
    expect(r.erros.horarioFim).toBe("Informe o horário.");
  }
});

it("valida o link do grupo e grava vazio como null", async () => {
  const dados = await dadosValidos();
  expect(
    await salvarTurma(banco.db, {
      ...dados,
      linkGrupoWhatsapp: "https://chat.whatsapp.com/",
    }),
  ).toEqual({
    ok: false,
    erros: {
      linkGrupoWhatsapp:
        "Cole o link de convite do grupo (https://chat.whatsapp.com/...).",
    },
  });
  const vazio = await salvarTurma(banco.db, {
    ...dados,
    linkGrupoWhatsapp: "  ",
  });
  expect(vazio.ok).toBe(true);
  const comLink = await salvarTurma(banco.db, {
    ...(await dadosValidos()),
    linkGrupoWhatsapp: " https://chat.whatsapp.com/AbC123 ",
  });
  if (!comLink.ok) throw new Error("não criou");
  expect(
    (await obterTurma(banco.db, comLink.valor.id))?.linkGrupoWhatsapp,
  ).toBe("https://chat.whatsapp.com/AbC123");
});

it("turma nova exige ritmo, módulo e professor ativos", async () => {
  const dados = await dadosValidos();
  const ritmo = await criarRitmo(banco.db, { ativo: false });
  const modulo = await criarModulo(banco.db, { ativo: false });
  const professor = await criarProfessor(banco.db);
  await banco.db
    .update(pessoaPapeis)
    .set({ ativo: false })
    .where(eq(pessoaPapeis.pessoaId, professor.id));
  expect(
    await salvarTurma(banco.db, {
      ...dados,
      ritmoId: ritmo.id,
      moduloId: modulo.id,
      professorId: professor.id,
    }),
  ).toEqual({
    ok: false,
    erros: {
      ritmoId: "Escolha um ritmo ativo.",
      moduloId: "Escolha um módulo ativo.",
      professorId: "Escolha um professor ativo.",
    },
  });
  const inexistente = await salvarTurma(banco.db, {
    ...dados,
    ritmoId: "não-é-uuid",
    professorId: "",
  });
  expect(inexistente.ok).toBe(false);
  if (!inexistente.ok) {
    expect(inexistente.erros.ritmoId).toBe("Escolha um ritmo ativo.");
    expect(inexistente.erros.professorId).toBe("Escolha um professor ativo.");
  }
});

it("editar mantém o professor desativado da turma, mas não aceita trocar por outro desativado", async () => {
  const dados = await dadosValidos();
  const criada = await salvarTurma(banco.db, dados);
  if (!criada.ok) throw new Error("não criou");
  await banco.db
    .update(pessoaPapeis)
    .set({ ativo: false })
    .where(eq(pessoaPapeis.pessoaId, dados.professorId));

  const r = await salvarTurma(banco.db, {
    ...dados,
    id: criada.valor.id,
    dias: [1],
  });
  expect(r.ok).toBe(true);

  const outro = await criarProfessor(banco.db);
  await banco.db
    .update(pessoaPapeis)
    .set({ ativo: false })
    .where(eq(pessoaPapeis.pessoaId, outro.id));
  const troca = await salvarTurma(banco.db, {
    ...dados,
    id: criada.valor.id,
    professorId: outro.id,
  });
  expect(troca).toEqual({
    ok: false,
    erros: { professorId: "Escolha um professor ativo." },
  });

  const comAtual = await opcoesDeTurma(banco.db, criada.valor.id);
  expect(comAtual.professores.map((p) => p.id)).toContain(dados.professorId);
  const semAtual = await opcoesDeTurma(banco.db);
  expect(semAtual.professores.map((p) => p.id)).not.toContain(
    dados.professorId,
  );
});

it("opcoesDeTurma traz só ativos, mais o ritmo e o módulo atuais da turma", async () => {
  const ritmo = await criarRitmo(banco.db, { ativo: false });
  const modulo = await criarModulo(banco.db, { ativo: false });
  const turma = await criarTurma(banco.db, {
    ritmoId: ritmo.id,
    moduloId: modulo.id,
  });
  const sem = await opcoesDeTurma(banco.db);
  expect(sem.ritmos.map((r) => r.id)).not.toContain(ritmo.id);
  expect(sem.modulos.map((m) => m.id)).not.toContain(modulo.id);
  const com = await opcoesDeTurma(banco.db, turma.id);
  expect(com.ritmos.map((r) => r.id)).toContain(ritmo.id);
  expect(com.modulos.map((m) => m.id)).toContain(modulo.id);
});

it("lista por ritmo, módulo, primeiro dia e início, com dias ordenados", async () => {
  const ritmoB = await criarRitmo(banco.db, { nome: "Lista B", ordem: 902 });
  const ritmoA = await criarRitmo(banco.db, { nome: "Lista A", ordem: 901 });
  const modulo = await criarModulo(banco.db, { ordem: 1 });
  const professor = await criarProfessor(banco.db, { nome: "Profa. Lista" });
  const base = { moduloId: modulo.id, professorId: professor.id };
  const b = await criarTurma(banco.db, {
    ...base,
    ritmoId: ritmoB.id,
    dias: [1],
  });
  const a2 = await criarTurma(banco.db, {
    ...base,
    ritmoId: ritmoA.id,
    dias: [4, 2],
    horarioInicio: "20:00",
    horarioFim: "21:00",
  });
  const a1 = await criarTurma(banco.db, {
    ...base,
    ritmoId: ritmoA.id,
    dias: [2],
    horarioInicio: "18:00",
    horarioFim: "19:00",
  });
  const a0 = await criarTurma(banco.db, {
    ...base,
    ritmoId: ritmoA.id,
    dias: [0, 6],
  });
  const lista = (await listarTurmas(banco.db)).filter((t) =>
    [a0, a1, a2, b].some((x) => x.id === t.id),
  );
  expect(lista.map((t) => t.id)).toEqual([a0.id, a1.id, a2.id, b.id]);
  expect(lista[2]).toMatchObject({
    ritmo: "Lista A",
    professor: "Profa. Lista",
    dias: [2, 4],
    ativa: true,
  });
});

it("recusa excluir turma com matrícula e exclui a turma sem matrícula", async () => {
  const turma = await criarTurma(banco.db);
  const [aluno] = await banco.db
    .insert(pessoas)
    .values({ nome: "Aluna", email: `aluna-${turma.id}@exemplo.dev` })
    .returning();
  await banco.db
    .insert(matriculas)
    .values({ alunoId: aluno.id, turmaId: turma.id });
  expect(await excluirTurma(banco.db, turma.id)).toEqual({
    ok: false,
    erros: { _: "Está em uso; desative em vez de excluir." },
  });
  expect(await diasGravados(turma.id)).toEqual([2, 4]);

  const livre = await criarTurma(banco.db);
  expect(await excluirTurma(banco.db, livre.id)).toEqual({
    ok: true,
    valor: null,
  });
  expect(await diasGravados(livre.id)).toEqual([]);
});

it("falha no meio da transação não deixa turma gravada", async () => {
  const dados = await dadosValidos();
  const antes = await banco.db.select().from(turmas);
  await expect(
    gravarTurmaComDias(banco.db, {
      ritmoId: dados.ritmoId,
      moduloId: dados.moduloId,
      professorId: dados.professorId,
      dias: [2, 9],
      horarioInicio: "19:00:00",
      horarioFim: "20:00:00",
      linkGrupoWhatsapp: null,
      ativa: true,
    }),
  ).rejects.toThrow();
  expect(await banco.db.select().from(turmas)).toHaveLength(antes.length);
});

it("falha ao editar não apaga os dias antigos", async () => {
  const dados = await dadosValidos();
  const criada = await salvarTurma(banco.db, dados);
  if (!criada.ok) throw new Error("não criou");
  await expect(
    gravarTurmaComDias(banco.db, {
      id: criada.valor.id,
      ritmoId: dados.ritmoId,
      moduloId: dados.moduloId,
      professorId: dados.professorId,
      dias: [3, 9],
      horarioInicio: "10:00:00",
      horarioFim: "11:00:00",
      linkGrupoWhatsapp: null,
      ativa: true,
    }),
  ).rejects.toThrow();
  expect(await diasGravados(criada.valor.id)).toEqual([2, 4]);
  expect((await obterTurma(banco.db, criada.valor.id))?.horarioInicio).toBe(
    "19:00:00",
  );
});
