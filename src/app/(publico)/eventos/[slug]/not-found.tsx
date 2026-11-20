import Link from "next/link";

export default function EventoNaoEncontrado() {
  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 pt-4 pb-16 md:px-12 md:pt-8 md:pb-24"
    >
      <h1 className="text-titulo">Não encontramos esse evento.</h1>
      <p className="max-w-prose text-texto-suave">
        Ele pode ter sido retirado ou o endereço pode estar incompleto.
      </p>
      <Link
        href="/eventos"
        className="-mx-2 inline-flex min-h-12 items-center self-start px-2 font-semibold text-link underline decoration-link underline-offset-4 hover:decoration-2"
      >
        Ver os próximos eventos
      </Link>
    </main>
  );
}
