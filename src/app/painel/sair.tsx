"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { clienteAuth } from "../cliente-auth";

export function BotaoSair() {
  const roteador = useRouter();
  const [saindo, setSaindo] = useState(false);
  const [falhou, setFalhou] = useState(false);

  async function sair() {
    setSaindo(true);
    setFalhou(false);
    try {
      const { error } = await clienteAuth.signOut();
      if (error) throw new Error(error.message);
    } catch {
      setSaindo(false);
      setFalhou(true);
      return;
    }
    roteador.push("/entrar");
    roteador.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4">
      {falhou && (
        <p role="alert" className="text-pequeno text-erro">
          Não foi possível sair. Tente de novo.
        </p>
      )}
      <button
        type="button"
        disabled={saindo}
        className="-mx-2 min-h-12 px-2 text-link underline decoration-link underline-offset-4 hover:decoration-2 disabled:cursor-wait disabled:text-texto-suave"
        onClick={sair}
      >
        {saindo ? "Saindo…" : "Sair"}
      </button>
    </div>
  );
}
