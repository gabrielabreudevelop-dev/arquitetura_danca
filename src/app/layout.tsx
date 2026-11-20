import type { Metadata } from "next";
import localFont from "next/font/local";
import { NOME_ESTUDIO } from "./marca";
import "./globals.css";

// Fontes servidas pelo próprio app (pacotes @fontsource-variable), sem rede no build.
const fonteTitulo = localFont({
  src: "../../node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2",
  weight: "100 900",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
  variable: "--fonte-titulo",
  display: "swap",
});

const fonteTexto = localFont({
  src: "../../node_modules/@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2",
  weight: "200 800",
  variable: "--fonte-texto",
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
      className={`${fonteTitulo.variable} ${fonteTexto.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
