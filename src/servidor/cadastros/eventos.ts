import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Banco } from "../banco/cliente";
import { eventos, imagens } from "../banco/esquema";
import { ErroCapa, gravarCapa, processarCapa } from "../imagens/capa";
import { eventoJaPassou } from "../vitrine/eventos";
import {
  dataHoraLocalParaInstante,
  gerarSlug,
  instanteParaDataHoraLocal,
} from "../vitrine/texto";
import { ehUuid, executarTraduzindo } from "./comum";
import { errosDeZod, type Resultado } from "./resultado";

const MENSAGEM_SLUG_EM_USO = "Esse endereço já está em uso.";
const MENSAGEM_FIM = "O fim precisa ser depois do início.";
const MENSAGEM_LINK = "Use um link completo, começando com https://.";
const MENSAGEM_NAO_ENCONTRADO = "Evento não encontrado.";

const ERROS_BANCO = {
  eventos_slug_unique: { campo: "slug", mensagem: MENSAGEM_SLUG_EM_USO },
  eventos_slug_valido: {
    campo: "slug",
    mensagem: "Informe um endereço com letras ou números.",
  },
  eventos_fim_depois_do_inicio: { campo: "fim", mensagem: MENSAGEM_FIM },
  eventos_link_ingresso_valido: {
    campo: "linkIngresso",
    mensagem: MENSAGEM_LINK,
  },
};

const esquema = z.object({
  id: z.string().optional(),
  titulo: z.string().trim().min(1, "Informe o título."),
  slug: z.string().optional(),
  local: z.string().optional(),
  descricao: z.string().optional(),
  preco: z.string().optional(),
  linkIngresso: z.string().optional(),
  publicado: z.boolean(),
  esgotado: z.boolean(),
});

export type DadosEvento = {
  id?: string;
  titulo: string;
  slug?: string;
  /** Formato do `<input type="datetime-local">`, horário de São Paulo. */
  inicio: string;
  fim?: string;
  local?: string;
  descricao?: string;
  preco?: string;
  linkIngresso?: string;
  publicado: boolean;
  esgotado: boolean;
  capa?: { bytes: Uint8Array; tipo: string } | null;
  removerCapa?: boolean;
};

/** Texto sem espaços nas pontas; vazio vira `null`. */
function opcional(valor: string | undefined): string | null {
  return valor?.trim() || null;
}

/** Instante de um valor `datetime-local`, ou `null` se não for uma data e hora reais. */
function lerDataHora(valor: string | undefined): Date | null {
  const texto = valor?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(texto)) return null;
  const instante = dataHoraLocalParaInstante(texto);
  // Recusa dias que não existem (ex.: 31 de fevereiro), que o JavaScript "corrigiria".
  return instanteParaDataHoraLocal(instante) === texto ? instante : null;
}

function linkIngressoValido(link: string): boolean {
  if (!link.startsWith("https://") || /\s/.test(link)) return false;
  try {
    return new URL(link).hostname.length > 0;
  } catch {
    return false;
  }
}

/** Eventos para a lista do painel: próximos primeiro (por início), depois os passados (do mais recente). */
export async function listarEventosPainel(db: Banco, agora: Date) {
  const linhas = await db
    .select({
      id: eventos.id,
      titulo: eventos.titulo,
      slug: eventos.slug,
      inicio: eventos.inicio,
      fim: eventos.fim,
      publicado: eventos.publicado,
      esgotado: eventos.esgotado,
    })
    .from(eventos)
    .orderBy(asc(eventos.inicio), asc(eventos.id));
  const todos = linhas.map((e) => ({
    ...e,
    passou: eventoJaPassou(e, agora),
  }));
  return [
    ...todos.filter((e) => !e.passou),
    ...todos.filter((e) => e.passou).reverse(),
  ];
}

/** O evento para o formulário, ou `null`. `slugEditavel`: ainda nunca foi publicado. */
export async function obterEventoPainel(db: Banco, id: string) {
  if (!ehUuid(id)) return null;
  const [evento] = await db.select().from(eventos).where(eq(eventos.id, id));
  if (!evento) return null;
  return { ...evento, slugEditavel: evento.primeiraPublicacaoEm === null };
}

/**
 * Cria ou atualiza (se vier `id`) um evento. A capa é processada antes da
 * transação (o `sharp` é lento); depois, a imagem nova, a atualização do
 * evento e a exclusão da imagem antiga acontecem juntas. Depois da primeira
 * publicação o slug enviado é ignorado.
 */
export async function salvarEvento(
  db: Banco,
  dados: DadosEvento,
): Promise<Resultado<{ id: string }>> {
  const analise = esquema.safeParse(dados);
  const erros = analise.success ? {} : errosDeZod(analise.error);

  const inicio = lerDataHora(dados.inicio);
  if (!inicio) erros.inicio = "Informe a data e a hora de início.";
  let fim: Date | null = null;
  if (opcional(dados.fim)) {
    fim = lerDataHora(dados.fim);
    if (!fim) erros.fim = "Informe a data e a hora do fim.";
    else if (inicio && fim.getTime() <= inicio.getTime())
      erros.fim = MENSAGEM_FIM;
  }
  const link = opcional(dados.linkIngresso);
  if (link && !linkIngressoValido(link)) erros.linkIngresso = MENSAGEM_LINK;

  let capaProcessada: Awaited<ReturnType<typeof processarCapa>> | null = null;
  if (dados.capa) {
    try {
      capaProcessada = await processarCapa(dados.capa);
    } catch (erro) {
      if (!(erro instanceof ErroCapa)) throw erro;
      erros.capa = erro.message;
    }
  }

  if (!analise.success || Object.keys(erros).length > 0 || !inicio) {
    return { ok: false, erros };
  }

  const { id, titulo, publicado, esgotado } = analise.data;
  const slugDigitado = gerarSlug(analise.data.slug?.trim() || titulo);
  const valores = {
    titulo,
    inicio,
    fim,
    local: opcional(dados.local),
    // Mantém as quebras de linha; só tira o excesso das pontas.
    descricao: opcional(dados.descricao),
    preco: opcional(dados.preco),
    linkIngresso: link,
    publicado,
    esgotado,
  };

  return executarTraduzindo(
    () =>
      db.transaction(async (tx): Promise<Resultado<{ id: string }>> => {
        const novaCapaId = capaProcessada
          ? await gravarCapa(tx as unknown as Banco, capaProcessada)
          : null;

        if (!id) {
          if (!slugDigitado) {
            return {
              ok: false as const,
              erros: { slug: "Informe um endereço com letras ou números." },
            };
          }
          const [linha] = await tx
            .insert(eventos)
            .values({
              ...valores,
              slug: slugDigitado,
              capaId: novaCapaId,
              primeiraPublicacaoEm: publicado ? new Date() : null,
            })
            .returning({ id: eventos.id });
          return { ok: true as const, valor: { id: linha.id } };
        }

        if (!ehUuid(id)) {
          return { ok: false as const, erros: { _: MENSAGEM_NAO_ENCONTRADO } };
        }
        const [atual] = await tx
          .select({
            capaId: eventos.capaId,
            primeiraPublicacaoEm: eventos.primeiraPublicacaoEm,
          })
          .from(eventos)
          .where(eq(eventos.id, id))
          .for("update");
        if (!atual) {
          return { ok: false as const, erros: { _: MENSAGEM_NAO_ENCONTRADO } };
        }
        const slugFixo = atual.primeiraPublicacaoEm !== null;
        if (!slugFixo && !slugDigitado) {
          return {
            ok: false as const,
            erros: { slug: "Informe um endereço com letras ou números." },
          };
        }
        const capaId = novaCapaId ?? (dados.removerCapa ? null : atual.capaId);
        await tx
          .update(eventos)
          .set({
            ...valores,
            ...(slugFixo ? {} : { slug: slugDigitado }),
            capaId,
            primeiraPublicacaoEm:
              atual.primeiraPublicacaoEm ?? (publicado ? new Date() : null),
          })
          .where(eq(eventos.id, id));
        if (atual.capaId && atual.capaId !== capaId) {
          await tx.delete(imagens).where(eq(imagens.id, atual.capaId));
        }
        return { ok: true as const, valor: { id } };
      }),
    ERROS_BANCO,
  );
}

/** Inverte "esgotado" numa só instrução e devolve o novo valor. */
export async function alternarEsgotado(
  db: Banco,
  id: string,
): Promise<Resultado<{ esgotado: boolean }>> {
  if (!ehUuid(id)) return { ok: false, erros: { _: MENSAGEM_NAO_ENCONTRADO } };
  const [linha] = await db
    .update(eventos)
    .set({ esgotado: sql`not ${eventos.esgotado}` })
    .where(eq(eventos.id, id))
    .returning({ esgotado: eventos.esgotado });
  if (!linha) return { ok: false, erros: { _: MENSAGEM_NAO_ENCONTRADO } };
  return { ok: true, valor: { esgotado: linha.esgotado } };
}

/** Exclui um rascunho e a capa dele. Evento publicado precisa voltar a rascunho antes. */
export async function excluirEvento(
  db: Banco,
  id: string,
): Promise<Resultado<null>> {
  if (!ehUuid(id)) return { ok: false, erros: { _: MENSAGEM_NAO_ENCONTRADO } };
  return db.transaction(async (tx): Promise<Resultado<null>> => {
    const [evento] = await tx
      .select({ publicado: eventos.publicado, capaId: eventos.capaId })
      .from(eventos)
      .where(eq(eventos.id, id))
      .for("update");
    if (!evento) return { ok: false, erros: { _: MENSAGEM_NAO_ENCONTRADO } };
    if (evento.publicado) {
      return {
        ok: false,
        erros: { _: "Volte o evento para rascunho antes de excluir." },
      };
    }
    await tx
      .delete(eventos)
      .where(and(eq(eventos.id, id), eq(eventos.publicado, false)));
    if (evento.capaId) {
      await tx.delete(imagens).where(eq(imagens.id, evento.capaId));
    }
    return { ok: true, valor: null };
  });
}
