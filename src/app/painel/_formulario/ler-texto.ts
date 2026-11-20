/** Lê um campo de texto do formulário; campo ausente vira "". */
export function lerTexto(form: FormData, campo: string): string {
  return String(form.get(campo) ?? "");
}
