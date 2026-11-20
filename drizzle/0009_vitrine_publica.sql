CREATE TABLE "imagens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dados" "bytea" NOT NULL,
	"tipo" text NOT NULL,
	"largura" integer NOT NULL,
	"altura" integer NOT NULL,
	"tamanho" integer NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ritmos" ADD COLUMN "slug" text;--> statement-breakpoint
UPDATE "ritmos" SET "slug" = 'ritmo-' || left("id"::text, 8);--> statement-breakpoint
ALTER TABLE "ritmos" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ritmos" ADD COLUMN "ordem" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "eventos" ADD COLUMN "preco" text;--> statement-breakpoint
ALTER TABLE "eventos" ADD COLUMN "link_ingresso" text;--> statement-breakpoint
ALTER TABLE "eventos" ADD COLUMN "esgotado" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "eventos" ADD COLUMN "capa_id" uuid;--> statement-breakpoint
ALTER TABLE "eventos" ADD COLUMN "primeira_publicacao_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pessoa_papeis" ADD COLUMN "ativo" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_capa_id_imagens_id_fk" FOREIGN KEY ("capa_id") REFERENCES "public"."imagens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ritmos_slug_unico" ON "ritmos" USING btree ("slug");--> statement-breakpoint
UPDATE "eventos" SET "primeira_publicacao_em" = "criado_em" WHERE "publicado";--> statement-breakpoint
ALTER TABLE "eventos" DROP COLUMN "capa_url";--> statement-breakpoint
ALTER TABLE "ritmos" ADD CONSTRAINT "ritmos_slug_valido" CHECK ("ritmos"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_link_ingresso_valido" CHECK ("eventos"."link_ingresso" is null or "eventos"."link_ingresso" like 'https://%');