CREATE TYPE "public"."acao_consentimento" AS ENUM('aceite', 'cancelamento');--> statement-breakpoint
CREATE TYPE "public"."canal_consentimento" AS ENUM('whatsapp', 'email', 'plataforma');--> statement-breakpoint
CREATE TYPE "public"."origem_consentimento" AS ENUM('formulario_ativacao', 'pagina_preferencias', 'mensagem_whatsapp', 'pagina_evento');--> statement-breakpoint
CREATE TABLE "registros_consentimento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo_id" uuid NOT NULL,
	"texto_id" uuid NOT NULL,
	"titular_id" uuid NOT NULL,
	"concedente_id" uuid NOT NULL,
	"acao" "acao_consentimento" NOT NULL,
	"canal" "canal_consentimento" NOT NULL,
	"contato" text,
	"origem" "origem_consentimento" NOT NULL,
	"ip" "inet",
	"navegador" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "textos_consentimento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo_id" uuid NOT NULL,
	"versao" integer NOT NULL,
	"texto" text NOT NULL,
	"vigente_desde" timestamp with time zone NOT NULL,
	CONSTRAINT "textos_consentimento_tipo_versao_unico" UNIQUE("tipo_id","versao"),
	CONSTRAINT "textos_consentimento_id_tipo_unico" UNIQUE("id","tipo_id")
);
--> statement-breakpoint
CREATE TABLE "tipos_consentimento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chave" text NOT NULL,
	"nome" text NOT NULL,
	"obrigatorio" boolean DEFAULT false NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tipos_consentimento_chave_unique" UNIQUE("chave")
);
--> statement-breakpoint
ALTER TABLE "registros_consentimento" ADD CONSTRAINT "registros_consentimento_tipo_id_tipos_consentimento_id_fk" FOREIGN KEY ("tipo_id") REFERENCES "public"."tipos_consentimento"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registros_consentimento" ADD CONSTRAINT "registros_consentimento_titular_id_pessoas_id_fk" FOREIGN KEY ("titular_id") REFERENCES "public"."pessoas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registros_consentimento" ADD CONSTRAINT "registros_consentimento_concedente_id_pessoas_id_fk" FOREIGN KEY ("concedente_id") REFERENCES "public"."pessoas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registros_consentimento" ADD CONSTRAINT "registros_consentimento_texto_tipo_fk" FOREIGN KEY ("texto_id","tipo_id") REFERENCES "public"."textos_consentimento"("id","tipo_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "textos_consentimento" ADD CONSTRAINT "textos_consentimento_tipo_id_tipos_consentimento_id_fk" FOREIGN KEY ("tipo_id") REFERENCES "public"."tipos_consentimento"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "registros_consentimento_titular_tipo_data" ON "registros_consentimento" USING btree ("titular_id","tipo_id","criado_em" DESC NULLS LAST);