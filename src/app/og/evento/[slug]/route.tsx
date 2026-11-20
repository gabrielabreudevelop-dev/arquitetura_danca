import { obterBanco } from "@/servidor/banco/cliente";
import { obterEventoPublico } from "@/servidor/vitrine/consultas";
import { imagemPrevia } from "@/servidor/vitrine/imagem-previa";
import { formatarDataEvento } from "@/servidor/vitrine/texto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Imagem de prévia de um evento sem capa. Rascunho e inexistente: 404. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const evento = await obterEventoPublico(obterBanco(), slug, new Date());
  if (!evento) return new Response("Não encontrado", { status: 404 });

  return imagemPrevia({
    titulo: evento.titulo,
    linha: formatarDataEvento(evento.inicio, evento.fim),
    esgotado: evento.esgotado,
  });
}
