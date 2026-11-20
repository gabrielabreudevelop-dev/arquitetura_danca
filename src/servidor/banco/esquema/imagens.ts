import {
  customType,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** Coluna `bytea` lida e gravada como `Buffer`. */
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/** Imagens enviadas pela administração (capas de eventos), guardadas no banco. */
export const imagens = pgTable("imagens", {
  id: uuid("id").primaryKey().defaultRandom(),
  dados: bytea("dados").notNull(),
  tipo: text("tipo").notNull(),
  largura: integer("largura").notNull(),
  altura: integer("altura").notNull(),
  tamanho: integer("tamanho").notNull(),
  criadoEm: timestamp("criado_em", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
