import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  concessoesAcesso,
  eventos,
  modulos,
  pessoas,
  presencas,
  ritmos,
  turmas,
  videos,
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

async function criarRitmo() {
  const [ritmo] = await banco.db
    .insert(ritmos)
    .values({
      nome: `Ritmo ${randomUUID()}`,
      slug: `ritmo-${randomUUID().slice(0, 8)}`,
    })
    .returning();
  return ritmo;
}

async function criarModulo() {
  const [modulo] = await banco.db
    .insert(modulos)
    .values({ nome: `Módulo ${randomUUID()}`, ordem: 1 })
    .returning();
  return modulo;
}

async function criarTurma() {
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
    })
    .returning();
  return turma;
}

async function valoresDeVideo(): Promise<typeof videos.$inferInsert> {
  const professor = await criarPessoa("Professor");
  const ritmo = await criarRitmo();
  const modulo = await criarModulo();
  return {
    professorId: professor.id,
    ritmoId: ritmo.id,
    moduloId: modulo.id,
    titulo: "Giro simples",
  };
}

async function criarVideo() {
  const [video] = await banco.db
    .insert(videos)
    .values(await valoresDeVideo())
    .returning();
  return video;
}

it("recusa publicar vídeo sem id do Bunny ou sem autorização de imagem", async () => {
  const base = await valoresDeVideo();
  const confirmadora = await criarPessoa("Administradora");
  await esperarErroPg(
    banco.db.insert(videos).values({
      ...base,
      status: "publicado",
      autorizacaoImagemConfirmadaPor: confirmadora.id,
      autorizacaoImagemConfirmadaEm: new Date(),
    }),
    "23514",
  );
  await esperarErroPg(
    banco.db.insert(videos).values({
      ...base,
      status: "publicado",
      bunnyVideoId: randomUUID(),
    }),
    "23514",
  );
});

it("aceita vídeo publicado completo", async () => {
  const base = await valoresDeVideo();
  const confirmadora = await criarPessoa("Administradora");
  const [video] = await banco.db
    .insert(videos)
    .values({
      ...base,
      status: "publicado",
      bunnyVideoId: randomUUID(),
      autorizacaoImagemConfirmadaPor: confirmadora.id,
      autorizacaoImagemConfirmadaEm: new Date(),
    })
    .returning();
  expect(video.status).toBe("publicado");
});

it("recusa concessão sem destino ou com dois destinos", async () => {
  const video = await criarVideo();
  const turma = await criarTurma();
  const aluno = await criarPessoa("Aluna");
  await esperarErroPg(
    banco.db.insert(concessoesAcesso).values({ videoId: video.id }),
    "23514",
  );
  await esperarErroPg(
    banco.db.insert(concessoesAcesso).values({
      videoId: video.id,
      paraTurmaId: turma.id,
      paraAlunoId: aluno.id,
    }),
    "23514",
  );
});

it("aceita concessão de um vídeo para uma turma e de ritmo com módulo para um aluno", async () => {
  const video = await criarVideo();
  const turma = await criarTurma();
  const aluno = await criarPessoa("Aluna");
  const ritmo = await criarRitmo();
  const modulo = await criarModulo();
  await banco.db
    .insert(concessoesAcesso)
    .values({ videoId: video.id, paraTurmaId: turma.id });
  await banco.db
    .insert(concessoesAcesso)
    .values({ ritmoId: ritmo.id, moduloId: modulo.id, paraAlunoId: aluno.id });
});

it("recusa concessão que libera vídeo e ritmo ao mesmo tempo", async () => {
  const video = await criarVideo();
  const ritmo = await criarRitmo();
  const turma = await criarTurma();
  await esperarErroPg(
    banco.db
      .insert(concessoesAcesso)
      .values({ videoId: video.id, ritmoId: ritmo.id, paraTurmaId: turma.id }),
    "23514",
  );
});

it("recusa módulo sem ritmo na concessão", async () => {
  const video = await criarVideo();
  const modulo = await criarModulo();
  const turma = await criarTurma();
  await esperarErroPg(
    banco.db.insert(concessoesAcesso).values({
      videoId: video.id,
      moduloId: modulo.id,
      paraTurmaId: turma.id,
    }),
    "23514",
  );
});

it("recusa slug com espaço ou maiúscula", async () => {
  await esperarErroPg(
    banco.db
      .insert(eventos)
      .values({ titulo: "Baile", slug: "Baile de Gala", inicio: new Date() }),
    "23514",
  );
});

it("recusa evento que termina antes de começar", async () => {
  const inicio = new Date("2027-01-10T20:00:00Z");
  await esperarErroPg(
    banco.db.insert(eventos).values({
      titulo: "Baile",
      slug: `baile-${randomUUID()}`,
      inicio,
      fim: new Date("2027-01-10T19:00:00Z"),
    }),
    "23514",
  );
});

it("recusa confirmar presença duas vezes no mesmo evento", async () => {
  const pessoa = await criarPessoa("Convidada");
  const [evento] = await banco.db
    .insert(eventos)
    .values({
      titulo: "Baile de Gala",
      slug: `baile-${randomUUID()}`,
      inicio: new Date(),
    })
    .returning();
  await banco.db
    .insert(presencas)
    .values({ eventoId: evento.id, pessoaId: pessoa.id });
  await esperarErroPg(
    banco.db
      .insert(presencas)
      .values({ eventoId: evento.id, pessoaId: pessoa.id }),
    "23505",
  );
});
