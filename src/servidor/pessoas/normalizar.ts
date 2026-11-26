/** E-mail sem espaços nas pontas e em minúsculas. */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * WhatsApp em E.164 sem o "+" (ex.: 5511987654321).
 * Aceita número com DDD (10 ou 11 dígitos, ganha o prefixo 55) ou já com o
 * código do país (55 + 10 ou 11 dígitos). Qualquer outra coisa é recusada.
 */
export function normalizarWhatsapp(numero: string): string {
  const digitos = numero.replace(/\D/g, "");
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  if (
    digitos.startsWith("55") &&
    (digitos.length === 12 || digitos.length === 13)
  ) {
    return digitos;
  }
  throw new Error("WhatsApp inválido");
}

/**
 * Usuário do Instagram, sem "@" e em minúsculas. Aceita o usuário puro, com
 * "@" ou o endereço do perfil em instagram.com; qualquer outro endereço é recusado.
 */
export function normalizarInstagram(valor: string): string {
  let texto = valor.trim();
  const perfil =
    /^(?:https?:\/\/)?(?:(?:www|m)\.)?instagram\.com(?:\/(.*))?$/i.exec(texto);
  if (perfil) {
    texto = perfil[1] ?? "";
  } else if (/[/?#:]/.test(texto)) {
    // Endereço de outro site (com ou sem http://) não vira usuário.
    throw new Error("Instagram inválido");
  }
  texto = (texto.split(/[/?#]/)[0] ?? "").replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(texto)) throw new Error("Instagram inválido");
  return texto;
}
