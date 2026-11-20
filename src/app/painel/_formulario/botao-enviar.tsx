"use client";

import { useFormStatus } from "react-dom";

/**
 * Botão principal de envio. Props: `children` (texto normal, ex.: "Salvar") e
 * `carregando` (texto durante o envio, ex.: "Salvando…"). Fica desativado
 * enquanto o formulário envia. Deve estar dentro de um `<form>`.
 */
export function BotaoEnviar({
  children,
  carregando,
}: {
  children: React.ReactNode;
  carregando: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 w-full rounded-sm bg-acao px-6 font-semibold text-fundo hover:bg-acao-escura disabled:cursor-wait disabled:bg-texto-suave md:w-auto"
    >
      {pending ? carregando : children}
    </button>
  );
}
