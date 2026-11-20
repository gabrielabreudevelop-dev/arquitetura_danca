import { Marca } from "../../marca";
import { NavegacaoPublica } from "./navegacao-publica";

/** Cabeçalho das páginas públicas: a marca e links discretos (grade, eventos e "Entrar", para a equipe). */
export function Cabecalho() {
  return (
    <header className="mx-auto flex min-h-16 w-full max-w-5xl items-center justify-between gap-2 px-6 md:px-12">
      <Marca />
      <NavegacaoPublica />
    </header>
  );
}
