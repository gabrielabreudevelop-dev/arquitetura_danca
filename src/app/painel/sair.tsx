"use client";

import { createAuthClient } from "better-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const clienteAuth = createAuthClient();

export function BotaoSair() {
  const roteador = useRouter();
  const [saindo, setSaindo] = useState(false);
  return (
    <button
      type="button"
      disabled={saindo}
      className="-mx-2 min-h-12 px-2 text-link underline decoration-link underline-offset-4 hover:decoration-2 disabled:cursor-wait disabled:text-texto-suave"
      onClick={async () => {
        setSaindo(true);
        await clienteAuth.signOut();
        roteador.push("/entrar");
        roteador.refresh();
      }}
    >
      {saindo ? "Saindo…" : "Sair"}
    </button>
  );
}
