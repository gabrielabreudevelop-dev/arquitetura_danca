import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { modulos, ritmos, turmas } from "./estrutura";
import { pessoas } from "./pessoas";

export const statusVideo = pgEnum("status_video", ["rascunho", "publicado"]);

export type StatusVideo = (typeof statusVideo.enumValues)[number];

export const videos = pgTable(
  "videos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    professorId: uuid("professor_id")
      .notNull()
      .references(() => pessoas.id),
    ritmoId: uuid("ritmo_id")
      .notNull()
      .references(() => ritmos.id),
    moduloId: uuid("modulo_id")
      .notNull()
      .references(() => modulos.id),
    titulo: text("titulo").notNull(),
    descricao: text("descricao"),
    ordem: integer("ordem").notNull().default(0),
    bunnyVideoId: text("bunny_video_id").unique(),
    status: statusVideo("status").notNull().default("rascunho"),
    autorizacaoImagemConfirmadaPor: uuid(
      "autorizacao_imagem_confirmada_por",
    ).references(() => pessoas.id),
    autorizacaoImagemConfirmadaEm: timestamp(
      "autorizacao_imagem_confirmada_em",
      { withTimezone: true },
    ),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Só se publica vídeo com arquivo no Bunny e autorização de imagem confirmada.
    check(
      "videos_publicacao_completa",
      sql`${t.status} <> 'publicado' or (${t.bunnyVideoId} is not null and ${t.autorizacaoImagemConfirmadaPor} is not null and ${t.autorizacaoImagemConfirmadaEm} is not null)`,
    ),
    index("videos_ritmo_modulo_idx").on(t.ritmoId, t.moduloId),
  ],
);

/** Pessoas que aparecem no vídeo (base da autorização de imagem). */
export const videoPessoas = pgTable(
  "video_pessoas",
  {
    videoId: uuid("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    pessoaId: uuid("pessoa_id")
      .notNull()
      .references(() => pessoas.id),
  },
  (t) => [primaryKey({ columns: [t.videoId, t.pessoaId] })],
);

/**
 * Quem pode ver o quê. Libera um vídeo ou um ritmo (com módulo opcional) para
 * uma turma, um aluno, um ritmo ou um módulo. Uma concessão não faz sentido sem
 * seu alvo, então todas as chaves estrangeiras apagam em cascata.
 */
export const concessoesAcesso = pgTable(
  "concessoes_acesso",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    videoId: uuid("video_id").references(() => videos.id, {
      onDelete: "cascade",
    }),
    ritmoId: uuid("ritmo_id").references(() => ritmos.id, {
      onDelete: "cascade",
    }),
    moduloId: uuid("modulo_id").references(() => modulos.id, {
      onDelete: "cascade",
    }),
    paraTurmaId: uuid("para_turma_id").references(() => turmas.id, {
      onDelete: "cascade",
    }),
    paraAlunoId: uuid("para_aluno_id").references(() => pessoas.id, {
      onDelete: "cascade",
    }),
    paraRitmoId: uuid("para_ritmo_id").references(() => ritmos.id, {
      onDelete: "cascade",
    }),
    paraModuloId: uuid("para_modulo_id").references(() => modulos.id, {
      onDelete: "cascade",
    }),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "concessoes_acesso_conteudo_unico",
      sql`num_nonnulls(${t.videoId}, ${t.ritmoId}) = 1`,
    ),
    check(
      "concessoes_acesso_modulo_com_ritmo",
      sql`${t.moduloId} is null or ${t.ritmoId} is not null`,
    ),
    check(
      "concessoes_acesso_destino_unico",
      sql`num_nonnulls(${t.paraTurmaId}, ${t.paraAlunoId}, ${t.paraRitmoId}, ${t.paraModuloId}) = 1`,
    ),
    index("concessoes_acesso_aluno_idx").on(t.paraAlunoId),
    index("concessoes_acesso_turma_idx").on(t.paraTurmaId),
  ],
);
