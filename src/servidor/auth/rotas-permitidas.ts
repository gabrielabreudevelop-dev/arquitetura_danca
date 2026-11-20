// Única superfície do Better Auth exposta ao navegador. Todo o resto
// (cadastro, recuperação de senha, listagem de sessões…) fica fechado.
// O caminho é relativo a `/api/auth`.
const ROTAS_PERMITIDAS: ReadonlyArray<readonly [string, string]> = [
  ["POST", "/sign-in/email"],
  ["POST", "/sign-out"],
  ["GET", "/get-session"],
];

export function rotaAuthPermitida(metodo: string, caminho: string): boolean {
  return ROTAS_PERMITIDAS.some(([m, c]) => m === metodo && c === caminho);
}
