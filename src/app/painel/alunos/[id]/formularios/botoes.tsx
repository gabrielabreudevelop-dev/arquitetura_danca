"use client";

import { useFormStatus } from "react-dom";

const SECUNDARIO =
  "min-h-12 w-full rounded-sm border border-acao px-6 font-semibold text-link hover:bg-acao hover:text-fundo disabled:cursor-wait disabled:border-texto-suave disabled:text-texto-suave md:w-auto";
const PERIGO =
  "min-h-12 w-full rounded-sm border border-erro px-6 font-semibold text-erro hover:bg-erro hover:text-fundo disabled:cursor-wait disabled:border-texto-suave disabled:text-texto-suave md:w-auto";
const PERIGO_CHEIO =
  "min-h-12 w-full rounded-sm bg-erro px-6 font-semibold text-fundo underline-offset-4 hover:underline disabled:cursor-wait disabled:bg-texto-suave md:w-auto";

/**
 * Envio com outro visual que o do botão principal: `secundario` (contorno
 * rosa), `perigo` (contorno vermelho) ou `perigoCheio` (confirmação de algo
 * que não se desfaz). Desativado e com `carregando` durante o envio.
 */
export function BotaoEnvio({
  children,
  carregando,
  visual,
}: {
  children: React.ReactNode;
  carregando: string;
  visual: "secundario" | "perigo" | "perigoCheio";
}) {
  const { pending } = useFormStatus();
  const classe =
    visual === "secundario"
      ? SECUNDARIO
      : visual === "perigo"
        ? PERIGO
        : PERIGO_CHEIO;
  return (
    <button type="submit" disabled={pending} className={classe}>
      {pending ? carregando : children}
    </button>
  );
}

/** Conta mostrada perto do botão ("Fim passa de 08/12 para 12/12"); anunciada ao mudar. */
export function Conta({ texto }: { texto: string | null }) {
  return (
    <p aria-live="polite" className="min-h-6 text-texto-suave">
      {texto}
    </p>
  );
}
