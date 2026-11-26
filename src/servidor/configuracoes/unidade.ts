import { eq } from "drizzle-orm";
import type { Banco } from "../banco/cliente";
import { configuracoes } from "../banco/esquema";
import { executarTraduzindo } from "../cadastros/comum";
import type { Resultado } from "../cadastros/resultado";

const CHAVE = "unidade_ajustes";

/** Unidade padrão dos ajustes; sem linha (ou valor estranho), `dias`. */
export async function obterUnidadeAjustes(
  db: Banco,
): Promise<"dias" | "aulas"> {
  const [linha] = await db
    .select({ valor: configuracoes.valor })
    .from(configuracoes)
    .where(eq(configuracoes.chave, CHAVE));
  return linha?.valor === "aulas" ? "aulas" : "dias";
}

export async function salvarUnidadeAjustes(
  db: Banco,
  unidade: string,
): Promise<Resultado<null>> {
  if (unidade !== "dias" && unidade !== "aulas") {
    return { ok: false, erros: { unidade: "Escolha dias ou aulas." } };
  }
  return executarTraduzindo(async () => {
    await db
      .insert(configuracoes)
      .values({ chave: CHAVE, valor: unidade })
      .onConflictDoUpdate({
        target: configuracoes.chave,
        set: { valor: unidade },
      });
    return { ok: true as const, valor: null };
  }, {});
}
