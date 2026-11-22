import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { MENSAGEM_EM_USO } from "@/servidor/cadastros/resultado";
import { obterPlano } from "@/servidor/configuracoes/planos";
import { MensagemErroGeral } from "../../../_formulario/mensagem";
import { excluirPlanoAcao } from "../../acoes";
import { FormularioPlano } from "../formulario";

export const dynamic = "force-dynamic";

export default async function EditarPlano({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  await exigirAdministracao();
  const { id } = await params;
  const { erro } = await searchParams;
  const plano = await obterPlano(obterBanco(), id);
  if (!plano) notFound();
  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-md flex-1 flex-col gap-12 px-6 py-12 md:px-12 md:py-16"
    >
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <Link
            href="/painel/configuracoes"
            className="-mx-2 flex min-h-12 items-center px-2 text-link underline decoration-link underline-offset-4"
          >
            Voltar para configurações
          </Link>
          <h1 className="break-words text-titulo">{plano.nome}</h1>
        </div>
        <FormularioPlano plano={plano} />
      </div>
      <form
        action={excluirPlanoAcao}
        className="flex flex-col gap-4 border-linha border-t pt-6"
      >
        <input type="hidden" name="id" value={plano.id} />
        <h2 className="text-base">Excluir</h2>
        <p className="text-texto-suave">
          Só dá para excluir um plano que nunca foi usado num período. Se ele já
          foi usado, desative em vez de excluir.
        </p>
        <MensagemErroGeral
          erro={erro === "em-uso" ? MENSAGEM_EM_USO : undefined}
        />
        <button
          type="submit"
          className="min-h-12 w-full rounded-sm border border-erro px-6 font-semibold text-erro hover:bg-erro hover:text-fundo md:w-auto md:self-start"
        >
          Excluir plano
        </button>
      </form>
    </main>
  );
}
