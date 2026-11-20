import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { obterBanco } from "@/servidor/banco/cliente";
import {
  listarRitmosDaGrade,
  obterGradeDoRitmo,
} from "@/servidor/vitrine/consultas";
import {
  formatarDias,
  formatarHorario,
  urlDaGrade,
} from "@/servidor/vitrine/texto";
import { Filtros } from "../filtros";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Grade de horários" };

type Props = {
  params: Promise<{ ritmo: string }>;
  searchParams: Promise<{ [chave: string]: string | string[] | undefined }>;
};

function primeiro(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

const estiloLink =
  "-mx-2 inline-flex min-h-12 items-center px-2 font-semibold text-link underline decoration-link underline-offset-4 hover:decoration-2";

export default async function GradeDoRitmo({ params, searchParams }: Props) {
  const [{ ritmo: slug }, busca] = await Promise.all([params, searchParams]);
  const db = obterBanco();
  const [grade, ritmos] = await Promise.all([
    obterGradeDoRitmo(db, slug, {
      modulo: primeiro(busca.modulo),
      dia: primeiro(busca.dia),
    }),
    listarRitmosDaGrade(db),
  ]);
  if (!grade) notFound();

  const { ritmo, modulos, turmas, filtrosAplicados } = grade;
  const temFiltro = Boolean(filtrosAplicados.modulo || filtrosAplicados.dia);

  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 pt-4 pb-16 md:px-12 md:pt-8 md:pb-24"
    >
      <h1 className="text-titulo">Grade de horários</h1>

      <nav aria-label="Ritmos">
        <ul className="-mx-2 flex flex-wrap gap-x-2">
          {ritmos.map((r) => (
            <li key={r.slug}>
              <Link
                href={urlDaGrade(r.slug, {})}
                aria-current={r.slug === ritmo.slug ? "page" : undefined}
                className="flex min-h-12 items-center border-transparent border-b-2 px-3 text-texto-suave hover:text-texto aria-[current=page]:border-acao aria-[current=page]:font-semibold aria-[current=page]:text-texto"
              >
                {r.nome}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Filtros
        ritmoSlug={ritmo.slug}
        modulos={modulos}
        modulo={filtrosAplicados.modulo}
        dia={filtrosAplicados.dia}
      />

      {turmas.length === 0 ? (
        <div className="flex max-w-prose flex-col gap-2 border-linha border-t pt-6">
          {temFiltro ? (
            <>
              <p>Nenhuma turma de {ritmo.nome} com esses filtros.</p>
              <Link
                href={urlDaGrade(ritmo.slug, {})}
                className={`${estiloLink} self-start`}
              >
                Limpar filtros
              </Link>
            </>
          ) : (
            <p>Ainda não há turmas de {ritmo.nome} na grade.</p>
          )}
        </div>
      ) : (
        <>
          <ul className="border-linha border-t md:hidden">
            {turmas.map((t) => (
              <li
                key={t.id}
                className="flex flex-col gap-1 border-linha border-b py-4"
              >
                <span className="font-semibold">{t.modulo}</span>
                <span className="text-texto-suave">
                  {formatarDias(t.dias)} ·{" "}
                  {formatarHorario(t.horarioInicio, t.horarioFim)}
                </span>
              </li>
            ))}
          </ul>
          <table className="hidden w-full border-linha border-t text-left md:table">
            <caption className="sr-only">Turmas de {ritmo.nome}</caption>
            <thead>
              <tr className="border-linha border-b">
                <th scope="col" className="w-1/3 py-3 pr-6 font-semibold">
                  Módulo
                </th>
                <th scope="col" className="py-3 pr-6 font-semibold">
                  Dias
                </th>
                <th scope="col" className="py-3 font-semibold">
                  Horário
                </th>
              </tr>
            </thead>
            <tbody>
              {turmas.map((t) => (
                <tr key={t.id} className="border-linha border-b">
                  <th scope="row" className="py-4 pr-6 font-semibold">
                    {t.modulo}
                  </th>
                  <td className="py-4 pr-6">{formatarDias(t.dias)}</td>
                  <td className="py-4">
                    {formatarHorario(t.horarioInicio, t.horarioFim)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
