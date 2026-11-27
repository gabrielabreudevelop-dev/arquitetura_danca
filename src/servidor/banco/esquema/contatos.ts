import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { pessoas } from "./pessoas";

export const listaContato = pgEnum("lista_contato", [
  "vence_em_breve",
  "vencido",
  "ficha",
  "bolsista_ausente",
  "ficha_bolsista",
]);
export const resultadoContato = pgEnum("resultado_contato", [
  "vai_renovar",
  "vai_pensar",
  "nao_respondeu",
  "nao_volta",
  "nao_quer_contato",
  "vai_voltar",
]);
export const finalidadeMensagem = pgEnum("finalidade_mensagem", [
  "renovacao",
  "retorno",
  "bolsista",
]);

export const mensagensProntas = pgTable(
  "mensagens_prontas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nome: text("nome").notNull(),
    finalidade: finalidadeMensagem("finalidade").notNull(),
    texto: text("texto").notNull(),
    ativa: boolean("ativa").notNull().default(true),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("mensagens_prontas_nome_unico").on(sql`lower(${t.nome})`),
    // Uma mensagem ativa por finalidade.
    uniqueIndex("mensagens_prontas_ativa_unica")
      .on(t.finalidade)
      .where(sql`${t.ativa}`),
  ],
);

/** Registro de cada contato feito (envio manual pelo WhatsApp). */
export const contatos = pgTable(
  "contatos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Um clique em "abrir o WhatsApp" para vários filhos da mesma pessoa compartilha o grupo.
    grupoId: uuid("grupo_id").notNull(),
    alunoId: uuid("aluno_id")
      .notNull()
      .references(() => pessoas.id),
    pessoaContatoId: uuid("pessoa_contato_id")
      .notNull()
      .references(() => pessoas.id),
    whatsapp: text("whatsapp").notNull(),
    lista: listaContato("lista").notNull(),
    mensagemId: uuid("mensagem_id").references(() => mensagensProntas.id),
    texto: text("texto"),
    criadoPor: uuid("criado_por")
      .notNull()
      .references(() => pessoas.id),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resultado: resultadoContato("resultado"),
    resultadoPor: uuid("resultado_por").references(() => pessoas.id),
    resultadoEm: timestamp("resultado_em", { withTimezone: true }),
  },
  (t) => [
    index("contatos_grupo_idx").on(t.grupoId),
    index("contatos_pessoa_contato_idx").on(t.pessoaContatoId),
  ],
);

export const configuracoes = pgTable("configuracoes", {
  chave: text("chave").primaryKey(),
  valor: text("valor").notNull(),
});
