CREATE TYPE "public"."preferencia_par" AS ENUM('os_dois', 'conduzir', 'ser_conduzido');--> statement-breakpoint
CREATE TYPE "public"."situacao_aula" AS ENUM('realizada', 'nao_houve');--> statement-breakpoint
CREATE TYPE "public"."tipo_situacao_bolsista" AS ENUM('ativacao', 'inativacao');--> statement-breakpoint
-- O tipo é recriado (e não ampliado com ADD VALUE) porque a semente abaixo usa o
-- valor novo na mesma rodada de migrações, que roda numa transação só.
CREATE TYPE "public"."finalidade_mensagem_nova" AS ENUM('renovacao', 'retorno', 'bolsista');--> statement-breakpoint
ALTER TABLE "mensagens_prontas" ALTER COLUMN "finalidade" TYPE "public"."finalidade_mensagem_nova" USING "finalidade"::text::"public"."finalidade_mensagem_nova";--> statement-breakpoint
DROP TYPE "public"."finalidade_mensagem";--> statement-breakpoint
ALTER TYPE "public"."finalidade_mensagem_nova" RENAME TO "finalidade_mensagem";--> statement-breakpoint
ALTER TYPE "public"."lista_contato" ADD VALUE 'bolsista_ausente';--> statement-breakpoint
ALTER TYPE "public"."lista_contato" ADD VALUE 'ficha_bolsista';--> statement-breakpoint
ALTER TYPE "public"."resultado_contato" ADD VALUE 'vai_voltar';--> statement-breakpoint
ALTER TYPE "public"."papel" ADD VALUE 'bolsista';--> statement-breakpoint
CREATE TABLE "acordos_bolsista" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"dias" smallint[] NOT NULL,
	"vigente_desde" date NOT NULL,
	"criado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "acordos_bolsista_dias_validos" CHECK (cardinality("acordos_bolsista"."dias") >= 1 and "acordos_bolsista"."dias" <@ array[0,1,2,3,4,5,6]::smallint[])
);
--> statement-breakpoint
CREATE TABLE "aulas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"turma_id" uuid NOT NULL,
	"data" date NOT NULL,
	"situacao" "situacao_aula" NOT NULL,
	"motivo" text,
	"versao" integer DEFAULT 1 NOT NULL,
	"criado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"alterado_por" uuid,
	"alterado_em" timestamp with time zone,
	CONSTRAINT "aulas_motivo_quando_nao_houve" CHECK ("aulas"."situacao" <> 'nao_houve' or ("aulas"."motivo" is not null and length(trim("aulas"."motivo")) > 0))
);
--> statement-breakpoint
CREATE TABLE "bolsistas" (
	"pessoa_id" uuid PRIMARY KEY NOT NULL,
	"preferencia" "preferencia_par" DEFAULT 'os_dois' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presencas_aula" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aula_id" uuid NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"marcada_por" uuid NOT NULL,
	"marcada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"desmarcada_por" uuid,
	"desmarcada_em" timestamp with time zone,
	CONSTRAINT "presencas_aula_desmarcada_completa" CHECK (("presencas_aula"."desmarcada_em" is null) = ("presencas_aula"."desmarcada_por" is null))
);
--> statement-breakpoint
CREATE TABLE "situacoes_bolsista" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"tipo" "tipo_situacao_bolsista" NOT NULL,
	"data" date NOT NULL,
	"motivo" text,
	"criado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "acordos_bolsista" ADD CONSTRAINT "acordos_bolsista_pessoa_id_bolsistas_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."bolsistas"("pessoa_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acordos_bolsista" ADD CONSTRAINT "acordos_bolsista_criado_por_pessoas_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aulas" ADD CONSTRAINT "aulas_turma_id_turmas_id_fk" FOREIGN KEY ("turma_id") REFERENCES "public"."turmas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aulas" ADD CONSTRAINT "aulas_criado_por_pessoas_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aulas" ADD CONSTRAINT "aulas_alterado_por_pessoas_id_fk" FOREIGN KEY ("alterado_por") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bolsistas" ADD CONSTRAINT "bolsistas_pessoa_id_pessoas_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presencas_aula" ADD CONSTRAINT "presencas_aula_aula_id_aulas_id_fk" FOREIGN KEY ("aula_id") REFERENCES "public"."aulas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presencas_aula" ADD CONSTRAINT "presencas_aula_pessoa_id_pessoas_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presencas_aula" ADD CONSTRAINT "presencas_aula_marcada_por_pessoas_id_fk" FOREIGN KEY ("marcada_por") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presencas_aula" ADD CONSTRAINT "presencas_aula_desmarcada_por_pessoas_id_fk" FOREIGN KEY ("desmarcada_por") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "situacoes_bolsista" ADD CONSTRAINT "situacoes_bolsista_pessoa_id_bolsistas_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."bolsistas"("pessoa_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "situacoes_bolsista" ADD CONSTRAINT "situacoes_bolsista_criado_por_pessoas_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acordos_bolsista_pessoa_vigencia_idx" ON "acordos_bolsista" USING btree ("pessoa_id","vigente_desde");--> statement-breakpoint
CREATE UNIQUE INDEX "aulas_turma_data_unica" ON "aulas" USING btree ("turma_id","data");--> statement-breakpoint
CREATE UNIQUE INDEX "presencas_aula_viva_unica" ON "presencas_aula" USING btree ("aula_id","pessoa_id") WHERE "presencas_aula"."desmarcada_em" is null;--> statement-breakpoint
CREATE INDEX "situacoes_bolsista_pessoa_data_idx" ON "situacoes_bolsista" USING btree ("pessoa_id","data");--> statement-breakpoint
INSERT INTO mensagens_prontas (nome, finalidade, texto, ativa) VALUES ('Bolsista sem vir', 'bolsista', 'Oi, {nome}! Sentimos sua falta nas aulas de {dias}. Tudo bem por aí?', true);
