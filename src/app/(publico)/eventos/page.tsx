import type { Metadata } from "next";
import Link from "next/link";
import { ESTUDIO } from "@/estudio";
import { ambiente } from "@/servidor/ambiente";
import { obterBanco } from "@/servidor/banco/cliente";
import { listarProximosEventos } from "@/servidor/vitrine/consultas";
import { metadadosPadrao } from "@/servidor/vitrine/metadados";
import { formatarDataEvento } from "@/servidor/vitrine/texto";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return metadadosPadrao(ambiente.BETTER_AUTH_URL, {
    titulo: "Eventos",
    descricao: "Próximos bailes, workshops e festas do estúdio.",
    caminho: "/eventos",
  });
}

export default async function Eventos() {
  const eventos = await listarProximosEventos(obterBanco(), new Date());

  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 pt-4 pb-16 md:px-12 md:pt-8 md:pb-24"
    >
      <h1 className="text-titulo">Eventos</h1>

      {eventos.length === 0 ? (
        <div className="flex max-w-prose flex-col gap-2 border-linha border-t pt-6">
          <h2 className="text-base">Nenhum evento marcado agora</h2>
          <p className="text-texto-suave">
            Os próximos bailes e workshops aparecem aqui e no Instagram.
          </p>
          <a
            href={ESTUDIO.instagram.url}
            className="-mx-2 inline-flex min-h-12 items-center self-start px-2 font-semibold text-link underline decoration-link underline-offset-4 hover:decoration-2"
          >
            Acompanhe as novidades no Instagram
          </a>
        </div>
      ) : (
        <ul className="flex flex-col border-linha border-t">
          {eventos.map((evento) => (
            <li
              key={evento.id}
              className="relative flex items-start gap-4 border-linha border-b py-4 md:gap-6 md:py-6"
            >
              {evento.capa && (
                <div className="flex size-20 shrink-0 items-center justify-center bg-fundo-suave md:size-28">
                  {/* biome-ignore lint/performance/noImgElement: rota própria que serve os bytes do banco; largura e altura reais evitam o pulo do layout. */}
                  <img
                    src={`/capas/${evento.capa.id}`}
                    alt=""
                    width={evento.capa.largura}
                    height={evento.capa.altura}
                    className="block h-auto max-h-full w-auto max-w-full"
                  />
                </div>
              )}
              <div className="flex min-w-0 flex-col gap-1">
                <p className="font-semibold text-texto-suave">
                  {formatarDataEvento(evento.inicio, evento.fim)}
                </p>
                <h2 className="text-base">
                  <Link
                    href={`/eventos/${evento.slug}`}
                    className="font-bold [overflow-wrap:anywhere] underline decoration-link underline-offset-4 after:absolute after:inset-0 hover:decoration-2"
                  >
                    {evento.titulo}
                  </Link>
                </h2>
                {evento.local && (
                  <p className="text-texto-suave [overflow-wrap:anywhere]">
                    {evento.local}
                  </p>
                )}
                {(evento.preco || evento.esgotado) && (
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {evento.preco && <span>{evento.preco}</span>}
                    {evento.esgotado && (
                      <span className="faixa-esgotado px-2 py-0.5">
                        Esgotado
                      </span>
                    )}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
