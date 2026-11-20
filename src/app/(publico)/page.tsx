import type { Metadata } from "next";
import Link from "next/link";
import { ESTUDIO } from "@/estudio";
import { ambiente } from "@/servidor/ambiente";
import { obterBanco } from "@/servidor/banco/cliente";
import { metadadosPadrao } from "@/servidor/vitrine/metadados";
import { montarPaginaInicial } from "@/servidor/vitrine/pagina-inicial";
import { DestaqueEvento } from "./componentes/destaque-evento";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    ...metadadosPadrao(ambiente.BETTER_AUTH_URL, {
      titulo: ESTUDIO.nome,
      descricao:
        "Aulas de dança de salão e ritmos brasileiros em Vitória/ES. Veja a grade de horários e os próximos eventos.",
      caminho: "/",
    }),
    title: { absolute: ESTUDIO.nome },
  };
}

const estiloLink =
  "-mx-2 inline-flex min-h-12 items-center px-2 font-semibold text-link underline decoration-link underline-offset-4 hover:decoration-2";

export default async function Inicio() {
  const { destaque, outrosEventos, ritmos } = await montarPaginaInicial(
    obterBanco(),
    new Date(),
  );

  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 px-6 pt-4 pb-16 md:px-12 md:pt-8 md:pb-24"
    >
      {destaque ? (
        <DestaqueEvento
          evento={destaque}
          rotulo="Próximo evento"
          nivelTitulo="h1"
          fita
          acoes={
            <>
              <Link href={`/eventos/${destaque.slug}`} className={estiloLink}>
                Ver detalhes
              </Link>
              {outrosEventos > 0 && (
                <Link href="/eventos" className={estiloLink}>
                  Ver todos os eventos
                </Link>
              )}
            </>
          }
        />
      ) : (
        <section className="flex flex-col gap-6 md:pt-12">
          {/* Três linhas, para a fita ficar inteira na do meio, como no chão
              da sala. A fita fica atrás das letras da linha de cima (cedilha). */}
          <h1 className="isolate font-assinatura text-titulo">
            <span className="block">A dança é a</span>{" "}
            <span className="fita relative -z-10 whitespace-nowrap">
              linguagem escondida
            </span>{" "}
            <span className="block">da alma.</span>
          </h1>
          {/* Sem evento e sem ritmos, a página só tem a frase: o convite
              para o Instagram é o caminho para as novidades. */}
          {ritmos.length === 0 && (
            <div className="flex max-w-prose flex-col gap-2">
              <p className="text-texto-suave">
                Os próximos eventos do estúdio aparecem aqui assim que forem
                marcados.
              </p>
              <a
                href={ESTUDIO.instagram.url}
                className={`${estiloLink} self-start`}
              >
                Acompanhe as novidades no Instagram
              </a>
            </div>
          )}
        </section>
      )}

      {ritmos.length > 0 && (
        <section
          aria-labelledby="ritmos"
          className="flex flex-col gap-4 border-linha border-t pt-8"
        >
          <div className="flex flex-col gap-1">
            <h2 id="ritmos" className="text-base">
              Ritmos
            </h2>
            <p className="text-texto-suave">
              Escolha um ritmo para ver os dias e horários das turmas.
            </p>
          </div>
          <ul className="grid grid-cols-2 gap-x-6 md:grid-cols-3 md:gap-x-12">
            {ritmos.map((ritmo) => (
              <li key={ritmo.slug} className="border-linha border-b">
                <Link href={`/grade/${ritmo.slug}`} className={estiloLink}>
                  {ritmo.nome}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {destaque && (
        <p className="font-assinatura font-semibold text-base">
          {ESTUDIO.slogan}
        </p>
      )}
    </main>
  );
}
