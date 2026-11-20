import { toNextJsHandler } from "better-auth/next-js";
import { obterAuth } from "@/servidor/auth/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// O handler só é criado na primeira requisição, para `next build` funcionar
// sem variáveis de ambiente.
export function GET(request: Request): Promise<Response> {
  return toNextJsHandler(obterAuth()).GET(request);
}

export function POST(request: Request): Promise<Response> {
  return toNextJsHandler(obterAuth()).POST(request);
}
