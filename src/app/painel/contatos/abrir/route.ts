import { hojeEmSaoPaulo } from "@/servidor/alunos/datas";
import { sessaoDaAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { registrarContato } from "@/servidor/contatos/contatos";
import {
  type CodigoErroAbrir,
  codigoDoErro,
  validarPedidoAbrir,
} from "@/servidor/contatos/pedido-abrir";

export const dynamic = "force-dynamic";

const CABECALHOS = { "Cache-Control": "no-store" };

function proibido(): Response {
  return new Response("Acesso negado.", { status: 403, headers: CABECALHOS });
}

function irPara(endereco: string): Response {
  return new Response(null, {
    status: 303,
    headers: { ...CABECALHOS, Location: endereco },
  });
}

function voltarComErro(codigo: CodigoErroAbrir): Response {
  return irPara(`/painel/contatos?erro=${codigo}`);
}

/**
 * Botão "WhatsApp" (form com `target="_blank"`): registra o contato no
 * servidor e só então manda a aba nova para o `wa.me`. Assim o registro
 * acontece mesmo que o navegador bloqueie janelas abertas por script.
 * Route handlers não passam pela checagem das actions: origem e sessão são
 * conferidas aqui. Nada de dados pessoais em log.
 */
export async function POST(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    form = new FormData();
  }
  const pedido = validarPedidoAbrir(request.headers, form);
  if (pedido.tipo === "proibido") return proibido();
  const sessao = await sessaoDaAdministracao();
  if (!sessao) return proibido();
  if (pedido.tipo === "erro") return voltarComErro(pedido.codigo);

  const resultado = await registrarContato(
    obterBanco(),
    {
      alunoIds: pedido.alunoIds,
      lista: pedido.lista,
      feitoPor: sessao.pessoaId,
    },
    hojeEmSaoPaulo(),
  );
  if (!resultado.ok) {
    return voltarComErro(codigoDoErro(resultado.erros._ ?? ""));
  }
  return irPara(resultado.valor.url);
}
