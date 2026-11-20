import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { pessoas } from "./pessoas";

/** Ritmos são cadastrados pela administração (nunca por migração). */
export const ritmos = pgTable(
  "ritmos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nome: text("nome").notNull(),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("ritmos_nome_unico").on(sql`lower(${t.nome})`)],
);

/** Módulos também são cadastrados pela administração; `ordem` pode se repetir. */
export const modulos = pgTable(
  "modulos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nome: text("nome").notNull(),
    ordem: integer("ordem").notNull(),
    ativo: boolean("ativo").notNull().default(true),
  },
  (t) => [uniqueIndex("modulos_nome_unico").on(sql`lower(${t.nome})`)],
);

export const turmas = pgTable(
  "turmas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ritmoId: uuid("ritmo_id")
      .notNull()
      .references(() => ritmos.id),
    moduloId: uuid("modulo_id")
      .notNull()
      .references(() => modulos.id),
    professorId: uuid("professor_id")
      .notNull()
      .references(() => pessoas.id),
    horarioInicio: time("horario_inicio").notNull(),
    horarioFim: time("horario_fim").notNull(),
    linkGrupoWhatsapp: text("link_grupo_whatsapp"),
    ativa: boolean("ativa").notNull().default(true),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("turmas_horario_valido", sql`${t.horarioFim} > ${t.horarioInicio}`),
    check(
      "turmas_link_whatsapp_valido",
      sql`${t.linkGrupoWhatsapp} is null or ${t.linkGrupoWhatsapp} like 'https://chat.whatsapp.com/%'`,
    ),
    index("turmas_ritmo_idx").on(t.ritmoId),
    index("turmas_professor_idx").on(t.professorId),
  ],
);

/** Dias da semana em que a turma acontece (0 = domingo). */
export const turmaDias = pgTable(
  "turma_dias",
  {
    turmaId: uuid("turma_id")
      .notNull()
      .references(() => turmas.id, { onDelete: "cascade" }),
    diaSemana: smallint("dia_semana").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.turmaId, t.diaSemana] }),
    check("turma_dias_dia_valido", sql`${t.diaSemana} between 0 and 6`),
  ],
);

export const matriculas = pgTable(
  "matriculas",
  {
    alunoId: uuid("aluno_id")
      .notNull()
      .references(() => pessoas.id),
    turmaId: uuid("turma_id")
      .notNull()
      .references(() => turmas.id),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.alunoId, t.turmaId] }),
    index("matriculas_turma_idx").on(t.turmaId),
  ],
);
