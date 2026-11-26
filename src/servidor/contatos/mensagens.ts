/** Campos que se preenchem sozinhos nas mensagens prontas. */
export const CAMPOS_MENSAGEM = ["nome", "aluno", "turma", "fim"] as const;

export type ValoresMensagem = Record<(typeof CAMPOS_MENSAGEM)[number], string>;

/** Valores de exemplo para a prévia no formulário de mensagem. */
export const EXEMPLO_MENSAGEM: ValoresMensagem = {
  nome: "Carla",
  aluno: "Bruno",
  turma: "Forró Iniciante",
  fim: "08/12",
};

/** Mensagem de erro do texto, ou `null` se estiver bom. */
export function validarTextoMensagem(texto: string): string | null {
  if (texto.trim() === "") return "Escreva a mensagem.";
  for (const [, nome] of texto.matchAll(/\{([^{}]*)\}/g)) {
    if (!(CAMPOS_MENSAGEM as readonly string[]).includes(nome)) {
      return `Campo {${nome}} não existe. Use {nome}, {aluno}, {turma} ou {fim}.`;
    }
  }
  return null;
}

/** Troca cada `{campo}` pelo valor, numa passada só (valores não são reinterpretados). */
export function preencherMensagem(
  texto: string,
  valores: ValoresMensagem,
): string {
  return texto.replace(/\{(nome|aluno|turma|fim)\}/g, (_, campo) => {
    return valores[campo as keyof ValoresMensagem];
  });
}

/** Primeira palavra do nome, com a grafia original. */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? "";
}

/** "Bruno", "Bruno e Lia", "Bruno, Lia e Ana". */
export function juntarLista(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/** Link `wa.me` para abrir a conversa, com o texto já escrito se houver. */
export function linkConversa(numero: string, texto?: string): string {
  const base = `https://wa.me/${numero}`;
  return texto === undefined
    ? base
    : `${base}?text=${encodeURIComponent(texto)}`;
}
