"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  href: string;
  rotulo: string;
  /** Outros caminhos em que o item também fica marcado como atual. */
  tambem?: string[];
};

const INICIO: Item = { href: "/painel", rotulo: "Início" };
/** Os cadastros da vitrine (M1) ficam agrupados em "Vitrine" para a navegação caber no celular. */
const ADMINISTRACAO: Item[] = [
  { href: "/painel/alunos", rotulo: "Alunos" },
  { href: "/painel/contatos", rotulo: "Contatos" },
  { href: "/painel/configuracoes", rotulo: "Configurações" },
  {
    href: "/painel/vitrine",
    rotulo: "Vitrine",
    tambem: [
      "/painel/eventos",
      "/painel/turmas",
      "/painel/ritmos",
      "/painel/modulos",
      "/painel/professores",
    ],
  },
];

function dentroDe(caminho: string, href: string): boolean {
  return caminho === href || caminho.startsWith(`${href}/`);
}

/** Navegação do painel. Alunos, contatos, configurações e vitrine só aparecem para a administração. */
export function Navegacao({ administracao }: { administracao: boolean }) {
  const caminho = usePathname();
  const itens = administracao ? [INICIO, ...ADMINISTRACAO] : [INICIO];
  return (
    <nav aria-label="Painel" className="min-w-0">
      <ul className="-mx-2 flex flex-wrap gap-x-2 lg:flex-nowrap">
        {itens.map(({ href, rotulo, tambem = [] }) => {
          const atual =
            href === "/painel"
              ? caminho === href
              : [href, ...tambem].some((h) => dentroDe(caminho, h));
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
