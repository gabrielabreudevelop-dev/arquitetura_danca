"use client";

/**
 * Falha inesperada numa tela do painel (ex.: o banco fora do ar). Nada do
 * erro aparece aqui: a mensagem pode trazer dados de alunos. O servidor já
 * registrou só "Falha no banco de dados." e o código.
 */
export default function ErroPainel({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-start gap-6 px-6 py-12 md:px-12 md:py-16"
    >
      <h1 className="break-words text-titulo">
        Não foi possível carregar esta tela.
      </h1>
      <p className="max-w-prose text-texto-suave">
        Pode ser uma falha passageira. Nada do que você salvou antes se perdeu;
        se estava salvando algo agora, confira se foi gravado depois de tentar
        de novo.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-acao px-6 font-semibold text-fundo hover:bg-acao-escura md:w-auto"
      >
        Tentar de novo
      </button>
    </main>
  );
}
