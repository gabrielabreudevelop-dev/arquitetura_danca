import { sql } from "drizzle-orm";
import {
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
  ],
);

export const pessoaPapeis = pgTable(
  "pessoa_papeis",
  {
    pessoaId: uuid("pessoa_id")
      .notNull()
      .references(() => pessoas.id, { onDelete: "cascade" }),
    papel: papel("papel").notNull(),
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
