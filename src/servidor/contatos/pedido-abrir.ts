/**
 * Conferências do `POST /painel/contatos/abrir` que não dependem de sessão
 * nem de banco: a origem do pedido e os campos do formulário. Também os
 * códigos de erro que a rota põe em `/painel/contatos?erro=…`: a página só
 * mostra mensagens fixas desta tabela, nunca texto vindo do endereço.
 */
import { MENSAGEM_ENCERRADO } from "../alunos/cadastro";
import { type Janela, lerFiltrosContatos, urlContatos } from "../alunos/listas";
import { MENSAGEM_NAO_BOLSISTA } from "../bolsistas/cadastro";
import { ehUuid } from "../cadastros/comum";
import type { Resultado } from "../cadastros/resultado";
import {
  MENSAGEM_ALUNO_NAO_ENCONTRADO,
  MENSAGEM_BLOQUEADO,
  MENSAGEM_BOLSISTA_INATIVO,
  MENSAGEM_CONTATOS_DIFERENTES,
  MENSAGEM_CONTATOS_DIFERENTES_BOLSISTAS,
  MENSAGEM_FORA_DA_LISTA,
  MENSAGEM_RECENTE,
  MENSAGEM_SEM_WHATSAPP,
} from "./contatos";
import { ehListaDeBolsista, LISTAS, type ListaContato } from "./valores";

const ERROS = {
  aluno: MENSAGEM_ALUNO_NAO_ENCONTRADO,
  bolsista: MENSAGEM_NAO_BOLSISTA,
  lista:
    "Não deu para saber de qual lista é o contato. Recarregue a página e tente de novo.",
  contatos: MENSAGEM_CONTATOS_DIFERENTES,
  contatos_bolsistas: MENSAGEM_CONTATOS_DIFERENTES_BOLSISTAS,
  bloqueado: MENSAGEM_BLOQUEADO,
  sem_whatsapp: MENSAGEM_SEM_WHATSAPP,
  encerrado: MENSAGEM_ENCERRADO,
  inativo: MENSAGEM_BOLSISTA_INATIVO,
  fora_da_lista: MENSAGEM_FORA_DA_LISTA,
  recente: MENSAGEM_RECENTE,
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
  | {
      tipo: "ok";
      alunoIds: string[];
      lista: ListaContato;
      /** Janela da lista que a tela mostrava (7, 15 ou 30; inválida vira a padrão da lista). */
      janela: Janela;
      /** Último grupo de contato que a tela mostrou para a pessoa (R17). */
      visto: string | null;
      /** "Chamar mesmo assim": ignora o contato recente de outra pessoa. */
      confirmar: boolean;
    };

/**
 * Origem primeiro (403), depois os campos `aluno` (repetido) e `lista`.
 * `visto` vazio ou inválido vale como nenhum contato visto.
 */
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
  const visto = String(form.get("visto") ?? "").trim();
  const janela = form.get("janela");
  return {
    tipo: "ok",
    alunoIds: [...new Set(alunoIds.map((id) => id.toLowerCase()))],
    lista,
    janela: lerFiltrosContatos({
      lista,
      janela: typeof janela === "string" ? janela : undefined,
    }).janela,
    visto: ehUuid(visto) ? visto.toLowerCase() : null,
    confirmar: form.get("confirmar") === "1",
  };
}

export type RespostaAbrir = { status: 403 } | { status: 303; location: string };

function voltarComErro(codigo: CodigoErroAbrir): RespostaAbrir {
  return { status: 303, location: `/painel/contatos?erro=${codigo}` };
}

/**
 * Erro de um contato de bolsista: volta para a ficha do bolsista (`ficha_bolsista`)
 * ou para a aba de bolsistas (`bolsista_ausente`). O contato recente marca a
 * linha do bolsista na aba para a tela mostrar "Chamar mesmo assim".
 */
function voltarDeBolsista(
  pedido: { alunoIds: string[]; lista: ListaContato },
  form: FormData,
  codigo: CodigoErroAbrir,
): RespostaAbrir {
  if (pedido.lista === "ficha_bolsista") {
    return {
      status: 303,
      location: `/painel/bolsistas/${pedido.alunoIds[0]}?erro=${codigo}`,
    };
  }
  const janela = form.get("janela");
  const aba = urlContatos(
    lerFiltrosContatos({
      lista: "bolsista_ausente",
      janela: typeof janela === "string" ? janela : undefined,
    }),
  );
  const marca = codigo === "recente" ? `&aluno=${pedido.alunoIds[0]}` : "";
  return { status: 303, location: `${aba}&erro=${codigo}${marca}` };
}

/**
 * Contato recente de outra pessoa da equipe: volta para onde o botão estava
 * (a ficha, ou a mesma lista com os mesmos filtros), marcando o aluno para a
 * tela mostrar o aviso e "Chamar mesmo assim" na linha dele. O endereço é
 * montado só com valores conferidos (uuid e filtros lidos), nunca copiado.
 */
function voltarParaConfirmar(
  pedido: { alunoIds: string[]; lista: ListaContato },
  form: FormData,
): RespostaAbrir {
  const aluno = pedido.alunoIds[0];
  if (pedido.lista === "ficha") {
    return { status: 303, location: `/painel/alunos/${aluno}?erro=recente` };
  }
  const texto = (nome: string) => {
    const v = form.get(nome);
    return typeof v === "string" ? v : undefined;
  };
  const lista = urlContatos(
    lerFiltrosContatos({
      lista: pedido.lista,
      janela: texto("janela"),
      todos: texto("todos"),
      sem_contato: texto("sem_contato"),
    }),
  );
  const separador = lista.includes("?") ? "&" : "?";
  return {
    status: 303,
    location: `${lista}${separador}erro=recente&aluno=${aluno}`,
  };
}

/**
 * Todo o `POST /painel/contatos/abrir`, com sessão e registro injetados:
 * origem (403), sessão da administração (403), campos (volta com o código),
 * registro (303 para o `wa.me` ou volta com o código do erro). Uma falha
 * inesperada vira o erro genérico: o erro do banco traz os parâmetros da
 * consulta (número, texto com nomes), então o log recebe só um texto fixo.
 */
export async function responderAbrir(
  cabecalhos: Headers,
  form: FormData,
  dependencias: {
    sessao: () => Promise<{ pessoaId: string } | null>;
    registrar: (a: {
      alunoIds: string[];
      lista: ListaContato;
      janela: Janela;
      feitoPor: string;
      visto: string | null;
      confirmar: boolean;
    }) => Promise<Resultado<{ url: string }>>;
  },
): Promise<RespostaAbrir> {
  const pedido = validarPedidoAbrir(cabecalhos, form);
  if (pedido.tipo === "proibido") return { status: 403 };
  const sessao = await dependencias.sessao();
  if (!sessao) return { status: 403 };
  if (pedido.tipo === "erro") return voltarComErro(pedido.codigo);
  try {
    const resultado = await dependencias.registrar({
      alunoIds: pedido.alunoIds,
      lista: pedido.lista,
      janela: pedido.janela,
      feitoPor: sessao.pessoaId,
      visto: pedido.visto,
      confirmar: pedido.confirmar,
    });
    if (!resultado.ok) {
      const codigo = codigoDoErro(resultado.erros._ ?? "");
      if (ehListaDeBolsista(pedido.lista)) {
        return voltarDeBolsista(pedido, form, codigo);
      }
      return codigo === "recente"
        ? voltarParaConfirmar(pedido, form)
        : voltarComErro(codigo);
    }
    return { status: 303, location: resultado.valor.url };
  } catch {
    console.error("Falha ao registrar um contato.");
    return ehListaDeBolsista(pedido.lista)
      ? voltarDeBolsista(pedido, form, "erro")
      : voltarComErro("erro");
  }
}
