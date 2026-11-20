import Link from "next/link";

const estiloLink =
  "-mx-2 inline-flex min-h-12 items-center px-2 font-semibold text-link underline decoration-link underline-offset-4 hover:decoration-2";

/** Conteúdo da página "não encontrada", sem moldura (cabeçalho e rodapé vêm do layout). */
export function NaoEncontrada() {
  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 pt-8 pb-16 md:px-12 md:pt-16 md:pb-24"
    >
      <h1 className="text-titulo">Página não encontrada</h1>
      <p className="max-w-prose">
        O endereço pode estar errado, ou a página não existe mais.
      </p>
      <ul className="flex flex-col">
        <li>
          <Link href="/" className={estiloLink}>
            Página inicial
          </Link>
        </li>
        <li>
          <Link href="/grade" className={estiloLink}>
            Grade de horários
          </Link>
        </li>
        <li>
          <Link href="/eventos" className={estiloLink}>
            Eventos
          </Link>
        </li>
      </ul>
    </main>
  );
}
