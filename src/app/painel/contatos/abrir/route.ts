import { hojeEmSaoPaulo } from "@/servidor/alunos/datas";
import { sessaoDaAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { registrarContato } from "@/servidor/contatos/contatos";
import { responderAbrir } from "@/servidor/contatos/pedido-abrir";

export const dynamic = "force-dynamic";

/**
 * Botão "WhatsApp" (form com `target="_blank"`): registra o contato no
 * servidor e só então manda a aba nova para o `wa.me`. Assim o registro
 * acontece mesmo que o navegador bloqueie janelas abertas por script.
 * Route handlers não passam pela checagem das actions: origem e sessão são
 * conferidas em `responderAbrir`. Nada de dados pessoais em log.
 */
export async function POST(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    form = new FormData();
  }
  const resposta = await responderAbrir(request.headers, form, {
    sessao: sessaoDaAdministracao,
    registrar: (a) => registrarContato(obterBanco(), a, hojeEmSaoPaulo()),
  });
  const cabecalhos = { "Cache-Control": "no-store" };
  if (resposta.status === 403) {
    return new Response("Acesso negado.", { status: 403, headers: cabecalhos });
  }
  return new Response(null, {
    status: 303,
    headers: { ...cabecalhos, Location: resposta.location },
  });
}
