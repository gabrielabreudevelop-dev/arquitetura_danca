import { and, eq } from "drizzle-orm";
import sharp from "sharp";
import type { Banco } from "../banco/cliente";
import { eventos, imagens } from "../banco/esquema";
import { TAMANHO_MAXIMO_CAPA } from "./limite-capa";

/** Erro com mensagem pronta para mostrar ao usuário. */
export class ErroCapa extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroCapa";
  }
}

export { TAMANHO_MAXIMO_CAPA };

const LADO_MAXIMO = 1200;
const ALVO_BYTES = 300 * 1024;
const FORMATOS_ACEITOS = ["jpeg", "png", "webp"];
const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"];
const MENSAGEM_FORMATO = "Envie uma imagem JPEG, PNG ou WebP.";

export type CapaProcessada = {
  dados: Buffer;
  largura: number;
  altura: number;
  tamanho: number;
};

/**
 * Valida a imagem enviada e a converte em JPEG com lado maior de até 1200 px,
 * orientação aplicada e sem metadados (EXIF, GPS).
 */
export async function processarCapa(arquivo: {
  bytes: Uint8Array;
  tipo: string;
}): Promise<CapaProcessada> {
  if (arquivo.bytes.length === 0) throw new ErroCapa("O arquivo está vazio.");
  if (arquivo.bytes.length > TAMANHO_MAXIMO_CAPA) {
    throw new ErroCapa("A imagem pode ter até 10 MB.");
  }
  if (!TIPOS_ACEITOS.includes(arquivo.tipo)) {
    throw new ErroCapa(MENSAGEM_FORMATO);
  }

  try {
    // O formato real vem do conteúdo, não do tipo declarado pelo navegador.
    const meta = await sharp(arquivo.bytes).metadata();
    if (!meta.format || !FORMATOS_ACEITOS.includes(meta.format)) {
      throw new ErroCapa(MENSAGEM_FORMATO);
    }

    let dados: Buffer = Buffer.alloc(0);
    let info = { width: 0, height: 0 };
    for (let qualidade = 82; qualidade >= 60; qualidade -= 6) {
      const saida = await sharp(arquivo.bytes)
        .rotate()
        .resize({
          width: LADO_MAXIMO,
          height: LADO_MAXIMO,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: qualidade, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });
      dados = saida.data;
      info = saida.info;
      if (dados.length <= ALVO_BYTES) break;
    }
    return {
      dados,
      largura: info.width,
      altura: info.height,
      tamanho: dados.length,
    };
  } catch (erro) {
    if (erro instanceof ErroCapa) throw erro;
    console.error("Falha ao processar a capa:", erro);
    throw new ErroCapa(MENSAGEM_FORMATO);
  }
}

/** Grava a capa já processada e devolve o id da imagem. */
export async function gravarCapa(
  db: Banco,
  processada: CapaProcessada,
): Promise<string> {
  const [linha] = await db
    .insert(imagens)
    .values({
      dados: processada.dados,
      tipo: "image/jpeg",
      largura: processada.largura,
      altura: processada.altura,
      tamanho: processada.tamanho,
    })
    .returning({ id: imagens.id });
  return linha.id;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lê uma capa. Sem `incluirRascunhos`, só devolve imagens que são capa de um
 * evento publicado. Id inválido ou inexistente devolve `null`.
 */
export async function lerCapa(
  db: Banco,
  id: string,
  opcoes: { incluirRascunhos: boolean },
): Promise<{ dados: Buffer; tipo: string } | null> {
  if (!UUID.test(id)) return null;

  if (opcoes.incluirRascunhos) {
    const [linha] = await db
      .select({ dados: imagens.dados, tipo: imagens.tipo })
      .from(imagens)
      .where(eq(imagens.id, id));
    return linha ?? null;
  }

  const [linha] = await db
    .select({ dados: imagens.dados, tipo: imagens.tipo })
    .from(imagens)
    .innerJoin(eventos, eq(eventos.capaId, imagens.id))
    .where(and(eq(imagens.id, id), eq(eventos.publicado, true)))
    .limit(1);
  return linha ?? null;
}
