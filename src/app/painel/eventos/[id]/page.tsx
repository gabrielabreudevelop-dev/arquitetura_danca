import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { ehUuid } from "@/servidor/cadastros/comum";
import { obterEventoPainel } from "@/servidor/cadastros/eventos";
import { instanteParaDataHoraLocal } from "@/servidor/vitrine/texto";
import { MensagemErroGeral } from "../../_formulario/mensagem";
import { excluirEventoAcao } from "../acoes";
import { FormularioEvento } from "../formulario";

export const dynamic = "force-dynamic";

const MENSAGEM_PUBLICADO = "Volte o evento para rascunho antes de excluir.";

export default async function EditarEvento({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  await exigirAdministracao();
  const { id } = await params;
  const { erro } = await searchParams;
  if (!ehUuid(id)) notFound();
  const evento = await obterEventoPainel(obterBanco(), id);
  if (!evento) notFound();
  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-md flex-1 flex-col gap-12 px-6 py-12 md:px-12 md:py-16"
    >
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <Link
            href="/painel/eventos"
            className="-mx-2 flex min-h-12 items-center px-2 text-link underline decoration-link underline-offset-4"
          >
            Voltar para eventos
          </Link>
          <h1 className="break-words text-titulo">Editar evento</h1>
        </div>
        <FormularioEvento
          evento={{
            id: evento.id,
            titulo: evento.titulo,
            slug: evento.slug,
            slugEditavel: evento.slugEditavel,
            inicio: instanteParaDataHoraLocal(evento.inicio),
            fim: evento.fim ? instanteParaDataHoraLocal(evento.fim) : "",
            local: evento.local ?? "",
            preco: evento.preco ?? "",
            linkIngresso: evento.linkIngresso ?? "",
            descricao: evento.descricao ?? "",
            capaId: evento.capaId,
            publicado: evento.publicado,
            esgotado: evento.esgotado,
          }}
        />
      </div>
      <form
        action={excluirEventoAcao}
        className="flex flex-col gap-4 border-linha border-t pt-6"
      >
        <input type="hidden" name="id" value={evento.id} />
        <h2 className="text-base">Excluir</h2>
        <p className="text-texto-suave">
          Só dá para excluir um rascunho. A capa é apagada junto. Para tirar do
          site um evento publicado, desmarque “Publicado” e salve.
        </p>
        <MensagemErroGeral
          erro={erro === "publicado" ? MENSAGEM_PUBLICADO : undefined}
        />
        <button
          type="submit"
          disabled={evento.publicado}
          className="min-h-12 w-full rounded-sm border border-erro px-6 font-semibold text-erro hover:bg-erro hover:text-fundo disabled:cursor-not-allowed disabled:border-borda disabled:text-texto-suave disabled:hover:bg-transparent disabled:hover:text-texto-suave md:w-auto md:self-start"
        >
          Excluir evento
        </button>
      </form>
    </main>
  );
}
