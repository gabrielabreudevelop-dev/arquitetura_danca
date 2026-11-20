CREATE TYPE "public"."status_video" AS ENUM('rascunho', 'publicado');--> statement-breakpoint
CREATE TABLE "eventos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titulo" text NOT NULL,
	"slug" text NOT NULL,
	"descricao" text,
	"local" text,
	"inicio" timestamp with time zone NOT NULL,
	"fim" timestamp with time zone,
	"capa_url" text,
	"publicado" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eventos_slug_unique" UNIQUE("slug"),
	CONSTRAINT "eventos_slug_valido" CHECK ("eventos"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "eventos_fim_depois_do_inicio" CHECK ("eventos"."fim" is null or "eventos"."fim" > "eventos"."inicio")
);
--> statement-breakpoint
CREATE TABLE "presencas" (
	"evento_id" uuid NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "presencas_evento_id_pessoa_id_pk" PRIMARY KEY("evento_id","pessoa_id")
);
--> statement-breakpoint
CREATE TABLE "concessoes_acesso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid,
	"ritmo_id" uuid,
	"modulo_id" uuid,
	"para_turma_id" uuid,
	"para_aluno_id" uuid,
	"para_ritmo_id" uuid,
	"para_modulo_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "concessoes_acesso_conteudo_unico" CHECK (num_nonnulls("concessoes_acesso"."video_id", "concessoes_acesso"."ritmo_id") = 1),
	CONSTRAINT "concessoes_acesso_modulo_com_ritmo" CHECK ("concessoes_acesso"."modulo_id" is null or "concessoes_acesso"."ritmo_id" is not null),
	CONSTRAINT "concessoes_acesso_destino_unico" CHECK (num_nonnulls("concessoes_acesso"."para_turma_id", "concessoes_acesso"."para_aluno_id", "concessoes_acesso"."para_ritmo_id", "concessoes_acesso"."para_modulo_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "video_pessoas" (
	"video_id" uuid NOT NULL,
	"pessoa_id" uuid NOT NULL,
	CONSTRAINT "video_pessoas_video_id_pessoa_id_pk" PRIMARY KEY("video_id","pessoa_id")
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professor_id" uuid NOT NULL,
	"ritmo_id" uuid NOT NULL,
	"modulo_id" uuid NOT NULL,
	"titulo" text NOT NULL,
	"descricao" text,
	"ordem" integer DEFAULT 0 NOT NULL,
	"bunny_video_id" text,
	"status" "status_video" DEFAULT 'rascunho' NOT NULL,
	"autorizacao_imagem_confirmada_por" uuid,
	"autorizacao_imagem_confirmada_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "videos_bunny_video_id_unique" UNIQUE("bunny_video_id"),
	CONSTRAINT "videos_publicacao_completa" CHECK ("videos"."status" <> 'publicado' or ("videos"."bunny_video_id" is not null and "videos"."autorizacao_imagem_confirmada_por" is not null and "videos"."autorizacao_imagem_confirmada_em" is not null))
);
--> statement-breakpoint
ALTER TABLE "presencas" ADD CONSTRAINT "presencas_evento_id_eventos_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."eventos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presencas" ADD CONSTRAINT "presencas_pessoa_id_pessoas_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concessoes_acesso" ADD CONSTRAINT "concessoes_acesso_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concessoes_acesso" ADD CONSTRAINT "concessoes_acesso_ritmo_id_ritmos_id_fk" FOREIGN KEY ("ritmo_id") REFERENCES "public"."ritmos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concessoes_acesso" ADD CONSTRAINT "concessoes_acesso_modulo_id_modulos_id_fk" FOREIGN KEY ("modulo_id") REFERENCES "public"."modulos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concessoes_acesso" ADD CONSTRAINT "concessoes_acesso_para_turma_id_turmas_id_fk" FOREIGN KEY ("para_turma_id") REFERENCES "public"."turmas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concessoes_acesso" ADD CONSTRAINT "concessoes_acesso_para_aluno_id_pessoas_id_fk" FOREIGN KEY ("para_aluno_id") REFERENCES "public"."pessoas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concessoes_acesso" ADD CONSTRAINT "concessoes_acesso_para_ritmo_id_ritmos_id_fk" FOREIGN KEY ("para_ritmo_id") REFERENCES "public"."ritmos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concessoes_acesso" ADD CONSTRAINT "concessoes_acesso_para_modulo_id_modulos_id_fk" FOREIGN KEY ("para_modulo_id") REFERENCES "public"."modulos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_pessoas" ADD CONSTRAINT "video_pessoas_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_pessoas" ADD CONSTRAINT "video_pessoas_pessoa_id_pessoas_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_professor_id_pessoas_id_fk" FOREIGN KEY ("professor_id") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_ritmo_id_ritmos_id_fk" FOREIGN KEY ("ritmo_id") REFERENCES "public"."ritmos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_modulo_id_modulos_id_fk" FOREIGN KEY ("modulo_id") REFERENCES "public"."modulos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_autorizacao_imagem_confirmada_por_pessoas_id_fk" FOREIGN KEY ("autorizacao_imagem_confirmada_por") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "eventos_inicio_idx" ON "eventos" USING btree ("inicio");--> statement-breakpoint
CREATE INDEX "concessoes_acesso_aluno_idx" ON "concessoes_acesso" USING btree ("para_aluno_id");--> statement-breakpoint
CREATE INDEX "concessoes_acesso_turma_idx" ON "concessoes_acesso" USING btree ("para_turma_id");--> statement-breakpoint
CREATE INDEX "videos_ritmo_modulo_idx" ON "videos" USING btree ("ritmo_id","modulo_id");