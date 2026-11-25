import Link from "next/link";
import { exigirPapel } from "@/servidor/auth/acesso";
import type { Papel } from "@/servidor/banco/esquema";

export const dynamic = "force-dynamic";

/** Os papéis que dão acesso ao painel, como aparecem na frase de boas-vindas. */
const EQUIPES: Partial<Record<Papel, string>> = {
  administracao: "administração",
  atendente: "atendimento",
};

export default async function Painel() {
  const { nome, papeis } = await exigirPapel(["administracao", "atendente"]);
  const equipes = papeis.flatMap((p) => EQUIPES[p] ?? []).join(" e ");
  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-6 py-12 md:px-12 md:py-16"
    >
      <div className="flex flex-col gap-2">
        <h1 className="break-words text-titulo">Olá, {nome}</h1>
        <p className="text-texto-suave">Você está na equipe de {equipes}.</p>
      </div>

      {papeis.includes("administracao") ? (
        <section
          aria-labelledby="painel-alunos"
          className="flex max-w-prose flex-col gap-4 border-linha border-t pt-6"
        >
          <h2 id="painel-alunos" className="text-base">
            Alunos e períodos
          </h2>
          <p className="text-texto-suave">
            O resumo dos períodos contratados chega aqui em breve. Por enquanto,
            cadastre e acompanhe os alunos na lista.
          </p>
          <Link
            href="/painel/alunos"
            className="-mx-2 flex min-h-12 items-center self-start px-2 font-semibold text-link underline decoration-link underline-offset-4"
          >
            Abrir a lista de alunos
          </Link>
        </section>
      ) : (
        <section
          aria-labelledby="painel-vazio"
          className="flex max-w-prose flex-col gap-2 border-linha border-t pt-6"
        >
          <h2 id="painel-vazio" className="text-base">
            O painel ainda está vazio
          </h2>
          <p className="text-texto-suave">
            É aqui que a equipe vai cadastrar alunos e turmas e acompanhar os
            períodos contratados e os consentimentos de contato, no lugar da
            planilha. Essas telas chegam nos próximos marcos.
          </p>
        </section>
      )}
    </main>
  );
}
