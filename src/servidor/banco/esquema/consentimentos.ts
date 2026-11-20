import {
  boolean,
  foreignKey,
  index,
  inet,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { pessoas } from "./pessoas";

export const acaoConsentimento = pgEnum("acao_consentimento", [
  "aceite",
  "cancelamento",
]);

export const canalConsentimento = pgEnum("canal_consentimento", [
  "whatsapp",
  "email",
  "plataforma",
]);

export const origemConsentimento = pgEnum("origem_consentimento", [
  "formulario_ativacao",
  "pagina_preferencias",
  "mensagem_whatsapp",
  "pagina_evento",
]);

/** Tipos de consentimento são linhas no banco (sementes em migração), nunca constantes no código. */
export const tiposConsentimento = pgTable("tipos_consentimento", {
  id: uuid("id").primaryKey().defaultRandom(),
  chave: text("chave").notNull().unique(),
  nome: text("nome").notNull(),
  obrigatorio: boolean("obrigatorio").notNull().default(false),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: timestamp("criado_em", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Versões do texto de cada tipo. Imutável: gatilhos bloqueiam UPDATE, DELETE e TRUNCATE. */
export const textosConsentimento = pgTable(
  "textos_consentimento",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tipoId: uuid("tipo_id")
      .notNull()
      .references(() => tiposConsentimento.id, { onDelete: "restrict" }),
    versao: integer("versao").notNull(),
    texto: text("texto").notNull(),
    vigenteDesde: timestamp("vigente_desde", { withTimezone: true }).notNull(),
  },
  (t) => [
    unique("textos_consentimento_tipo_versao_unico").on(t.tipoId, t.versao),
    // Alvo da chave estrangeira composta de registros_consentimento: garante
    // que o texto registrado pertence ao tipo registrado.
    unique("textos_consentimento_id_tipo_unico").on(t.id, t.tipoId),
  ],
);

/**
 * Prova legal (LGPD e política do WhatsApp da Meta): só recebe novas linhas.
 * Gatilhos bloqueiam UPDATE, DELETE e TRUNCATE, inclusive para o dono da tabela.
 */
export const registrosConsentimento = pgTable(
  "registros_consentimento",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tipoId: uuid("tipo_id")
      .notNull()
      .references(() => tiposConsentimento.id, { onDelete: "restrict" }),
    textoId: uuid("texto_id").notNull(),
    /** O aluno a quem o consentimento se refere. */
    titularId: uuid("titular_id")
      .notNull()
      .references(() => pessoas.id, { onDelete: "restrict" }),
    /** Quem concedeu: o próprio aluno ou o responsável. */
    concedenteId: uuid("concedente_id")
      .notNull()
      .references(() => pessoas.id, { onDelete: "restrict" }),
    acao: acaoConsentimento("acao").notNull(),
    canal: canalConsentimento("canal").notNull(),
    contato: text("contato"),
    origem: origemConsentimento("origem").notNull(),
    ip: inet("ip"),
    navegador: text("navegador"),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "registros_consentimento_texto_tipo_fk",
      columns: [t.textoId, t.tipoId],
      foreignColumns: [textosConsentimento.id, textosConsentimento.tipoId],
    }).onDelete("restrict"),
    index("registros_consentimento_titular_tipo_data").on(
      t.titularId,
      t.tipoId,
      t.criadoEm.desc(),
    ),
  ],
);
