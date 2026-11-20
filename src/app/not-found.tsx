import { Cabecalho } from "./(publico)/componentes/cabecalho";
import { NaoEncontrada } from "./(publico)/componentes/nao-encontrada";
import { Rodape } from "./(publico)/componentes/rodape";

/** Endereços que não existem em lugar nenhum: a mesma página, com a moldura pública. */
export default function NaoEncontradaGeral() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Cabecalho />
      <NaoEncontrada />
      <Rodape />
    </div>
  );
}
