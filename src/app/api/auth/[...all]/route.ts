import { toNextJsHandler } from "better-auth/next-js";
import { obterAuth } from "@/servidor/auth/auth";
import { rotaAuthPermitida } from "@/servidor/auth/rotas-permitidas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREFIXO = "/api/auth";

function bloqueada(request: Request): boolean {
  const caminho = new URL(request.url).pathname.slice(PREFIXO.length);
  return !rotaAuthPermitida(request.method, caminho);
}

// O handler só é criado na primeira requisição, para `next build` funcionar
// sem variáveis de ambiente.
export function GET(request: Request): Promise<Response> {
  if (bloqueada(request))
    return Promise.resolve(new Response(null, { status: 404 }));
  return toNextJsHandler(obterAuth()).GET(request);
}

export function POST(request: Request): Promise<Response> {
  if (bloqueada(request))
    return Promise.resolve(new Response(null, { status: 404 }));
  return toNextJsHandler(obterAuth()).POST(request);
}
