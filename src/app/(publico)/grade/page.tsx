import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ESTUDIO } from "@/estudio";
import { obterBanco } from "@/servidor/banco/cliente";
import { listarRitmosDaGrade } from "@/servidor/vitrine/consultas";
import { urlDaGrade } from "@/servidor/vitrine/texto";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Grade de horários" };

/** /grade abre no primeiro ritmo; sem ritmos, mostra o estado vazio. */
export default async function Grade() {
  const ritmos = await listarRitmosDaGrade(obterBanco());
  const primeiro = ritmos[0];
  if (primeiro) redirect(urlDaGrade(primeiro.slug, {}));

  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 pt-4 pb-16 md:px-12 md:pt-8 md:pb-24"
    >
      <h1 className="text-titulo">Grade de horários</h1>
      <div className="flex max-w-prose flex-col gap-2 border-linha border-t pt-6">
        <h2 className="text-base">A grade será publicada em breve</h2>
        <p className="text-texto-suave">
          Assim que as turmas forem cadastradas, os dias e horários aparecem
          aqui.
        </p>
        <a
          href={ESTUDIO.instagram.url}
          className="-mx-2 inline-flex min-h-12 items-center self-start px-2 font-semibold text-link underline decoration-link underline-offset-4 hover:decoration-2"
        >
          Acompanhe as novidades no Instagram
        </a>
      </div>
    </main>
  );
}
