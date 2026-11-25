import Link from "next/link";
import { exigirAdministracao } from "@/servidor/auth/acesso";

export const dynamic = "force-dynamic";

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

/** Os cadastros da vitrine (o que aparece no site do estúdio), num lugar só. */
export default async function Vitrine() {
  await exigirAdministracao();
  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12 md:px-12 md:py-16"
    >
      <div className="flex max-w-prose flex-col gap-2">
        <h1 className="text-titulo">Vitrine</h1>
        <p className="text-texto-suave">
          O que aparece no site do estúdio: eventos, grade de horários e quem dá
          as aulas.
        </p>
      </div>
      <ul className="flex max-w-prose flex-col">
        {ATALHOS.map(({ href, rotulo, descricao }) => (
          <li key={href} className="border-linha border-b first:border-t">
            <Link
              href={href}
              className="flex min-h-12 flex-col justify-center gap-1 py-3 hover:bg-fundo-suave md:flex-row md:items-center md:justify-between md:gap-6"
            >
              <span className="font-semibold text-link underline decoration-link underline-offset-4">
                {rotulo}
              </span>
              <span className="text-pequeno text-texto-suave">{descricao}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
