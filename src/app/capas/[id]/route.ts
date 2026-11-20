import { sessaoEhAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { lerCapa } from "@/servidor/imagens/capa";

const NAO_ENCONTRADA = () => new Response("Não encontrada", { status: 404 });

/**
 * Serve a capa de um evento. Capas de eventos publicados são públicas e
 * imutáveis (cada imagem nova ganha um id novo); capas de rascunho só a
 * administração logada vê, sem cache.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = obterBanco();

  const publica = await lerCapa(db, id, { incluirRascunhos: false });
  if (publica) {
    return new Response(new Uint8Array(publica.dados), {
      headers: {
        "Content-Type": publica.tipo,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  if (!(await sessaoEhAdministracao())) return NAO_ENCONTRADA();
  const privada = await lerCapa(db, id, { incluirRascunhos: true });
  if (!privada) return NAO_ENCONTRADA();
  return new Response(new Uint8Array(privada.dados), {
    headers: {
      "Content-Type": privada.tipo,
      "Cache-Control": "private, no-store",
    },
  });
}
