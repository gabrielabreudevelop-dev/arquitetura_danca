ALTER TABLE "aulas" ADD COLUMN "chamada_salva_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "aulas" ADD COLUMN "chamada_salva_por" uuid;--> statement-breakpoint
ALTER TABLE "aulas" ADD CONSTRAINT "aulas_chamada_salva_por_pessoas_id_fk" FOREIGN KEY ("chamada_salva_por") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Até aqui toda aula realizada veio de salvarChamada (exceto "não houve" desfeito): fica com chamada salva.
UPDATE "aulas" SET "chamada_salva_em" = coalesce("alterado_em", "criado_em"), "chamada_salva_por" = coalesce("alterado_por", "criado_por") WHERE "situacao" = 'realizada';--> statement-breakpoint
ALTER TABLE "aulas" ADD CONSTRAINT "aulas_chamada_salva_completa" CHECK (("aulas"."chamada_salva_em" is null) = ("aulas"."chamada_salva_por" is null));