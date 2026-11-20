import { randomUUID } from "node:crypto";
import type { Banco } from "@/servidor/banco/cliente";
import {
  eventos,
  modulos,
  pessoaPapeis,
  pessoas,
  ritmos,
  turmaDias,
  turmas,
} from "@/servidor/banco/esquema";

const sufixo = () => randomUUID().slice(0, 8);

export async function criarRitmo(
  db: Banco,
  parcial: Partial<typeof ritmos.$inferInsert> = {},
) {
  const [ritmo] = await db
    .insert(ritmos)
    .values({
      nome: `Ritmo ${randomUUID()}`,
      slug: `ritmo-${sufixo()}`,
      ...parcial,
    })
    .returning();
  return ritmo;
}

export async function criarModulo(
  db: Banco,
  parcial: Partial<typeof modulos.$inferInsert> = {},
) {
  const [modulo] = await db
    .insert(modulos)
    .values({ nome: `Módulo ${randomUUID()}`, ordem: 1, ...parcial })
    .returning();
  return modulo;
}

/** Cria uma pessoa com o papel `professor` (ativo) e devolve a pessoa. */
export async function criarProfessor(
  db: Banco,
  parcial: Partial<typeof pessoas.$inferInsert> = {},
) {
  const [pessoa] = await db
    .insert(pessoas)
    .values({
      nome: `Professor ${sufixo()}`,
      email: `professor-${randomUUID()}@exemplo.dev`,
      ...parcial,
    })
    .returning();
  await db
    .insert(pessoaPapeis)
    .values({ pessoaId: pessoa.id, papel: "professor", ativo: true });
  return pessoa;
}

/** Cria a turma (e ritmo, módulo e professor que faltarem). Dias padrão: ter e qui. */
export async function criarTurma(
  db: Banco,
  parcial: Partial<typeof turmas.$inferInsert> & { dias?: number[] } = {},
) {
  const { dias = [2, 4], ...valores } = parcial;
  const ritmoId = valores.ritmoId ?? (await criarRitmo(db)).id;
  const moduloId = valores.moduloId ?? (await criarModulo(db)).id;
  const professorId = valores.professorId ?? (await criarProfessor(db)).id;
  const [turma] = await db
    .insert(turmas)
    .values({
      horarioInicio: "19:00",
      horarioFim: "20:00",
      ...valores,
      ritmoId,
      moduloId,
      professorId,
    })
    .returning();
  if (dias.length > 0) {
    await db
      .insert(turmaDias)
      .values(dias.map((diaSemana) => ({ turmaId: turma.id, diaSemana })));
  }
  return turma;
}

/** Evento publicado, começando daqui a 7 dias, salvo indicação em contrário. */
export async function criarEvento(
  db: Banco,
  parcial: Partial<typeof eventos.$inferInsert> = {},
) {
  const publicado = parcial.publicado ?? true;
  const [evento] = await db
    .insert(eventos)
    .values({
      titulo: `Evento ${sufixo()}`,
      slug: `evento-${randomUUID()}`,
      inicio: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      primeiraPublicacaoEm: publicado ? new Date() : null,
      ...parcial,
      publicado,
    })
    .returning();
  return evento;
}
