import type { Metadata } from "next";
import localFont from "next/font/local";
import { NOME_ESTUDIO } from "./marca";
import "./globals.css";

// Fontes servidas pelo próprio app (pacotes @fontsource-variable), sem rede no build.
const fonteTexto = localFont({
  src: "../../node_modules/@fontsource-variable/raleway/files/raleway-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--fonte-texto",
  display: "swap",
});

const fonteAssinatura = localFont({
  src: "../../node_modules/@fontsource-variable/dancing-script/files/dancing-script-latin-wght-normal.woff2",
  weight: "400 700",
  variable: "--fonte-assinatura",
  display: "swap",
});

export const metadata: Metadata = {
  title: NOME_ESTUDIO,
  description: "Vídeos dos passos, eventos e comunidade do estúdio.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${fonteTexto.variable} ${fonteAssinatura.variable}`}
    >
      <body>
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-texto focus:px-4 focus:py-3 focus:font-semibold focus:text-fundo"
        >
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
