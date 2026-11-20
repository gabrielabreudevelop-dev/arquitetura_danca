import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { ESTUDIO } from "@/estudio";

/**
 * Imagem de prévia de link (1200x630): fundo `palco`, faixa no degradê do
 * estúdio e Raleway. Usada quando o evento não tem capa e na página inicial.
 * Cores e degradê repetem os tokens de `globals.css` (o next/og não lê CSS).
 */

const PALCO = "#1a1a1a";
const BRANCO = "#ffffff";
const DEGRADE = "linear-gradient(100deg, #f5db53, #f58c23)";

const ARQUIVOS_DE_FONTE = {
  700: "raleway-latin-700-normal.woff",
  400: "raleway-latin-400-normal.woff",
} as const;

// Caminho relativo à raiz do projeto; next.config.ts inclui estes arquivos
// no build standalone (`outputFileTracingIncludes`).
function lerFonte(peso: 700 | 400): Buffer {
  return readFileSync(
    join(
      process.cwd(),
      "node_modules/@fontsource/raleway/files",
      ARQUIVOS_DE_FONTE[peso],
    ),
  );
}

let fontes:
  | { name: string; data: ArrayBuffer; weight: 700 | 400; style: "normal" }[]
  | undefined;

function carregarFontes() {
  if (!fontes) {
    const comoBuffer = (b: Buffer) =>
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
    fontes = ([700, 400] as const).map((peso) => ({
      name: "Raleway",
      data: comoBuffer(lerFonte(peso)),
      weight: peso,
      style: "normal" as const,
    }));
  }
  return fontes;
}

function tamanhoDoTitulo(titulo: string): number {
  if (titulo.length <= 16) return 104;
  if (titulo.length <= 24) return 88;
  if (titulo.length <= 48) return 80;
  return 64;
}

export function imagemPrevia(conteudo: {
  titulo: string;
  linha?: string;
  esgotado?: boolean;
}): ImageResponse {
  const { titulo, linha, esgotado } = conteudo;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: PALCO,
        color: BRANCO,
        fontFamily: "Raleway",
      }}
    >
      <div
        style={{
          display: "flex",
          width: "100%",
          height: 28,
          backgroundImage: DEGRADE,
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: titulo === ESTUDIO.nome ? "center" : "space-between",
          padding: "64px 72px 56px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {esgotado && (
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                border: `3px solid ${BRANCO}`,
                padding: "6px 22px",
                fontSize: 34,
                fontWeight: 700,
              }}
            >
              Esgotado
            </div>
          )}
          <div
            style={{
              display: "block",
              fontSize: tamanhoDoTitulo(titulo),
              fontWeight: 700,
              lineHeight: 1.1,
              lineClamp: 3,
            }}
          >
            {titulo}
          </div>
          {linha && (
            <div style={{ display: "flex", fontSize: 44, fontWeight: 400 }}>
              {linha}
            </div>
          )}
        </div>
        <div style={{ display: "flex", fontSize: 36, fontWeight: 700 }}>
          {titulo === ESTUDIO.nome ? "" : ESTUDIO.nome}
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: carregarFontes(),
      headers: { "Cache-Control": "public, max-age=3600" },
    },
  );
}
