import Link from "next/link";
import { exigirPapel } from "@/servidor/auth/acesso";
import type { Papel } from "@/servidor/banco/esquema";

export const dynamic = "force-dynamic";

/** Os papéis que dão acesso ao painel, como aparecem na frase de boas-vindas. */
const EQUIPES: Partial<Record<Papel, string>> = {
  administracao: "administração",
  atendente: "atendimento",
};

const ATALHOS = [
  {
    href: "/painel/eventos",
    rotulo: "Eventos",
    descricao: "Divulgação e ingressos",
  },
  { href: "/painel/turmas", rotulo: "Turmas", descricao: "Grade de horários" },
  {
    href: "/painel/ritmos",
    rotulo: "Ritmos",
    descricao: "Os estilos de dança",
  },
  {
    href: "/painel/modulos",
    rotulo: "Módulos",
    descricao: "Os níveis de cada ritmo",
  },
  {
    href: "/painel/professores",
    rotulo: "Professores",
    descricao: "Quem dá as aulas",
  },
];

// Por ora serve só para provar o acesso; o dashboard vem em marcos futuros.
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
          aria-labelledby="painel-cadastros"
          className="flex max-w-prose flex-col gap-4 border-linha border-t pt-6"
        >
          <h2 id="painel-cadastros" className="text-base">
            Cadastros da vitrine
          </h2>
          <p className="text-texto-suave">
            O que aparece no site do estúdio. Alunos e períodos contratados
            chegam nos próximos marcos.
          </p>
          <ul className="flex flex-col">
            {ATALHOS.map(({ href, rotulo, descricao }) => (
              <li key={href} className="border-linha border-b first:border-t">
                <Link
                  href={href}
                  className="flex min-h-12 flex-col justify-center gap-1 py-3 hover:bg-fundo-suave md:flex-row md:items-center md:justify-between md:gap-6"
                >
                  <span className="font-semibold text-link underline decoration-link underline-offset-4">
                    {rotulo}
                  </span>
                  <span className="text-pequeno text-texto-suave">
                    {descricao}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
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
