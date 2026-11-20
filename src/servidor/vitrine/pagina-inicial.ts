import type { Banco } from "@/servidor/banco/cliente";
import {
  type EventoPublico,
  listarProximosEventos,
  listarRitmosDaGrade,
} from "./consultas";

export type PaginaInicial = {
  /** O próximo evento publicado que ainda não passou, ou `null`. */
  destaque: EventoPublico | null;
  /** Quantos outros eventos futuros existem além do destaque. */
  outrosEventos: number;
  ritmos: { nome: string; slug: string }[];
};

/** Dados da página inicial pública, num formato que a página só desenha. */
export async function montarPaginaInicial(
  db: Banco,
  agora: Date,
): Promise<PaginaInicial> {
  const [eventos, ritmos] = await Promise.all([
    listarProximosEventos(db, agora),
    listarRitmosDaGrade(db),
  ]);
  return {
    destaque: eventos[0] ?? null,
    outrosEventos: Math.max(eventos.length - 1, 0),
    ritmos,
  };
}
