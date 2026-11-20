import { and, asc, count, eq } from "drizzle-orm";
import { z } from "zod";
import type { Banco } from "../banco/cliente";
import { ritmos, turmas } from "../banco/esquema";
import { gerarSlug } from "../vitrine/texto";
import { executarTraduzindo, ordemSchema } from "./comum";
import { errosDeZod, type Resultado } from "./resultado";

const ERROS_BANCO = {
  ritmos_nome_unico: {
    campo: "nome",
    mensagem: "Já existe um ritmo com esse nome.",
  },
  ritmos_slug_unico: {
    campo: "slug",
    mensagem: "Esse endereço já está em uso.",
  },
};

const esquema = z.object({
  id: z.string().optional(),
  nome: z.string().trim().min(1, "Informe o nome."),
  slug: z.string().optional(),
  ordem: ordemSchema,
  ativo: z.boolean(),
});

export type DadosRitmo = {
  id?: string;
  nome: string;
  slug?: string;
  ordem: number | string;
  ativo: boolean;
};

/** Ritmos por `ordem` e depois por nome, com a contagem de turmas ativas de cada um. */
export async function listarRitmos(db: Banco) {
  return db
    .select({
      id: ritmos.id,
      nome: ritmos.nome,
      slug: ritmos.slug,
      ordem: ritmos.ordem,
      ativo: ritmos.ativo,
      turmasAtivas: count(turmas.id),
    })
    .from(ritmos)
    .leftJoin(
      turmas,
      and(eq(turmas.ritmoId, ritmos.id), eq(turmas.ativa, true)),
    )
    .groupBy(ritmos.id)
    .orderBy(asc(ritmos.ordem), asc(ritmos.nome));
}

/** Cria ou atualiza (se vier `id`). Slug vazio vira o slug do nome. */
export async function salvarRitmo(
  db: Banco,
  dados: DadosRitmo,
): Promise<Resultado<{ id: string }>> {
  const analise = esquema.safeParse(dados);
  if (!analise.success) return { ok: false, erros: errosDeZod(analise.error) };
  const { id, nome, ordem, ativo } = analise.data;
  const slug = gerarSlug(analise.data.slug?.trim() || nome);
  if (!slug) {
    return {
      ok: false,
      erros: { slug: "Informe um endereço com letras ou números." },
    };
  }
  return executarTraduzindo(async () => {
    if (id) {
      const [linha] = await db
        .update(ritmos)
        .set({ nome, slug, ordem, ativo })
        .where(eq(ritmos.id, id))
        .returning({ id: ritmos.id });
      if (!linha) return { ok: false, erros: { _: "Ritmo não encontrado." } };
      return { ok: true, valor: { id: linha.id } };
    }
    const [linha] = await db
      .insert(ritmos)
      .values({ nome, slug, ordem, ativo })
      .returning({ id: ritmos.id });
    return { ok: true, valor: { id: linha.id } };
  }, ERROS_BANCO);
}

/** Exclui um ritmo. Com turmas ligadas, o banco recusa e voltamos "Está em uso…". */
export async function excluirRitmo(
  db: Banco,
  id: string,
): Promise<Resultado<null>> {
  return executarTraduzindo(async () => {
    await db.delete(ritmos).where(eq(ritmos.id, id));
    return { ok: true, valor: null };
  }, {});
}
