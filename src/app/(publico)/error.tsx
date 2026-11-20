"use client";

import { ESTUDIO } from "@/estudio";

const estiloLink =
  "-mx-2 inline-flex min-h-12 items-center px-2 font-semibold text-link underline decoration-link underline-offset-4 hover:decoration-2";

/** Falha inesperada numa página pública: tentar de novo ou falar com o estúdio. */
export default function ErroPublico({ reset }: { reset: () => void }) {
  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-start gap-6 px-6 pt-8 pb-16 md:px-12 md:pt-16 md:pb-24"
    >
      <h1 className="text-titulo">Algo deu errado. Tente de novo.</h1>
      <button
        type="button"
        onClick={() => reset()}
        className="inline-flex min-h-12 items-center rounded-sm bg-acao px-6 font-semibold text-fundo hover:bg-acao-escura"
      >
        Tentar de novo
      </button>
      <p>
        Se continuar, fale com a gente no Instagram:{" "}
        <a href={ESTUDIO.instagram.url} className={estiloLink}>
          {ESTUDIO.instagram.usuario}
        </a>
      </p>
    </main>
  );
}
