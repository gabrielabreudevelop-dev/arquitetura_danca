import Link from "next/link";

/**
 * Nome provisório do estúdio. Trocar aqui quando a trilha T2 entregar o nome
 * definitivo (decisão D4); é o único lugar do código onde ele aparece.
 */
export const NOME_ESTUDIO = "Arquitetura da Dança";

/** Marca textual do estúdio, sempre levando para a página indicada. */
export function Marca({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="-mx-2 inline-flex min-h-12 items-center px-2 font-semibold font-titulo text-base uppercase tracking-wide"
    >
      {NOME_ESTUDIO}
    </Link>
  );
}
