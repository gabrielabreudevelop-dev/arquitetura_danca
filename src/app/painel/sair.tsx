"use client";

import { createAuthClient } from "better-auth/react";
import { useRouter } from "next/navigation";

const clienteAuth = createAuthClient();

export function BotaoSair() {
  const roteador = useRouter();
  return (
    <button
      type="button"
      className="rounded border px-3 py-2"
      onClick={async () => {
        await clienteAuth.signOut();
        roteador.push("/entrar");
        roteador.refresh();
      }}
    >
      Sair
    </button>
  );
}
