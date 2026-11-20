/** WhatsApp normalizado (55 + DDD + número) para exibição: "(27) 99999-0000". */
export function formatarWhatsapp(numero: string): string {
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(numero);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : numero;
}
