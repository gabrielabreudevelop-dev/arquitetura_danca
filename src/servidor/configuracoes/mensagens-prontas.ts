import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import type { Banco } from "../banco/cliente";
import { contatos, mensagensProntas } from "../banco/esquema";
import { ehUuid, executarTraduzindo } from "../cadastros/comum";
import {
  errosDeZod,
  MENSAGEM_EM_USO,
  type Resultado,
} from "../cadastros/resultado";
import { validarTextoMensagem } from "../contatos/mensagens";

const ERROS_BANCO = {
  mensagens_prontas_nome_unico: {
    campo: "nome",
    mensagem: "Já existe uma mensagem com esse nome.",
  },
  // Duas ativações ao mesmo tempo: a segunda esbarra no índice único.
  mensagens_prontas_ativa_unica: {
    campo: "_",
    mensagem:
      "Outra mensagem desta finalidade acabou de ser ativada. Confira a lista e tente de novo.",
  },
};

const esquema = z.object({
  id: z.string().optional(),
  nome: z.string().trim().min(1, "Informe o nome."),
  finalidade: z.enum(["renovacao", "retorno"], {
    error: "Escolha a finalidade.",
  }),
  texto: z.string(),
  ativa: z.boolean(),
});

export type DadosMensagem = {
  id?: string;
  nome: string;
  finalidade: string;
  texto: string;
  ativa: boolean;
};

export type Finalidade = "renovacao" | "retorno";

export async function listarMensagens(db: Banco) {
  return db
    .select()
    .from(mensagensProntas)
    .orderBy(asc(mensagensProntas.finalidade), asc(mensagensProntas.nome));
}

export async function obterMensagem(db: Banco, id: string) {
  if (!ehUuid(id)) return null;
  const [linha] = await db
    .select()
    .from(mensagensProntas)
    .where(eq(mensagensProntas.id, id));
  return linha ?? null;
}

/**
 * Cria ou atualiza. Ativar uma mensagem desativa, na mesma transação, a outra
 * ativa da mesma finalidade (o banco só admite uma).
 */
export async function salvarMensagem(
  db: Banco,
  dados: DadosMensagem,
): Promise<Resultado<{ id: string }>> {
  const analise = esquema.safeParse(dados);
  const erros = analise.success ? {} : errosDeZod(analise.error);
  const erroTexto = validarTextoMensagem(dados.texto);
  if (erroTexto) erros.texto = erroTexto;
  if (!analise.success || erroTexto) return { ok: false, erros };
  const { id, nome, finalidade, texto, ativa } = analise.data;
  if (id !== undefined && !ehUuid(id)) {
    return { ok: false, erros: { _: "Mensagem não encontrada." } };
  }
  return executarTraduzindo(
    () =>
      db.transaction(async (tx): Promise<Resultado<{ id: string }>> => {
        if (id) {
          const [existe] = await tx
            .select({ id: mensagensProntas.id })
            .from(mensagensProntas)
            .where(eq(mensagensProntas.id, id))
            .for("update");
          if (!existe) {
            return { ok: false, erros: { _: "Mensagem não encontrada." } };
          }
        }
        if (ativa) {
          await tx
            .update(mensagensProntas)
            .set({ ativa: false })
            .where(
              and(
                eq(mensagensProntas.finalidade, finalidade),
                eq(mensagensProntas.ativa, true),
                id ? ne(mensagensProntas.id, id) : undefined,
              ),
            );
        }
        if (id) {
          const [linha] = await tx
            .update(mensagensProntas)
            .set({ nome, finalidade, texto, ativa })
            .where(eq(mensagensProntas.id, id))
            .returning({ id: mensagensProntas.id });
          if (!linha) {
            return { ok: false, erros: { _: "Mensagem não encontrada." } };
          }
          return { ok: true, valor: { id: linha.id } };
        }
        const [linha] = await tx
          .insert(mensagensProntas)
          .values({ nome, finalidade, texto, ativa })
          .returning({ id: mensagensProntas.id });
        return { ok: true, valor: { id: linha.id } };
      }),
    ERROS_BANCO,
  );
}

/** A mensagem ativa da finalidade, ou `null` se nenhuma estiver ativa. */
export async function mensagemAtiva(
  db: Banco,
  finalidade: Finalidade,
): Promise<{ id: string; texto: string } | null> {
  const [linha] = await db
    .select({ id: mensagensProntas.id, texto: mensagensProntas.texto })
    .from(mensagensProntas)
    .where(
      and(
        eq(mensagensProntas.finalidade, finalidade),
        eq(mensagensProntas.ativa, true),
      ),
    );
  return linha ?? null;
}

/** Só exclui mensagem que nunca foi usada num contato; senão, `MENSAGEM_EM_USO`. */
export async function excluirMensagem(
  db: Banco,
  id: string,
): Promise<Resultado<null>> {
  if (!ehUuid(id)) {
    return { ok: false, erros: { _: "Mensagem não encontrada." } };
  }
  return executarTraduzindo(
    () =>
      db.transaction(async (tx): Promise<Resultado<null>> => {
        const [uso] = await tx
          .select({ id: contatos.id })
          .from(contatos)
          .where(eq(contatos.mensagemId, id))
          .limit(1);
        if (uso) return { ok: false, erros: { _: MENSAGEM_EM_USO } };
        await tx.delete(mensagensProntas).where(eq(mensagensProntas.id, id));
        return { ok: true, valor: null };
      }),
    {},
  );
}
