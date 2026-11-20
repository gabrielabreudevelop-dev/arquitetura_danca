"use client";

import { useFormStatus } from "react-dom";
import { alternarEsgotadoAcao } from "./acoes";

function Botao({ esgotado, titulo }: { esgotado: boolean; titulo: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={`${esgotado ? "Reabrir ingressos" : "Marcar como esgotado"}: ${titulo}`}
      className="-mx-2 min-h-12 px-2 text-left font-semibold text-link underline decoration-link underline-offset-4 disabled:cursor-wait disabled:text-texto-suave disabled:no-underline"
    >
      {pending
        ? "Salvando…"
        : esgotado
          ? "Reabrir ingressos"
          : "Marcar como esgotado"}
    </button>
  );
}

/** Botão da lista: alterna "esgotado" sem abrir o formulário. */
export function AlternarEsgotado({
  id,
  esgotado,
  titulo,
}: {
  id: string;
  esgotado: boolean;
  titulo: string;
}) {
  return (
    <form action={alternarEsgotadoAcao}>
      <input type="hidden" name="id" value={id} />
      <Botao esgotado={esgotado} titulo={titulo} />
    </form>
  );
}
