"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/grade", rotulo: "Grade" },
  { href: "/eventos", rotulo: "Eventos" },
  { href: "/entrar", rotulo: "Entrar" },
] as const;

/** Links discretos do cabeçalho público; o da seção atual leva aria-current. */
export function NavegacaoPublica() {
  const caminho = usePathname();
  return (
    <nav aria-label="Principal">
      <ul className="flex items-center">
        {LINKS.map(({ href, rotulo }) => {
          const atual = caminho === href || caminho.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={atual ? "page" : undefined}
                className="inline-flex min-h-12 items-center px-2 text-pequeno text-texto-suave underline decoration-linha underline-offset-4 hover:text-texto hover:decoration-texto aria-[current=page]:font-semibold aria-[current=page]:text-texto aria-[current=page]:decoration-texto"
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
