import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/** Papéis de pessoa: enum fixo (ao contrário de ritmos, módulos e consentimentos). */
export const papel = pgEnum("papel", [
  "administracao",
  "atendente",
  "professor",
  "aluno",
  "responsavel",
]);

export type Papel = (typeof papel.enumValues)[number];

export const pessoas = pgTable(
  "pessoas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nome: text("nome").notNull(),
    email: text("email"),
    whatsapp: text("whatsapp"),
    dataNascimento: date("data_nascimento"),
    // Nome de usuário no Instagram, sem arroba nem endereço.
    instagram: text("instagram"),
    // Conta de login (Better Auth). Só a equipe tem; não se apaga o usuário
    // enquanto houver pessoa ligada a ele.
    usuarioId: text("usuario_id")
      .unique()
      .references(() => user.id, { onDelete: "restrict" }),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("pessoas_email_unico")
      .on(sql`lower(${t.email})`)
      .where(sql`${t.email} is not null`),
    check(
      "pessoas_instagram_valido",
      sql`${t.instagram} is null or ${t.instagram} ~ '^[a-z0-9._]{1,30}$'`,
    ),
  ],
);

export const pessoaPapeis = pgTable(
  "pessoa_papeis",
  {
    pessoaId: uuid("pessoa_id")
      .notNull()
      .references(() => pessoas.id, { onDelete: "cascade" }),
    papel: papel("papel").notNull(),
    // Papel desativado deixa de valer sem apagar o histórico.
    ativo: boolean("ativo").notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.pessoaId, t.papel] })],
);

export const responsabilidades = pgTable(
  "responsabilidades",
  {
    responsavelId: uuid("responsavel_id")
      .notNull()
      .references(() => pessoas.id),
    alunoId: uuid("aluno_id")
      .notNull()
      .references(() => pessoas.id),
  },
  (t) => [
    primaryKey({ columns: [t.responsavelId, t.alunoId] }),
    check(
      "responsabilidades_responsavel_diferente_do_aluno",
      sql`${t.responsavelId} <> ${t.alunoId}`,
    ),
  ],
);

export const tipoEncerramento = pgEnum("tipo_encerramento", [
  "encerramento",
  "reabertura",
]);

/** Histórico de encerramentos e reaberturas do aluno (nada se apaga). */
export const encerramentosAluno = pgTable("encerramentos_aluno", {
  id: uuid("id").primaryKey().defaultRandom(),
  alunoId: uuid("aluno_id")
    .notNull()
    .references(() => pessoas.id),
  tipo: tipoEncerramento("tipo").notNull(),
  data: date("data").notNull(),
  motivo: text("motivo"),
  criadoPor: uuid("criado_por")
    .notNull()
    .references(() => pessoas.id),
  criadoEm: timestamp("criado_em", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** "Não quer contato": vale para a pessoa que recebe as mensagens. */
export const bloqueiosContato = pgTable(
  "bloqueios_contato",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pessoaId: uuid("pessoa_id")
      .notNull()
      .references(() => pessoas.id),
    marcadoEm: timestamp("marcado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    marcadoPor: uuid("marcado_por")
      .notNull()
      .references(() => pessoas.id),
    desfeitoEm: timestamp("desfeito_em", { withTimezone: true }),
    desfeitoPor: uuid("desfeito_por").references(() => pessoas.id),
  },
  (t) => [
    uniqueIndex("bloqueios_contato_aberto_unico")
      .on(t.pessoaId)
      .where(sql`${t.desfeitoEm} is null`),
    check(
      "bloqueios_contato_desfeito_completo",
      sql`(${t.desfeitoEm} is null) = (${t.desfeitoPor} is null)`,
    ),
  ],
);
