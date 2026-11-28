import type { Finalidade } from "../configuracoes/mensagens-prontas";

/** Campos que se preenchem sozinhos nas mensagens prontas. */
export const CAMPOS_MENSAGEM = [
  "nome",
  "aluno",
  "turma",
  "fim",
  "dias",
] as const;
export type CampoMensagem = (typeof CAMPOS_MENSAGEM)[number];

/** Campos aceitos em cada finalidade, na ordem em que o formulário os lista. */
export const CAMPOS_POR_FINALIDADE: Record<
  Finalidade,
  readonly CampoMensagem[]
> = {
  renovacao: ["nome", "aluno", "turma", "fim"],
  retorno: ["nome", "aluno", "turma", "fim"],
  bolsista: ["nome", "dias"],
};

/** Valores de cada campo; campo sem valor fica como está no texto. */
export type ValoresMensagem = Partial<Record<CampoMensagem, string>>;

/** Valores de exemplo para a prévia no formulário de mensagem. */
export const EXEMPLO_MENSAGEM: Record<CampoMensagem, string> = {
  nome: "Carla",
  aluno: "Bruno",
  turma: "Forró Iniciante",
  fim: "08/12",
  dias: "terças e quintas",
};

/** "{nome}", "{nome} ou {dias}", "{nome}, {aluno} ou {fim}". */
function listarCampos(campos: readonly string[]): string {
  const chaves = campos.map((c) => `{${c}}`);
  if (chaves.length <= 1) return chaves[0] ?? "";
  return `${chaves.slice(0, -1).join(", ")} ou ${chaves[chaves.length - 1]}`;
}

/** Mensagem de erro do texto para a finalidade, ou `null` se estiver bom. */
export function validarTextoMensagem(
  texto: string,
  finalidade: Finalidade,
): string | null {
  if (texto.trim() === "") return "Escreva a mensagem.";
  const campos = CAMPOS_POR_FINALIDADE[finalidade];
  for (const [, nome] of texto.matchAll(/\{([^{}]*)\}/g)) {
    if (!(campos as readonly string[]).includes(nome)) {
      return `Campo {${nome}} não existe. Use ${listarCampos(campos)}.`;
    }
  }
  return null;
}

/** Troca cada `{campo}` pelo valor, numa passada só (valores não são reinterpretados). */
export function preencherMensagem(
  texto: string,
  valores: ValoresMensagem,
): string {
  return texto.replace(/\{(nome|aluno|turma|fim|dias)\}/g, (inteiro, campo) => {
    return valores[campo as CampoMensagem] ?? inteiro;
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
