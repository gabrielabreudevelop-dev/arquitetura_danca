import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  matriculas,
  modulos,
  pessoas,
  ritmos,
  turmaDias,
  turmas,
} from "@/servidor/banco/esquema";
import { criarBancoDeTeste } from "../apoio/banco";
import { esperarErroPg } from "../apoio/erros-pg";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
beforeAll(async () => {
  banco = await criarBancoDeTeste();
});
afterAll(async () => {
  await banco.encerrar();
});

async function criarPessoa(nome = "Pessoa de teste") {
  const [pessoa] = await banco.db.insert(pessoas).values({ nome }).returning();
  return pessoa;
}

async function criarRitmo(nome = `Ritmo ${randomUUID()}`) {
  const [ritmo] = await banco.db.insert(ritmos).values({ nome }).returning();
  return ritmo;
}

async function criarModulo(nome = `Módulo ${randomUUID()}`) {
  const [modulo] = await banco.db
    .insert(modulos)
    .values({ nome, ordem: 1 })
    .returning();
  return modulo;
}

async function criarTurma(valores: Partial<typeof turmas.$inferInsert> = {}) {
  const professor = await criarPessoa("Professora");
  const ritmo = await criarRitmo();
  const modulo = await criarModulo();
  const [turma] = await banco.db
    .insert(turmas)
    .values({
      ritmoId: ritmo.id,
      moduloId: modulo.id,
      professorId: professor.id,
      horarioInicio: "19:00",
      horarioFim: "20:00",
      ...valores,
    })
    .returning();
  return turma;
}

it("recusa ritmo repetido sem diferenciar maiúsculas", async () => {
  const nome = `Samba ${randomUUID()}`;
  await criarRitmo(nome);
  await esperarErroPg(
    banco.db.insert(ritmos).values({ nome: nome.toLowerCase() }),
    "23505",
  );
});

it("recusa módulo repetido sem diferenciar maiúsculas", async () => {
  const nome = `Básico ${randomUUID()}`;
  await criarModulo(nome);
  await esperarErroPg(
    banco.db.insert(modulos).values({ nome: nome.toUpperCase(), ordem: 2 }),
    "23505",
  );
});

it("recusa turma com fim antes ou igual ao início", async () => {
  await esperarErroPg(
    criarTurma({ horarioInicio: "20:00", horarioFim: "19:00" }),
    "23514",
  );
  await esperarErroPg(
    criarTurma({ horarioInicio: "20:00", horarioFim: "20:00" }),
    "23514",
  );
});

it("recusa dia da semana fora de 0..6", async () => {
  const turma = await criarTurma();
  await esperarErroPg(
    banco.db.insert(turmaDias).values({ turmaId: turma.id, diaSemana: 7 }),
    "23514",
  );
  await banco.db.insert(turmaDias).values({ turmaId: turma.id, diaSemana: 0 });
});

it("recusa link de grupo que não seja do WhatsApp", async () => {
  await esperarErroPg(
    criarTurma({ linkGrupoWhatsapp: "https://exemplo.com" }),
    "23514",
  );
  await criarTurma({ linkGrupoWhatsapp: "https://chat.whatsapp.com/abc123" });
  await criarTurma({ linkGrupoWhatsapp: null });
});

it("um aluno pode estar em duas turmas, mas não duas vezes na mesma", async () => {
  const aluno = await criarPessoa("Aluno");
  const turmaA = await criarTurma();
  const turmaB = await criarTurma();
  await banco.db
    .insert(matriculas)
    .values({ alunoId: aluno.id, turmaId: turmaA.id });
  await banco.db
    .insert(matriculas)
    .values({ alunoId: aluno.id, turmaId: turmaB.id });
  await esperarErroPg(
    banco.db
      .insert(matriculas)
      .values({ alunoId: aluno.id, turmaId: turmaA.id }),
    "23505",
  );
});

it("apagar a turma apaga seus dias, mas não com matrícula", async () => {
  const turma = await criarTurma();
  await banco.db.insert(turmaDias).values({ turmaId: turma.id, diaSemana: 2 });
  const aluno = await criarPessoa("Aluno");
  await banco.db
    .insert(matriculas)
    .values({ alunoId: aluno.id, turmaId: turma.id });
  await esperarErroPg(
    banco.sql(`delete from turmas where id = '${turma.id}'`),
    "23503",
  );
  await banco.sql(`delete from matriculas where turma_id = '${turma.id}'`);
  await banco.sql(`delete from turmas where id = '${turma.id}'`);
  const dias = await banco.sql(
    `select 1 from turma_dias where turma_id = '${turma.id}'`,
  );
  expect(dias).toHaveLength(0);
});
