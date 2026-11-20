import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Banco } from "../banco/cliente";
import { modulos } from "../banco/esquema";
import { executarTraduzindo, ordemSchema } from "./comum";
import { errosDeZod, type Resultado } from "./resultado";

const ERROS_BANCO = {
  modulos_nome_unico: {
    campo: "nome",
    mensagem: "Já existe um módulo com esse nome.",
  },
};

const esquema = z.object({
  id: z.string().optional(),
  nome: z.string().trim().min(1, "Informe o nome."),
  ordem: ordemSchema,
  ativo: z.boolean(),
});

export type DadosModulo = {
  id?: string;
  nome: string;
  ordem: number | string;
  ativo: boolean;
};

/** Módulos por `ordem` e depois por nome. */
export async function listarModulos(db: Banco) {
  return db
    .select({
      id: modulos.id,
      nome: modulos.nome,
      ordem: modulos.ordem,
      ativo: modulos.ativo,
    })
    .from(modulos)
    .orderBy(asc(modulos.ordem), asc(modulos.nome));
}

/** Cria ou atualiza (se vier `id`). */
export async function salvarModulo(
  db: Banco,
  dados: DadosModulo,
): Promise<Resultado<{ id: string }>> {
  const analise = esquema.safeParse(dados);
  if (!analise.success) return { ok: false, erros: errosDeZod(analise.error) };
  const { id, nome, ordem, ativo } = analise.data;
  return executarTraduzindo(async () => {
    if (id) {
      const [linha] = await db
        .update(modulos)
        .set({ nome, ordem, ativo })
        .where(eq(modulos.id, id))
        .returning({ id: modulos.id });
      if (!linha) return { ok: false, erros: { _: "Módulo não encontrado." } };
      return { ok: true, valor: { id: linha.id } };
    }
    const [linha] = await db
      .insert(modulos)
      .values({ nome, ordem, ativo })
      .returning({ id: modulos.id });
    return { ok: true, valor: { id: linha.id } };
  }, ERROS_BANCO);
}

/** Exclui um módulo. Com turmas ligadas, o banco recusa e voltamos "Está em uso…". */
export async function excluirModulo(
  db: Banco,
  id: string,
): Promise<Resultado<null>> {
  return executarTraduzindo(async () => {
    await db.delete(modulos).where(eq(modulos.id, id));
    return { ok: true, valor: null };
  }, {});
}
