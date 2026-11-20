import Link from "next/link";
import { Marca } from "../../marca";

/** Cabeçalho das páginas públicas: a marca e um "Entrar" discreto, para a equipe. */
export function Cabecalho() {
  return (
    <header className="mx-auto flex min-h-16 w-full max-w-5xl items-center justify-between gap-4 px-6 md:px-12">
      <Marca />
      <Link
        href="/entrar"
        className="-mx-2 inline-flex min-h-12 items-center px-2 text-pequeno text-texto-suave underline decoration-linha underline-offset-4 hover:text-texto hover:decoration-texto"
      >
        Entrar
      </Link>
    </header>
  );
}
