import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { pessoas } from "./pessoas";

export const eventos = pgTable(
  "eventos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    titulo: text("titulo").notNull(),
    slug: text("slug").notNull().unique(),
    descricao: text("descricao"),
    local: text("local"),
    inicio: timestamp("inicio", { withTimezone: true }).notNull(),
    fim: timestamp("fim", { withTimezone: true }),
    capaUrl: text("capa_url"),
    publicado: boolean("publicado").notNull().default(false),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("eventos_slug_valido", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check(
      "eventos_fim_depois_do_inicio",
      sql`${t.fim} is null or ${t.fim} > ${t.inicio}`,
    ),
    index("eventos_inicio_idx").on(t.inicio),
  ],
);

/** Confirmação de presença em um evento. */
export const presencas = pgTable(
  "presencas",
  {
    eventoId: uuid("evento_id")
      .notNull()
      .references(() => eventos.id, { onDelete: "cascade" }),
    pessoaId: uuid("pessoa_id")
      .notNull()
      .references(() => pessoas.id),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.eventoId, t.pessoaId] })],
);
