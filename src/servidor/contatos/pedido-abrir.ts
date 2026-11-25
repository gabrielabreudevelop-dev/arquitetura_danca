/**
 * Conferências do `POST /painel/contatos/abrir` que não dependem de sessão
 * nem de banco: a origem do pedido e os campos do formulário. Também os
 * códigos de erro que a rota põe em `/painel/contatos?erro=…`: a página só
 * mostra mensagens fixas desta tabela, nunca texto vindo do endereço.
 */
import { MENSAGEM_ENCERRADO } from "../alunos/cadastro";
import { ehUuid } from "../cadastros/comum";
import {
  MENSAGEM_ALUNO_NAO_ENCONTRADO,
  MENSAGEM_BLOQUEADO,
  MENSAGEM_CONTATOS_DIFERENTES,
  MENSAGEM_SEM_WHATSAPP,
} from "./contatos";
import { LISTAS, type ListaContato } from "./valores";

const ERROS = {
  aluno: MENSAGEM_ALUNO_NAO_ENCONTRADO,
  lista:
    "Não deu para saber de qual lista é o contato. Recarregue a página e tente de novo.",
  contatos: MENSAGEM_CONTATOS_DIFERENTES,
  bloqueado: MENSAGEM_BLOQUEADO,
  sem_whatsapp: MENSAGEM_SEM_WHATSAPP,
  encerrado: MENSAGEM_ENCERRADO,
  erro: "Não foi possível abrir o WhatsApp. Tente de novo.",
} as const;

export type CodigoErroAbrir = keyof typeof ERROS;

/** Código da mensagem de erro do serviço; mensagem desconhecida vira `erro`. */
export function codigoDoErro(mensagem: string): CodigoErroAbrir {
  const achado = (Object.keys(ERROS) as CodigoErroAbrir[]).find(
    (codigo) => ERROS[codigo] === mensagem,
  );
  return achado ?? "erro";
}

/** Mensagem fixa do código; `null` para qualquer outro texto. */
export function mensagemDoErro(codigo: string | undefined): string | null {
  if (codigo === undefined || !Object.hasOwn(ERROS, codigo)) return null;
  return ERROS[codigo as CodigoErroAbrir];
}

/**
 * O `Origin` é o mesmo host da requisição (o repassado pelo proxy, se houver)?
 * Sem `Origin` (ou com `null`), não: o formulário da própria página sempre o manda.
 */
function mesmaOrigem(cabecalhos: Headers): boolean {
  const origem = cabecalhos.get("origin");
  if (!origem) return false;
  let hostDaOrigem: string;
  try {
    hostDaOrigem = new URL(origem).host;
  } catch {
    return false;
  }
  const host = (cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host"))
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  return Boolean(host) && hostDaOrigem === host;
}

export type PedidoAbrir =
  | { tipo: "proibido" }
  | { tipo: "erro"; codigo: CodigoErroAbrir }
  | { tipo: "ok"; alunoIds: string[]; lista: ListaContato };

/** Origem primeiro (403), depois os campos `aluno` (repetido) e `lista`. */
export function validarPedidoAbrir(
  cabecalhos: Headers,
  form: FormData,
): PedidoAbrir {
  if (!mesmaOrigem(cabecalhos)) return { tipo: "proibido" };
  const alunoIds = form.getAll("aluno").map((v) => String(v).trim());
  if (alunoIds.length === 0 || !alunoIds.every(ehUuid)) {
    return { tipo: "erro", codigo: "aluno" };
  }
  const lista = LISTAS.find((l) => l === form.get("lista"));
  if (!lista) return { tipo: "erro", codigo: "lista" };
  return {
    tipo: "ok",
    alunoIds: [...new Set(alunoIds.map((id) => id.toLowerCase()))],
    lista,
  };
}
