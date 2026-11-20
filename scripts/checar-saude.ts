// Verificação de saúde para o HEALTHCHECK do Dockerfile: a imagem não tem curl nem wget.
// Sai com 0 só se /api/saude responder HTTP 200 em até 3 s.
export {};

const porta = process.env.PORT ?? "3000";

try {
  const resposta = await fetch(`http://127.0.0.1:${porta}/api/saude`, {
    signal: AbortSignal.timeout(3000),
  });
  process.exit(resposta.status === 200 ? 0 : 1);
} catch {
  process.exit(1);
}
