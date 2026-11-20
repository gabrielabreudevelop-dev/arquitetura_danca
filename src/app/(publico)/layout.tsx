import { Cabecalho } from "./componentes/cabecalho";
import { Rodape } from "./componentes/rodape";

/** Moldura das páginas abertas ao público: cabeçalho, conteúdo e rodapé. */
export default function LayoutPublico({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Cabecalho />
      {children}
      <Rodape />
    </div>
  );
}
