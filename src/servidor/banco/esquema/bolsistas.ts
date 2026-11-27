import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { turmas } from "./estrutura";
import { pessoas } from "./pessoas";

export const preferenciaPar = pgEnum("preferencia_par", [
  "os_dois",
  "conduzir",
  "ser_conduzido",
]);
export const tipoSituacaoBolsista = pgEnum("tipo_situacao_bolsista", [
  "ativacao",
  "inativacao",
]);
export const situacaoAula = pgEnum("situacao_aula", ["realizada", "nao_houve"]);

/** Ficha do aluno bolsista (a pessoa tem também o papel `aluno`). */
export const bolsistas = pgTable("bolsistas", {
  pessoaId: uuid("pessoa_id")
    .primaryKey()
    .references(() => pessoas.id),
  preferencia: preferenciaPar("preferencia").notNull().default("os_dois"),
  criadoEm: timestamp("criado_em", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Histórico de ativações e inativações da bolsa (nada se apaga). */
export const situacoesBolsista = pgTable(
  "situacoes_bolsista",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pessoaId: uuid("pessoa_id")
      .notNull()
      .references(() => bolsistas.pessoaId),
    tipo: tipoSituacaoBolsista("tipo").notNull(),
    data: date("data").notNull(),
    motivo: text("motivo"),
    criadoPor: uuid("criado_por")
      .notNull()
      .references(() => pessoas.id),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("situacoes_bolsista_pessoa_data_idx").on(t.pessoaId, t.data)],
);

/** Dias da semana combinados com o bolsista (0 = domingo … 6 = sábado), com vigência. */
export const acordosBolsista = pgTable(
  "acordos_bolsista",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pessoaId: uuid("pessoa_id")
      .notNull()
      .references(() => bolsistas.pessoaId),
    dias: smallint("dias").array().notNull(),
    vigenteDesde: date("vigente_desde").notNull(),
    criadoPor: uuid("criado_por")
      .notNull()
      .references(() => pessoas.id),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("acordos_bolsista_pessoa_vigencia_idx").on(
      t.pessoaId,
      t.vigenteDesde,
    ),
    check(
      "acordos_bolsista_dias_validos",
      sql`cardinality(${t.dias}) >= 1 and ${t.dias} <@ array[0,1,2,3,4,5,6]::smallint[]`,
    ),
  ],
);

/** Uma aula de uma turma numa data: aconteceu ou não houve (com motivo). */
export const aulas = pgTable(
  "aulas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    turmaId: uuid("turma_id")
      .notNull()
      .references(() => turmas.id),
    data: date("data").notNull(),
    situacao: situacaoAula("situacao").notNull(),
    motivo: text("motivo"),
    versao: integer("versao").notNull().default(1),
    criadoPor: uuid("criado_por")
      .notNull()
      .references(() => pessoas.id),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    alteradoPor: uuid("alterado_por").references(() => pessoas.id),
    alteradoEm: timestamp("alterado_em", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("aulas_turma_data_unica").on(t.turmaId, t.data),
    check(
      "aulas_motivo_quando_nao_houve",
      sql`${t.situacao} <> 'nao_houve' or (${t.motivo} is not null and length(trim(${t.motivo})) > 0)`,
    ),
  ],
);

/** Presença do aluno numa aula; desmarcar preserva a linha com quem e quando. */
export const presencasAula = pgTable(
  "presencas_aula",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    aulaId: uuid("aula_id")
      .notNull()
      .references(() => aulas.id),
    pessoaId: uuid("pessoa_id")
      .notNull()
      .references(() => pessoas.id),
    marcadaPor: uuid("marcada_por")
      .notNull()
      .references(() => pessoas.id),
    marcadaEm: timestamp("marcada_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    desmarcadaPor: uuid("desmarcada_por").references(() => pessoas.id),
    desmarcadaEm: timestamp("desmarcada_em", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("presencas_aula_viva_unica")
      .on(t.aulaId, t.pessoaId)
      .where(sql`${t.desmarcadaEm} is null`),
    check(
      "presencas_aula_desmarcada_completa",
      sql`(${t.desmarcadaEm} is null) = (${t.desmarcadaPor} is null)`,
    ),
  ],
);
