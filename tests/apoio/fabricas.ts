import { randomUUID } from "node:crypto";
import type { DataIso } from "@/servidor/alunos/datas";
import type { Banco } from "@/servidor/banco/cliente";
import {
  acordosBolsista,
  aulas,
  bolsistas,
  eventos,
  matriculas,
  modulos,
  periodosContratados,
  pessoaPapeis,
  pessoas,
  planos,
  presencasAula,
  responsabilidades,
  ritmos,
  situacoesBolsista,
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

/** Pessoa com o papel `administracao` (ativo). */
export async function criarAdministracao(db: Banco) {
  const [pessoa] = await db
    .insert(pessoas)
    .values({
      nome: `Administração ${sufixo()}`,
      email: `adm-${randomUUID()}@exemplo.dev`,
    })
    .returning();
  await db
    .insert(pessoaPapeis)
    .values({ pessoaId: pessoa.id, papel: "administracao", ativo: true });
  return pessoa;
}

function whatsappAleatorio() {
  const digitos = Array.from({ length: 9 }, () =>
    Math.floor(Math.random() * 10),
  ).join("");
  return `+5511${digitos}`;
}

/**
 * Pessoa com o papel `aluno` (ativo), adulta por padrão e com WhatsApp
 * aleatório. Com `responsavelId`, liga o responsável ao aluno.
 */
export async function criarAluno(
  db: Banco,
  parcial: Partial<typeof pessoas.$inferInsert> & {
    nascimento?: DataIso;
    responsavelId?: string;
  } = {},
) {
  const { nascimento, responsavelId, ...valores } = parcial;
  const [aluno] = await db
    .insert(pessoas)
    .values({
      nome: `Aluno ${sufixo()}`,
      whatsapp: whatsappAleatorio(),
      dataNascimento: nascimento ?? "1990-01-01",
      ...valores,
    })
    .returning();
  await db
    .insert(pessoaPapeis)
    .values({ pessoaId: aluno.id, papel: "aluno", ativo: true });
  if (responsavelId) {
    await db
      .insert(responsabilidades)
      .values({ responsavelId, alunoId: aluno.id });
  }
  return aluno;
}

/** Plano "Mensal" (1 mês), com nome único salvo indicação em contrário. */
export async function criarPlano(
  db: Banco,
  parcial: Partial<typeof planos.$inferInsert> = {},
) {
  const [plano] = await db
    .insert(planos)
    .values({
      nome: `Mensal ${sufixo()}`,
      duracaoQuantidade: 1,
      duracaoUnidade: "meses",
      ...parcial,
    })
    .returning();
  return plano;
}

export async function criarPeriodo(
  db: Banco,
  valores: {
    alunoId: string;
    inicio: DataIso;
    fim: DataIso;
    criadoPor: string;
    planoId?: string;
  },
) {
  const [periodo] = await db
    .insert(periodosContratados)
    .values(valores)
    .returning();
  return periodo;
}

export async function criarMatricula(
  db: Banco,
  valores: {
    alunoId: string;
    turmaId: string;
    entrada: DataIso;
    criadoPor: string;
  },
) {
  const [matricula] = await db.insert(matriculas).values(valores).returning();
  return matricula;
}

/**
 * Bolsista: pessoa com papel `aluno` ativo, ficha em `bolsistas`, ativação em
 * `desde` e acordo de dias vigente desde `desde` (padrão: terças, 2026-11-01).
 */
export async function criarBolsista(
  db: Banco,
  valores: {
    criadoPor: string;
    dias?: number[];
    desde?: DataIso;
    preferencia?: (typeof bolsistas.$inferInsert)["preferencia"];
    nascimento?: DataIso;
  },
) {
  const { criadoPor, dias = [2], desde = "2026-11-01", preferencia } = valores;
  const pessoa = await criarAluno(db, { nascimento: valores.nascimento });
  await db.insert(bolsistas).values({ pessoaId: pessoa.id, preferencia });
  await db.insert(situacoesBolsista).values({
    pessoaId: pessoa.id,
    tipo: "ativacao",
    data: desde,
    criadoPor,
  });
  await db.insert(acordosBolsista).values({
    pessoaId: pessoa.id,
    dias,
    vigenteDesde: desde,
    criadoPor,
  });
  return pessoa;
}

/**
 * Aula de uma turma numa data (realizada, salvo indicação em contrário).
 * Aula realizada já vem com chamada salva (por quem criou), a não ser que
 * `chamadaSalva: false`.
 */
export async function criarAula(
  db: Banco,
  valores: {
    turmaId: string;
    data: DataIso;
    situacao?: (typeof aulas.$inferInsert)["situacao"];
    motivo?: string;
    criadoPor: string;
    chamadaSalva?: boolean;
  },
) {
  const { chamadaSalva, ...resto } = valores;
  const situacao = resto.situacao ?? "realizada";
  const salva = chamadaSalva ?? situacao === "realizada";
  const [aula] = await db
    .insert(aulas)
    .values({
      ...resto,
      situacao,
      ...(salva
        ? { chamadaSalvaEm: new Date(), chamadaSalvaPor: resto.criadoPor }
        : {}),
    })
    .returning();
  return aula;
}

export async function marcarPresenca(
  db: Banco,
  valores: { aulaId: string; pessoaId: string; por: string },
) {
  const [presenca] = await db
    .insert(presencasAula)
    .values({
      aulaId: valores.aulaId,
      pessoaId: valores.pessoaId,
      marcadaPor: valores.por,
    })
    .returning();
  return presenca;
}
