import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arquitetura da Dança",
  description: "Vídeos dos passos, eventos e comunidade do estúdio.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
