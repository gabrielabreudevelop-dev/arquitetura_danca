"use client";

import { useEffect, useRef, useState } from "react";

const estiloAcao =
  "-mx-2 inline-flex min-h-12 items-center px-2 font-semibold text-link underline decoration-link underline-offset-4 hover:decoration-2";

/**
 * "Compartilhar no WhatsApp" e "Copiar link". Se o navegador não deixar
 * copiar, mostra o endereço já selecionado para o visitante copiar à mão.
 */
export function Compartilhar({
  url,
  hrefWhatsapp,
}: {
  url: string;
  hrefWhatsapp: string;
}) {
  const [estado, setEstado] = useState<"parado" | "copiado" | "manual">(
    "parado",
  );
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (estado === "manual") campo.current?.select();
    if (estado === "copiado") {
      const t = setTimeout(() => setEstado("parado"), 3000);
      return () => clearTimeout(t);
    }
  }, [estado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setEstado("copiado");
    } catch {
      // Sem permissão ou sem clipboard (ex.: página sem HTTPS).
      setEstado("manual");
      campo.current?.select();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-8">
        <a
          href={hrefWhatsapp}
          target="_blank"
          rel="noopener"
          className={estiloAcao}
        >
          Compartilhar no WhatsApp
        </a>
        <button type="button" onClick={copiar} className={estiloAcao}>
          Copiar link
        </button>
        <output className="font-semibold text-sucesso">
          {estado === "copiado" ? "Link copiado" : ""}
        </output>
      </div>
      {estado === "manual" && (
        <div className="flex max-w-prose flex-col gap-1">
          <label
            htmlFor="endereco-evento"
            className="text-pequeno text-texto-suave"
          >
            Não foi possível copiar sozinho. Copie o endereço:
          </label>
          <input
            id="endereco-evento"
            ref={campo}
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="min-h-12 w-full rounded-sm border border-borda bg-fundo px-3 text-base"
          />
        </div>
      )}
    </div>
  );
}
