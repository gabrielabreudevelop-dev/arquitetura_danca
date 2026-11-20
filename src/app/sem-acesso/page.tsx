import Link from "next/link";
import { Marca } from "../marca";

export default function SemAcesso() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6">
      <header className="flex min-h-16 items-center">
        <Marca />
      </header>

      <main
        id="conteudo"
        className="flex flex-1 flex-col justify-center gap-8 py-12"
      >
        <div className="flex flex-col gap-2">
          <h1 className="text-titulo">Sem acesso</h1>
          <p>Você não tem permissão para ver esta página.</p>
          <p className="text-texto-suave">
            Se acha que deveria ter, fale com a administração do estúdio.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-sm border border-acao px-6 font-semibold text-link hover:bg-acao hover:text-fundo"
        >
          Voltar ao início
        </Link>
      </main>
    </div>
  );
}
