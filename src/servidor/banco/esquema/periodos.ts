import { sql } from "drizzle-orm";
import {
  check,
  date,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { pessoas } from "./pessoas";

export const periodosContratados = pgTable(
  "periodos_contratados",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    alunoId: uuid("aluno_id")
      .notNull()
      .references(() => pessoas.id),
    inicio: date("inicio").notNull(),
    fim: date("fim").notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("periodos_contratados_fim_apos_inicio", sql`${t.fim} >= ${t.inicio}`),
  ],
);

export const extensoesPeriodo = pgTable(
  "extensoes_periodo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    periodoId: uuid("periodo_id")
      .notNull()
      .references(() => periodosContratados.id),
    dias: integer("dias").notNull(),
    motivo: text("motivo").notNull(),
    criadoPor: uuid("criado_por")
      .notNull()
      .references(() => pessoas.id),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("extensoes_periodo_dias_positivo", sql`${t.dias} > 0`),
    check(
      "extensoes_periodo_motivo_preenchido",
      sql`length(trim(${t.motivo})) > 0`,
    ),
  ],
);
