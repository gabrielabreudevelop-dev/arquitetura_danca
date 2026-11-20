import { exigirPapel } from "@/servidor/auth/acesso";
import type { Papel } from "@/servidor/banco/esquema";

export const dynamic = "force-dynamic";

/** Os papéis que dão acesso ao painel, como aparecem na frase de boas-vindas. */
const EQUIPES: Partial<Record<Papel, string>> = {
  administracao: "administração",
  atendente: "atendimento",
};

// Por ora serve só para provar o acesso; o dashboard vem em marcos futuros.
export default async function Painel() {
  const { nome, papeis } = await exigirPapel(["administracao", "atendente"]);
  const equipes = papeis.flatMap((p) => EQUIPES[p] ?? []).join(" e ");
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-6 py-12 md:px-12 md:py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-titulo">Olá, {nome}</h1>
        <p className="text-texto/70">Você está na equipe de {equipes}.</p>
      </div>

      <section
        aria-labelledby="painel-vazio"
        className="flex max-w-prose flex-col gap-2 border-borda/40 border-t pt-6"
      >
        <h2 id="painel-vazio" className="text-base">
          O painel ainda está vazio
        </h2>
        <p className="text-texto/70">
          É aqui que a equipe vai cadastrar alunos e turmas e acompanhar os
          períodos contratados e os consentimentos de contato, no lugar da
          planilha. Essas telas chegam nos próximos marcos.
        </p>
      </section>
    </main>
  );
}
