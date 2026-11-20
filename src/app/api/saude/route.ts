import { checarBancoCompartilhado, verificarSaude } from "@/servidor/saude";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Usada pelo Coolify e pelo monitoramento externo. */
export async function GET(): Promise<Response> {
  const { http, corpo } = await verificarSaude(checarBancoCompartilhado);
  return Response.json(corpo, {
    status: http,
    headers: { "Cache-Control": "no-store" },
  });
}
