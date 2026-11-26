import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Banco } from "../banco/cliente";
import { periodosContratados, planos } from "../banco/esquema";
import { ehUuid, executarTraduzindo, ordemSchema } from "../cadastros/comum";
import { errosDeZod, type Resultado } from "../cadastros/resultado";

const ERROS_BANCO = {
  planos_nome_unico: {
    campo: "nome",
    mensagem: "Já existe um plano com esse nome.",
  },
};

const esquema = z.object({
  id: z.string().optional(),
  nome: z.string().trim().min(1, "Informe o nome."),
  quantidade: z.preprocess(
    (valor) =>
      typeof valor === "string" && valor.trim() === "" ? Number.NaN : valor,
    z.coerce
      .number({ error: "Informe um número inteiro maior que zero." })
      .int("Informe um número inteiro maior que zero.")
      .min(1, "Informe um número inteiro maior que zero.")
      .max(9999, "Informe no máximo 9999."),
  ),
  unidade: z.enum(["meses", "dias"], { error: "Escolha meses ou dias." }),
  ordem: ordemSchema,
  ativo: z.boolean(),
});

export type DadosPlano = {
  id?: string;
  nome: string;
  quantidade: string | number;
  unidade: string;
  ordem: string | number;
  ativo: boolean;
};

/** "1 mês", "3 meses", "1 dia", "15 dias". */
export function formatarDuracao(q: number, u: "meses" | "dias"): string {
  if (u === "meses") return q === 1 ? "1 mês" : `${q} meses`;
  return q === 1 ? "1 dia" : `${q} dias`;
}

/** Planos por ordem e nome; `usado` diz se algum período já foi registrado com o plano. */
export async function listarPlanos(
  db: Banco,
  opcoes: { somenteAtivos?: boolean } = {},
) {
  return db
    .select({
      id: planos.id,
      nome: planos.nome,
      duracaoQuantidade: planos.duracaoQuantidade,
      duracaoUnidade: planos.duracaoUnidade,
      ordem: planos.ordem,
      ativo: planos.ativo,
      usado: sql<boolean>`exists (select 1 from ${periodosContratados} where ${periodosContratados.planoId} = "planos"."id")`,
    })
    .from(planos)
    .where(opcoes.somenteAtivos ? eq(planos.ativo, true) : undefined)
    .orderBy(asc(planos.ordem), asc(planos.nome));
}

export async function obterPlano(db: Banco, id: string) {
  if (!ehUuid(id)) return null;
  const [plano] = await db.select().from(planos).where(eq(planos.id, id));
  return plano ?? null;
}

/** Cria ou atualiza (se vier `id`). */
export async function salvarPlano(
  db: Banco,
  dados: DadosPlano,
): Promise<Resultado<{ id: string }>> {
  const analise = esquema.safeParse(dados);
  if (!analise.success) return { ok: false, erros: errosDeZod(analise.error) };
  const { id, nome, quantidade, unidade, ordem, ativo } = analise.data;
  if (id !== undefined && !ehUuid(id)) {
    return { ok: false, erros: { _: "Plano não encontrado." } };
  }
  const valores = {
    nome,
    duracaoQuantidade: quantidade,
    duracaoUnidade: unidade,
    ordem,
    ativo,
  };
  return executarTraduzindo(async () => {
    if (id) {
      const [linha] = await db
        .update(planos)
        .set(valores)
        .where(eq(planos.id, id))
        .returning({ id: planos.id });
      if (!linha) return { ok: false, erros: { _: "Plano não encontrado." } };
      return { ok: true, valor: { id: linha.id } };
    }
    const [linha] = await db
      .insert(planos)
      .values(valores)
      .returning({ id: planos.id });
    return { ok: true, valor: { id: linha.id } };
  }, ERROS_BANCO);
}

/** Exclui um plano nunca usado; com período ligado, o banco recusa e voltamos "em uso". */
export async function excluirPlano(
  db: Banco,
  id: string,
): Promise<Resultado<null>> {
  if (!ehUuid(id)) return { ok: false, erros: { _: "Plano não encontrado." } };
  return executarTraduzindo(async () => {
    await db.delete(planos).where(eq(planos.id, id));
    return { ok: true, valor: null };
  }, {});
}
