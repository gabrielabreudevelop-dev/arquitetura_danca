import Link from "next/link";

import { ESTUDIO } from "@/estudio";

/** Nome do estúdio; o valor vive em `src/estudio.ts`. */
export const NOME_ESTUDIO = ESTUDIO.nome;

/** Marca do estúdio (o nome em Dancing Script, até o logo chegar), levando para a página indicada. */
export function Marca({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="-mx-2 inline-flex min-h-12 items-center px-2 font-assinatura font-semibold text-base"
    >
      {NOME_ESTUDIO}
    </Link>
  );
}
