CREATE TABLE "matriculas" (
	"aluno_id" uuid NOT NULL,
	"turma_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matriculas_aluno_id_turma_id_pk" PRIMARY KEY("aluno_id","turma_id")
);
--> statement-breakpoint
CREATE TABLE "modulos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"ordem" integer NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ritmos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "turma_dias" (
	"turma_id" uuid NOT NULL,
	"dia_semana" smallint NOT NULL,
	CONSTRAINT "turma_dias_turma_id_dia_semana_pk" PRIMARY KEY("turma_id","dia_semana"),
	CONSTRAINT "turma_dias_dia_valido" CHECK ("turma_dias"."dia_semana" between 0 and 6)
);
--> statement-breakpoint
CREATE TABLE "turmas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ritmo_id" uuid NOT NULL,
	"modulo_id" uuid NOT NULL,
	"professor_id" uuid NOT NULL,
	"horario_inicio" time NOT NULL,
	"horario_fim" time NOT NULL,
	"link_grupo_whatsapp" text,
	"ativa" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "turmas_horario_valido" CHECK ("turmas"."horario_fim" > "turmas"."horario_inicio"),
	CONSTRAINT "turmas_link_whatsapp_valido" CHECK ("turmas"."link_grupo_whatsapp" is null or "turmas"."link_grupo_whatsapp" like 'https://chat.whatsapp.com/%')
);
--> statement-breakpoint
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_aluno_id_pessoas_id_fk" FOREIGN KEY ("aluno_id") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_turma_id_turmas_id_fk" FOREIGN KEY ("turma_id") REFERENCES "public"."turmas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turma_dias" ADD CONSTRAINT "turma_dias_turma_id_turmas_id_fk" FOREIGN KEY ("turma_id") REFERENCES "public"."turmas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_ritmo_id_ritmos_id_fk" FOREIGN KEY ("ritmo_id") REFERENCES "public"."ritmos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_modulo_id_modulos_id_fk" FOREIGN KEY ("modulo_id") REFERENCES "public"."modulos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_professor_id_pessoas_id_fk" FOREIGN KEY ("professor_id") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matriculas_turma_idx" ON "matriculas" USING btree ("turma_id");--> statement-breakpoint
CREATE UNIQUE INDEX "modulos_nome_unico" ON "modulos" USING btree (lower("nome"));--> statement-breakpoint
CREATE UNIQUE INDEX "ritmos_nome_unico" ON "ritmos" USING btree (lower("nome"));--> statement-breakpoint
CREATE INDEX "turmas_ritmo_idx" ON "turmas" USING btree ("ritmo_id");--> statement-breakpoint
CREATE INDEX "turmas_professor_idx" ON "turmas" USING btree ("professor_id");