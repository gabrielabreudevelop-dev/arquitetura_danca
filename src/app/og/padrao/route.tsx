import { ESTUDIO } from "@/estudio";
import { imagemPrevia } from "@/servidor/vitrine/imagem-previa";

export const runtime = "nodejs";

/** Imagem de prévia da página inicial e da grade. */
export function GET() {
  return imagemPrevia({
    titulo: ESTUDIO.nome,
    linha: "A dança é a linguagem escondida da alma.",
  });
}
