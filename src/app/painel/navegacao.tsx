"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const INICIO = { href: "/painel", rotulo: "Início" };
const CADASTROS = [
  { href: "/painel/eventos", rotulo: "Eventos" },
  { href: "/painel/turmas", rotulo: "Turmas" },
  { href: "/painel/ritmos", rotulo: "Ritmos" },
  { href: "/painel/modulos", rotulo: "Módulos" },
  { href: "/painel/professores", rotulo: "Professores" },
];

/** Navegação do painel. Os cadastros só aparecem para a administração. */
export function Navegacao({ administracao }: { administracao: boolean }) {
  const caminho = usePathname();
  const itens = administracao ? [INICIO, ...CADASTROS] : [INICIO];
  return (
    <nav aria-label="Painel" className="min-w-0">
      <ul className="-mx-2 flex flex-wrap gap-x-2 lg:flex-nowrap">
        {itens.map(({ href, rotulo }) => {
          const atual =
            href === "/painel"
              ? caminho === href
              : caminho === href || caminho.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={atual ? "page" : undefined}
                className="flex min-h-12 items-center border-transparent border-b-2 px-3 text-texto-suave hover:text-texto aria-[current=page]:border-acao aria-[current=page]:font-semibold aria-[current=page]:text-texto"
              >
                {rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
