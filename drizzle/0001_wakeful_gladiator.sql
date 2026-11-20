CREATE TYPE "public"."papel" AS ENUM('administracao', 'atendente', 'professor', 'aluno', 'responsavel');--> statement-breakpoint
CREATE TABLE "extensoes_periodo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"periodo_id" uuid NOT NULL,
	"dias" integer NOT NULL,
	"motivo" text NOT NULL,
	"criado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "extensoes_periodo_dias_positivo" CHECK ("extensoes_periodo"."dias" > 0),
	CONSTRAINT "extensoes_periodo_motivo_preenchido" CHECK (length(trim("extensoes_periodo"."motivo")) > 0)
);
--> statement-breakpoint
CREATE TABLE "periodos_contratados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aluno_id" uuid NOT NULL,
	"inicio" date NOT NULL,
	"fim" date NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "periodos_contratados_fim_apos_inicio" CHECK ("periodos_contratados"."fim" >= "periodos_contratados"."inicio")
);
--> statement-breakpoint
CREATE TABLE "pessoa_papeis" (
	"pessoa_id" uuid NOT NULL,
	"papel" "papel" NOT NULL,
	CONSTRAINT "pessoa_papeis_pessoa_id_papel_pk" PRIMARY KEY("pessoa_id","papel")
);
--> statement-breakpoint
CREATE TABLE "pessoas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"email" text,
	"whatsapp" text,
	"data_nascimento" date,
	"usuario_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pessoas_usuario_id_unique" UNIQUE("usuario_id")
);
--> statement-breakpoint
CREATE TABLE "responsabilidades" (
	"responsavel_id" uuid NOT NULL,
	"aluno_id" uuid NOT NULL,
	CONSTRAINT "responsabilidades_responsavel_id_aluno_id_pk" PRIMARY KEY("responsavel_id","aluno_id"),
	CONSTRAINT "responsabilidades_responsavel_diferente_do_aluno" CHECK ("responsabilidades"."responsavel_id" <> "responsabilidades"."aluno_id")
);
--> statement-breakpoint
ALTER TABLE "extensoes_periodo" ADD CONSTRAINT "extensoes_periodo_periodo_id_periodos_contratados_id_fk" FOREIGN KEY ("periodo_id") REFERENCES "public"."periodos_contratados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extensoes_periodo" ADD CONSTRAINT "extensoes_periodo_criado_por_pessoas_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "periodos_contratados" ADD CONSTRAINT "periodos_contratados_aluno_id_pessoas_id_fk" FOREIGN KEY ("aluno_id") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pessoa_papeis" ADD CONSTRAINT "pessoa_papeis_pessoa_id_pessoas_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responsabilidades" ADD CONSTRAINT "responsabilidades_responsavel_id_pessoas_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responsabilidades" ADD CONSTRAINT "responsabilidades_aluno_id_pessoas_id_fk" FOREIGN KEY ("aluno_id") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pessoas_email_unico" ON "pessoas" USING btree (lower("email")) WHERE "pessoas"."email" is not null;