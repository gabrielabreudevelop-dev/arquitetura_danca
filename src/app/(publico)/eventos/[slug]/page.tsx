import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ambiente } from "@/servidor/ambiente";
import { obterBanco } from "@/servidor/banco/cliente";
import { obterEventoPublico } from "@/servidor/vitrine/consultas";
import {
  linkCompartilharWhatsapp,
  urlDoEvento,
} from "@/servidor/vitrine/eventos";
import { metadadosDoEvento } from "@/servidor/vitrine/metadados";
import {
  formatarDataCurta,
  formatarDataEvento,
} from "@/servidor/vitrine/texto";
import { BotaoIngresso } from "../../componentes/botao-ingresso";
import { Compartilhar } from "./compartilhar";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const evento = await obterEventoPublico(obterBanco(), slug, new Date());
  if (!evento) return { title: "Evento não encontrado" };
  return metadadosDoEvento(evento, ambiente.BETTER_AUTH_URL);
}

const estiloFaixa = "faixa-esgotado px-3 py-1";

export default async function PaginaEvento({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const evento = await obterEventoPublico(obterBanco(), slug, new Date());
  if (!evento) notFound();

  const { capa } = evento;
  const url = urlDoEvento(evento.slug);
  const hrefWhatsapp = linkCompartilharWhatsapp(
    `${evento.titulo} · ${formatarDataCurta(evento.inicio)}`,
    url,
  );

  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 pt-4 pb-16 md:px-12 md:pt-8 md:pb-24"
    >
      {evento.passou && (
        <p className="max-w-prose bg-fundo-suave px-4 py-3 font-semibold">
          Este evento já aconteceu.
        </p>
      )}

      <article
        aria-labelledby="titulo-evento"
        className={`grid min-w-0 items-start gap-6 md:gap-12 ${capa ? "md:grid-cols-2" : ""}`}
      >
        {capa && (
          <div className="relative w-fit">
            {/* biome-ignore lint/performance/noImgElement: rota própria que serve os bytes do banco; largura e altura reais evitam o pulo do layout. */}
            <img
              src={`/capas/${capa.id}`}
              alt={`Arte de divulgação de ${evento.titulo}`}
              width={capa.largura}
              height={capa.altura}
              className="block h-auto max-h-[45svh] w-auto max-w-full md:max-h-[80svh]"
            />
            {evento.esgotado && (
              <span className={`absolute top-0 left-0 ${estiloFaixa}`}>
                Esgotado
              </span>
            )}
          </div>
        )}

        <div className="flex min-w-0 max-w-prose flex-col gap-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <h1
              id="titulo-evento"
              className="text-titulo [overflow-wrap:anywhere]"
            >
              {evento.titulo}
            </h1>
            {evento.esgotado && !capa && (
              <span className={estiloFaixa}>Esgotado</span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <p className="font-semibold">
              {formatarDataEvento(evento.inicio, evento.fim)}
            </p>
            {evento.local && (
              <p className="text-texto-suave [overflow-wrap:anywhere]">
                {evento.local}
              </p>
            )}
            {evento.preco && (
              <p className="[overflow-wrap:anywhere]">{evento.preco}</p>
            )}
          </div>

          {evento.descricao && (
            <p className="whitespace-pre-line [overflow-wrap:anywhere]">
              {evento.descricao}
            </p>
          )}

          <div className="flex flex-col gap-2 md:items-start">
            {!evento.passou && <BotaoIngresso evento={evento} />}
            <Compartilhar url={url} hrefWhatsapp={hrefWhatsapp} />
          </div>
        </div>
      </article>
    </main>
  );
}
