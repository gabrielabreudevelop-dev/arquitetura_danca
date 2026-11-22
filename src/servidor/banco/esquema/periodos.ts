import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { turmas } from "./estrutura";
import { pessoas } from "./pessoas";

export const unidadeDuracao = pgEnum("unidade_duracao", ["meses", "dias"]);
export const origemPeriodo = pgEnum("origem_periodo", [
  "plano",
  "transferencia",
]);
export const tipoAjuste = pgEnum("tipo_ajuste", [
  "extensao",
  "trancamento",
  "transferencia_saida",
  "transferencia_entrada",
]);
export const unidadeAjuste = pgEnum("unidade_ajuste", ["dias", "aulas"]);

/** As três colunas de anulação andam juntas: todas nulas ou todas preenchidas. */
function anulacao() {
  return {
    anuladoEm: timestamp("anulado_em", { withTimezone: true }),
    anuladoPor: uuid("anulado_por").references(() => pessoas.id),
    motivoAnulacao: text("motivo_anulacao"),
  };
}

type ColunasAnulacao = {
  anuladoEm: unknown;
  anuladoPor: unknown;
  motivoAnulacao: unknown;
};

function checkAnulacao(nome: string, t: ColunasAnulacao) {
  return check(
    nome,
    sql`(${t.anuladoEm} is null) = (${t.anuladoPor} is null) and (${t.anuladoEm} is null) = (${t.motivoAnulacao} is null)`,
  );
}

export const planos = pgTable(
  "planos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nome: text("nome").notNull(),
    duracaoQuantidade: integer("duracao_quantidade").notNull(),
    duracaoUnidade: unidadeDuracao("duracao_unidade").notNull(),
    ordem: integer("ordem").notNull().default(0),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("planos_nome_unico").on(sql`lower(${t.nome})`),
    check("planos_duracao_positiva", sql`${t.duracaoQuantidade} > 0`),
  ],
);

export const periodosContratados = pgTable(
  "periodos_contratados",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    alunoId: uuid("aluno_id")
      .notNull()
      .references(() => pessoas.id),
    inicio: date("inicio").notNull(),
    fim: date("fim").notNull(),
    planoId: uuid("plano_id").references(() => planos.id),
    origem: origemPeriodo("origem").notNull().default("plano"),
    // Nulo só nas linhas anteriores ao M2.
    criadoPor: uuid("criado_por").references(() => pessoas.id),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...anulacao(),
  },
  (t) => [
    check("periodos_contratados_fim_apos_inicio", sql`${t.fim} >= ${t.inicio}`),
    checkAnulacao("periodos_contratados_anulacao_completa", t),
    index("periodos_contratados_aluno_idx").on(t.alunoId),
  ],
);

export const lotesExtensao = pgTable(
  "lotes_extensao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    todoEstudio: boolean("todo_estudio").notNull(),
    quantidadeDigitada: integer("quantidade_digitada").notNull(),
    unidadeDigitada: unidadeAjuste("unidade_digitada").notNull(),
    motivo: text("motivo").notNull(),
    criadoPor: uuid("criado_por")
      .notNull()
      .references(() => pessoas.id),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...anulacao(),
  },
  (t) => [checkAnulacao("lotes_extensao_anulacao_completa", t)],
);

export const loteTurmas = pgTable(
  "lote_turmas",
  {
    loteId: uuid("lote_id")
      .notNull()
      .references(() => lotesExtensao.id),
    turmaId: uuid("turma_id")
      .notNull()
      .references(() => turmas.id),
  },
  (t) => [primaryKey({ columns: [t.loteId, t.turmaId] })],
);

export const transferencias = pgTable(
  "transferencias",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    periodoOrigemId: uuid("periodo_origem_id")
      .notNull()
      .references(() => periodosContratados.id),
    periodoDestinoId: uuid("periodo_destino_id")
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
    ...anulacao(),
  },
  (t) => [
    check("transferencias_dias_positivo", sql`${t.dias} > 0`),
    checkAnulacao("transferencias_anulacao_completa", t),
  ],
);

export const trancamentos = pgTable(
  "trancamentos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    periodoId: uuid("periodo_id")
      .notNull()
      .references(() => periodosContratados.id),
    inicio: date("inicio").notNull(),
    volta: date("volta"),
    motivo: text("motivo"),
    criadoPor: uuid("criado_por")
      .notNull()
      .references(() => pessoas.id),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    destrancadoPor: uuid("destrancado_por").references(() => pessoas.id),
    destrancadoEm: timestamp("destrancado_em", { withTimezone: true }),
    ...anulacao(),
  },
  (t) => [
    check(
      "trancamentos_volta_apos_inicio",
      sql`${t.volta} is null or ${t.volta} > ${t.inicio}`,
    ),
    checkAnulacao("trancamentos_anulacao_completa", t),
  ],
);

/**
 * Livro de ajustes do período (substitui `extensoes_periodo`). `dias` é
 * negativo só na saída de uma transferência; nunca zero.
 */
export const ajustesPeriodo = pgTable(
  "ajustes_periodo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    periodoId: uuid("periodo_id")
      .notNull()
      .references(() => periodosContratados.id),
    tipo: tipoAjuste("tipo").notNull(),
    dias: integer("dias").notNull(),
    quantidadeDigitada: integer("quantidade_digitada").notNull(),
    unidadeDigitada: unidadeAjuste("unidade_digitada").notNull(),
    turmaConversaoId: uuid("turma_conversao_id").references(() => turmas.id),
    motivo: text("motivo"),
    loteId: uuid("lote_id").references(() => lotesExtensao.id),
    transferenciaId: uuid("transferencia_id").references(
      () => transferencias.id,
    ),
    trancamentoId: uuid("trancamento_id").references(() => trancamentos.id),
    criadoPor: uuid("criado_por")
      .notNull()
      .references(() => pessoas.id),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...anulacao(),
  },
  (t) => [
    check(
      "ajustes_periodo_sinal_dos_dias",
      sql`${t.dias} <> 0 and ((${t.dias} < 0) = (${t.tipo} = 'transferencia_saida'))`,
    ),
    check(
      "ajustes_periodo_aulas_com_turma",
      sql`${t.unidadeDigitada} <> 'aulas' or ${t.turmaConversaoId} is not null`,
    ),
    check(
      "ajustes_periodo_motivo_obrigatorio",
      sql`${t.tipo} = 'trancamento' or (${t.motivo} is not null and length(trim(${t.motivo})) > 0)`,
    ),
    checkAnulacao("ajustes_periodo_anulacao_completa", t),
    index("ajustes_periodo_periodo_idx").on(t.periodoId),
  ],
);
