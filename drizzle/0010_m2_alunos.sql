CREATE TYPE "public"."finalidade_mensagem" AS ENUM('renovacao', 'retorno');--> statement-breakpoint
CREATE TYPE "public"."lista_contato" AS ENUM('vence_em_breve', 'vencido', 'ficha');--> statement-breakpoint
CREATE TYPE "public"."resultado_contato" AS ENUM('vai_renovar', 'vai_pensar', 'nao_respondeu', 'nao_volta', 'nao_quer_contato');--> statement-breakpoint
CREATE TYPE "public"."origem_periodo" AS ENUM('plano', 'transferencia');--> statement-breakpoint
CREATE TYPE "public"."tipo_ajuste" AS ENUM('extensao', 'trancamento', 'transferencia_saida', 'transferencia_entrada');--> statement-breakpoint
CREATE TYPE "public"."unidade_ajuste" AS ENUM('dias', 'aulas');--> statement-breakpoint
CREATE TYPE "public"."unidade_duracao" AS ENUM('meses', 'dias');--> statement-breakpoint
CREATE TYPE "public"."tipo_encerramento" AS ENUM('encerramento', 'reabertura');--> statement-breakpoint
CREATE TABLE "configuracoes" (
	"chave" text PRIMARY KEY NOT NULL,
	"valor" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contatos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grupo_id" uuid NOT NULL,
	"aluno_id" uuid NOT NULL,
	"pessoa_contato_id" uuid NOT NULL,
	"whatsapp" text NOT NULL,
	"lista" "lista_contato" NOT NULL,
	"mensagem_id" uuid,
	"texto" text,
	"criado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"resultado" "resultado_contato",
	"resultado_por" uuid,
	"resultado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "mensagens_prontas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"finalidade" "finalidade_mensagem" NOT NULL,
	"texto" text NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ajustes_periodo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"periodo_id" uuid NOT NULL,
	"tipo" "tipo_ajuste" NOT NULL,
	"dias" integer NOT NULL,
	"quantidade_digitada" integer NOT NULL,
	"unidade_digitada" "unidade_ajuste" NOT NULL,
	"turma_conversao_id" uuid,
	"motivo" text,
	"lote_id" uuid,
	"transferencia_id" uuid,
	"trancamento_id" uuid,
	"criado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"anulado_em" timestamp with time zone,
	"anulado_por" uuid,
	"motivo_anulacao" text,
	CONSTRAINT "ajustes_periodo_sinal_dos_dias" CHECK ("ajustes_periodo"."dias" <> 0 and (("ajustes_periodo"."dias" < 0) = ("ajustes_periodo"."tipo" = 'transferencia_saida'))),
	CONSTRAINT "ajustes_periodo_aulas_com_turma" CHECK ("ajustes_periodo"."unidade_digitada" <> 'aulas' or "ajustes_periodo"."turma_conversao_id" is not null),
	CONSTRAINT "ajustes_periodo_motivo_obrigatorio" CHECK ("ajustes_periodo"."tipo" = 'trancamento' or ("ajustes_periodo"."motivo" is not null and length(trim("ajustes_periodo"."motivo")) > 0)),
	CONSTRAINT "ajustes_periodo_anulacao_completa" CHECK (("ajustes_periodo"."anulado_em" is null) = ("ajustes_periodo"."anulado_por" is null) and ("ajustes_periodo"."anulado_em" is null) = ("ajustes_periodo"."motivo_anulacao" is null))
);
--> statement-breakpoint
CREATE TABLE "lote_turmas" (
	"lote_id" uuid NOT NULL,
	"turma_id" uuid NOT NULL,
	CONSTRAINT "lote_turmas_lote_id_turma_id_pk" PRIMARY KEY("lote_id","turma_id")
);
--> statement-breakpoint
CREATE TABLE "lotes_extensao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"todo_estudio" boolean NOT NULL,
	"quantidade_digitada" integer NOT NULL,
	"unidade_digitada" "unidade_ajuste" NOT NULL,
	"motivo" text NOT NULL,
	"criado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"anulado_em" timestamp with time zone,
	"anulado_por" uuid,
	"motivo_anulacao" text,
	CONSTRAINT "lotes_extensao_anulacao_completa" CHECK (("lotes_extensao"."anulado_em" is null) = ("lotes_extensao"."anulado_por" is null) and ("lotes_extensao"."anulado_em" is null) = ("lotes_extensao"."motivo_anulacao" is null))
);
--> statement-breakpoint
CREATE TABLE "planos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"duracao_quantidade" integer NOT NULL,
	"duracao_unidade" "unidade_duracao" NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planos_duracao_positiva" CHECK ("planos"."duracao_quantidade" > 0)
);
--> statement-breakpoint
CREATE TABLE "trancamentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"periodo_id" uuid NOT NULL,
	"inicio" date NOT NULL,
	"volta" date,
	"motivo" text,
	"criado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"destrancado_por" uuid,
	"destrancado_em" timestamp with time zone,
	"anulado_em" timestamp with time zone,
	"anulado_por" uuid,
	"motivo_anulacao" text,
	CONSTRAINT "trancamentos_volta_apos_inicio" CHECK ("trancamentos"."volta" is null or "trancamentos"."volta" > "trancamentos"."inicio"),
	CONSTRAINT "trancamentos_anulacao_completa" CHECK (("trancamentos"."anulado_em" is null) = ("trancamentos"."anulado_por" is null) and ("trancamentos"."anulado_em" is null) = ("trancamentos"."motivo_anulacao" is null))
);
--> statement-breakpoint
CREATE TABLE "transferencias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"periodo_origem_id" uuid NOT NULL,
	"periodo_destino_id" uuid NOT NULL,
	"dias" integer NOT NULL,
	"motivo" text NOT NULL,
	"criado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"anulado_em" timestamp with time zone,
	"anulado_por" uuid,
	"motivo_anulacao" text,
	CONSTRAINT "transferencias_dias_positivo" CHECK ("transferencias"."dias" > 0),
	CONSTRAINT "transferencias_anulacao_completa" CHECK (("transferencias"."anulado_em" is null) = ("transferencias"."anulado_por" is null) and ("transferencias"."anulado_em" is null) = ("transferencias"."motivo_anulacao" is null))
);
--> statement-breakpoint
CREATE TABLE "bloqueios_contato" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"marcado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"marcado_por" uuid NOT NULL,
	"desfeito_em" timestamp with time zone,
	"desfeito_por" uuid,
	CONSTRAINT "bloqueios_contato_desfeito_completo" CHECK (("bloqueios_contato"."desfeito_em" is null) = ("bloqueios_contato"."desfeito_por" is null))
);
--> statement-breakpoint
CREATE TABLE "encerramentos_aluno" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aluno_id" uuid NOT NULL,
	"tipo" "tipo_encerramento" NOT NULL,
	"data" date NOT NULL,
	"motivo" text,
	"criado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "extensoes_periodo" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "extensoes_periodo" CASCADE;--> statement-breakpoint
ALTER TABLE "matriculas" DROP CONSTRAINT "matriculas_aluno_id_turma_id_pk";--> statement-breakpoint
ALTER TABLE "matriculas" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "matriculas" ADD COLUMN "entrada" date;--> statement-breakpoint
UPDATE "matriculas" SET "entrada" = ("criado_em" AT TIME ZONE 'America/Sao_Paulo')::date;--> statement-breakpoint
ALTER TABLE "matriculas" ALTER COLUMN "entrada" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "matriculas" ADD COLUMN "saida" date;--> statement-breakpoint
ALTER TABLE "matriculas" ADD COLUMN "criado_por" uuid;--> statement-breakpoint
ALTER TABLE "matriculas" ADD COLUMN "saida_por" uuid;--> statement-breakpoint
ALTER TABLE "periodos_contratados" ADD COLUMN "plano_id" uuid;--> statement-breakpoint
ALTER TABLE "periodos_contratados" ADD COLUMN "origem" "origem_periodo" DEFAULT 'plano' NOT NULL;--> statement-breakpoint
ALTER TABLE "periodos_contratados" ADD COLUMN "criado_por" uuid;--> statement-breakpoint
ALTER TABLE "periodos_contratados" ADD COLUMN "anulado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "periodos_contratados" ADD COLUMN "anulado_por" uuid;--> statement-breakpoint
ALTER TABLE "periodos_contratados" ADD COLUMN "motivo_anulacao" text;--> statement-breakpoint
ALTER TABLE "pessoas" ADD COLUMN "instagram" text;--> statement-breakpoint
ALTER TABLE "contatos" ADD CONSTRAINT "contatos_aluno_id_pessoas_id_fk" FOREIGN KEY ("aluno_id") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contatos" ADD CONSTRAINT "contatos_pessoa_contato_id_pessoas_id_fk" FOREIGN KEY ("pessoa_contato_id") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contatos" ADD CONSTRAINT "contatos_mensagem_id_mensagens_prontas_id_fk" FOREIGN KEY ("mensagem_id") REFERENCES "public"."mensagens_prontas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contatos" ADD CONSTRAINT "contatos_criado_por_pessoas_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contatos" ADD CONSTRAINT "contatos_resultado_por_pessoas_id_fk" FOREIGN KEY ("resultado_por") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ajustes_periodo" ADD CONSTRAINT "ajustes_periodo_periodo_id_periodos_contratados_id_fk" FOREIGN KEY ("periodo_id") REFERENCES "public"."periodos_contratados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ajustes_periodo" ADD CONSTRAINT "ajustes_periodo_turma_conversao_id_turmas_id_fk" FOREIGN KEY ("turma_conversao_id") REFERENCES "public"."turmas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ajustes_periodo" ADD CONSTRAINT "ajustes_periodo_lote_id_lotes_extensao_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes_extensao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ajustes_periodo" ADD CONSTRAINT "ajustes_periodo_transferencia_id_transferencias_id_fk" FOREIGN KEY ("transferencia_id") REFERENCES "public"."transferencias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ajustes_periodo" ADD CONSTRAINT "ajustes_periodo_trancamento_id_trancamentos_id_fk" FOREIGN KEY ("trancamento_id") REFERENCES "public"."trancamentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ajustes_periodo" ADD CONSTRAINT "ajustes_periodo_criado_por_pessoas_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ajustes_periodo" ADD CONSTRAINT "ajustes_periodo_anulado_por_pessoas_id_fk" FOREIGN KEY ("anulado_por") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lote_turmas" ADD CONSTRAINT "lote_turmas_lote_id_lotes_extensao_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes_extensao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lote_turmas" ADD CONSTRAINT "lote_turmas_turma_id_turmas_id_fk" FOREIGN KEY ("turma_id") REFERENCES "public"."turmas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lotes_extensao" ADD CONSTRAINT "lotes_extensao_criado_por_pessoas_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lotes_extensao" ADD CONSTRAINT "lotes_extensao_anulado_por_pessoas_id_fk" FOREIGN KEY ("anulado_por") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trancamentos" ADD CONSTRAINT "trancamentos_periodo_id_periodos_contratados_id_fk" FOREIGN KEY ("periodo_id") REFERENCES "public"."periodos_contratados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trancamentos" ADD CONSTRAINT "trancamentos_criado_por_pessoas_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trancamentos" ADD CONSTRAINT "trancamentos_destrancado_por_pessoas_id_fk" FOREIGN KEY ("destrancado_por") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trancamentos" ADD CONSTRAINT "trancamentos_anulado_por_pessoas_id_fk" FOREIGN KEY ("anulado_por") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transferencias" ADD CONSTRAINT "transferencias_periodo_origem_id_periodos_contratados_id_fk" FOREIGN KEY ("periodo_origem_id") REFERENCES "public"."periodos_contratados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transferencias" ADD CONSTRAINT "transferencias_periodo_destino_id_periodos_contratados_id_fk" FOREIGN KEY ("periodo_destino_id") REFERENCES "public"."periodos_contratados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transferencias" ADD CONSTRAINT "transferencias_criado_por_pessoas_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transferencias" ADD CONSTRAINT "transferencias_anulado_por_pessoas_id_fk" FOREIGN KEY ("anulado_por") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bloqueios_contato" ADD CONSTRAINT "bloqueios_contato_pessoa_id_pessoas_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bloqueios_contato" ADD CONSTRAINT "bloqueios_contato_marcado_por_pessoas_id_fk" FOREIGN KEY ("marcado_por") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bloqueios_contato" ADD CONSTRAINT "bloqueios_contato_desfeito_por_pessoas_id_fk" FOREIGN KEY ("desfeito_por") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encerramentos_aluno" ADD CONSTRAINT "encerramentos_aluno_aluno_id_pessoas_id_fk" FOREIGN KEY ("aluno_id") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encerramentos_aluno" ADD CONSTRAINT "encerramentos_aluno_criado_por_pessoas_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contatos_grupo_idx" ON "contatos" USING btree ("grupo_id");--> statement-breakpoint
CREATE INDEX "contatos_pessoa_contato_idx" ON "contatos" USING btree ("pessoa_contato_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mensagens_prontas_nome_unico" ON "mensagens_prontas" USING btree (lower("nome"));--> statement-breakpoint
CREATE UNIQUE INDEX "mensagens_prontas_ativa_unica" ON "mensagens_prontas" USING btree ("finalidade") WHERE "mensagens_prontas"."ativa";--> statement-breakpoint
CREATE INDEX "ajustes_periodo_periodo_idx" ON "ajustes_periodo" USING btree ("periodo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "planos_nome_unico" ON "planos" USING btree (lower("nome"));--> statement-breakpoint
CREATE UNIQUE INDEX "bloqueios_contato_aberto_unico" ON "bloqueios_contato" USING btree ("pessoa_id") WHERE "bloqueios_contato"."desfeito_em" is null;--> statement-breakpoint
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_criado_por_pessoas_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_saida_por_pessoas_id_fk" FOREIGN KEY ("saida_por") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "periodos_contratados" ADD CONSTRAINT "periodos_contratados_plano_id_planos_id_fk" FOREIGN KEY ("plano_id") REFERENCES "public"."planos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "periodos_contratados" ADD CONSTRAINT "periodos_contratados_criado_por_pessoas_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "periodos_contratados" ADD CONSTRAINT "periodos_contratados_anulado_por_pessoas_id_fk" FOREIGN KEY ("anulado_por") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "matriculas_aberta_unica" ON "matriculas" USING btree ("aluno_id","turma_id") WHERE "matriculas"."saida" is null;--> statement-breakpoint
CREATE INDEX "periodos_contratados_aluno_idx" ON "periodos_contratados" USING btree ("aluno_id");--> statement-breakpoint
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_saida_apos_entrada" CHECK ("matriculas"."saida" >= "matriculas"."entrada");--> statement-breakpoint
ALTER TABLE "periodos_contratados" ADD CONSTRAINT "periodos_contratados_anulacao_completa" CHECK (("periodos_contratados"."anulado_em" is null) = ("periodos_contratados"."anulado_por" is null) and ("periodos_contratados"."anulado_em" is null) = ("periodos_contratados"."motivo_anulacao" is null));--> statement-breakpoint
ALTER TABLE "pessoas" ADD CONSTRAINT "pessoas_instagram_valido" CHECK ("pessoas"."instagram" is null or "pessoas"."instagram" ~ '^[a-z0-9._]{1,30}$');
--> statement-breakpoint
-- Livro imutável: lançamentos de período só podem ser anulados (as três colunas
-- de anulação), uma única vez; nunca alterados nem apagados, nem pelo dono.
CREATE FUNCTION bloquear_alteracao_periodo() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'lançamento do período não pode ser alterado nem apagado';
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION permitir_so_anulacao() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.anulado_em IS NOT NULL
    OR (to_jsonb(NEW) - 'anulado_em' - 'anulado_por' - 'motivo_anulacao')
       IS DISTINCT FROM
       (to_jsonb(OLD) - 'anulado_em' - 'anulado_por' - 'motivo_anulacao')
  THEN
    RAISE EXCEPTION 'lançamento do período não pode ser alterado nem apagado';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER ajustes_periodo_so_anula
  BEFORE UPDATE ON ajustes_periodo
  FOR EACH ROW EXECUTE FUNCTION permitir_so_anulacao();
--> statement-breakpoint
CREATE TRIGGER ajustes_periodo_sem_delete
  BEFORE DELETE ON ajustes_periodo
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao_periodo();
--> statement-breakpoint
CREATE TRIGGER ajustes_periodo_sem_truncate
  BEFORE TRUNCATE ON ajustes_periodo
  FOR EACH STATEMENT EXECUTE FUNCTION bloquear_alteracao_periodo();
--> statement-breakpoint
CREATE TRIGGER periodos_contratados_so_anula
  BEFORE UPDATE ON periodos_contratados
  FOR EACH ROW EXECUTE FUNCTION permitir_so_anulacao();
--> statement-breakpoint
CREATE TRIGGER periodos_contratados_sem_delete
  BEFORE DELETE ON periodos_contratados
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao_periodo();
--> statement-breakpoint
CREATE TRIGGER periodos_contratados_sem_truncate
  BEFORE TRUNCATE ON periodos_contratados
  FOR EACH STATEMENT EXECUTE FUNCTION bloquear_alteracao_periodo();
--> statement-breakpoint
INSERT INTO configuracoes (chave, valor) VALUES ('unidade_ajustes', 'dias');
--> statement-breakpoint
INSERT INTO mensagens_prontas (nome, finalidade, texto, ativa) VALUES ('Renovação', 'renovacao', 'Oi, {nome}! Tudo bem? O período de {aluno} na Arquitetura da Dança vai até {fim}. Quer renovar para continuar dançando com a turma de {turma}?', true);
--> statement-breakpoint
INSERT INTO mensagens_prontas (nome, finalidade, texto, ativa) VALUES ('Convite para voltar', 'retorno', 'Oi, {nome}! Sentimos falta de {aluno} na pista. Que tal voltar para a turma de {turma}? Estamos te esperando.', true);
