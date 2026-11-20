import { and, asc, eq, gte, inArray, or } from "drizzle-orm";
import type { Banco } from "@/servidor/banco/cliente";
import {
  eventos,
  imagens,
  modulos,
  ritmos,
  turmaDias,
  turmas,
} from "@/servidor/banco/esquema";
import { eventoJaPassou } from "./eventos";
import { DIAS_SEMANA, gerarSlug } from "./texto";

/**
 * Consultas públicas da vitrine. Selecionam colunas explicitamente e nunca
 * tocam em professor ou pessoa: os tipos devolvidos não têm campo de pessoa.
 */

export type EventoPublico = {
  id: string;
  titulo: string;
  slug: string;
  descricao: string | null;
  local: string | null;
  inicio: Date;
  fim: Date | null;
  preco: string | null;
  linkIngresso: string | null;
  esgotado: boolean;
  capa: { id: string; largura: number; altura: number } | null;
};

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/** Ritmos ativos com ao menos uma turma ativa em módulo ativo, pela ordem. */
export async function listarRitmosDaGrade(
  db: Banco,
): Promise<{ nome: string; slug: string }[]> {
  const linhas = await db
    .selectDistinct({
      nome: ritmos.nome,
      slug: ritmos.slug,
      ordem: ritmos.ordem,
    })
    .from(ritmos)
    .innerJoin(turmas, eq(turmas.ritmoId, ritmos.id))
    .innerJoin(modulos, eq(modulos.id, turmas.moduloId))
    .where(
      and(
        eq(ritmos.ativo, true),
        eq(turmas.ativa, true),
        eq(modulos.ativo, true),
      ),
    )
    .orderBy(asc(ritmos.ordem), asc(ritmos.nome));
  return linhas.map(({ nome, slug }) => ({ nome, slug }));
}

type Grade = {
  ritmo: { nome: string; slug: string };
  modulos: { nome: string; slug: string }[];
  turmas: {
    id: string;
    modulo: string;
    dias: number[];
    horarioInicio: string;
    horarioFim: string;
  }[];
  filtrosAplicados: { modulo?: string; dia?: string };
};

/** Grade de um ritmo ativo; `null` se não existe ou está desativado. */
export async function obterGradeDoRitmo(
  db: Banco,
  slug: string,
  filtros: { modulo?: string; dia?: string },
): Promise<Grade | null> {
  const [ritmo] = await db
    .select({ id: ritmos.id, nome: ritmos.nome, slug: ritmos.slug })
    .from(ritmos)
    .where(and(eq(ritmos.slug, slug), eq(ritmos.ativo, true)))
    .limit(1);
  if (!ritmo) return null;

  const linhas = await db
    .select({
      id: turmas.id,
      modulo: modulos.nome,
      moduloOrdem: modulos.ordem,
      horarioInicio: turmas.horarioInicio,
      horarioFim: turmas.horarioFim,
    })
    .from(turmas)
    .innerJoin(modulos, eq(modulos.id, turmas.moduloId))
    .where(
      and(
        eq(turmas.ritmoId, ritmo.id),
        eq(turmas.ativa, true),
        eq(modulos.ativo, true),
      ),
    );

  const diasPorTurma = new Map<string, number[]>();
  if (linhas.length > 0) {
    const dias = await db
      .select({ turmaId: turmaDias.turmaId, diaSemana: turmaDias.diaSemana })
      .from(turmaDias)
      .where(
        inArray(
          turmaDias.turmaId,
          linhas.map((l) => l.id),
        ),
      );
    for (const { turmaId, diaSemana } of dias) {
      diasPorTurma.set(turmaId, [
        ...(diasPorTurma.get(turmaId) ?? []),
        diaSemana,
      ]);
    }
  }

  const todas = linhas.map((l) => ({
    ...l,
    dias: (diasPorTurma.get(l.id) ?? []).sort((a, b) => a - b),
  }));

  const modulosDoRitmo = new Map<string, { nome: string; ordem: number }>();
  for (const t of todas) {
    modulosDoRitmo.set(t.modulo, { nome: t.modulo, ordem: t.moduloOrdem });
  }
  const listaModulos = [...modulosDoRitmo.values()]
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))
    .map(({ nome }) => ({ nome, slug: gerarSlug(nome) }));

  const filtrosAplicados: { modulo?: string; dia?: string } = {};
  const dia = DIAS_SEMANA.find((d) => d.curto === filtros.dia);
  if (dia) filtrosAplicados.dia = dia.curto;
  const modulo = listaModulos.find((m) => m.slug === filtros.modulo);
  if (modulo) filtrosAplicados.modulo = modulo.slug;

  const turmasFiltradas = todas
    .filter((t) => !dia || t.dias.includes(dia.numero))
    .filter((t) => !modulo || gerarSlug(t.modulo) === modulo.slug)
    .sort(
      (a, b) =>
        a.moduloOrdem - b.moduloOrdem ||
        (a.dias[0] ?? 7) - (b.dias[0] ?? 7) ||
        a.horarioInicio.localeCompare(b.horarioInicio),
    )
    .map(({ id, modulo: nome, dias, horarioInicio, horarioFim }) => ({
      id,
      modulo: nome,
      dias,
      horarioInicio,
      horarioFim,
    }));

  return {
    ritmo: { nome: ritmo.nome, slug: ritmo.slug },
    modulos: listaModulos,
    turmas: turmasFiltradas,
    filtrosAplicados,
  };
}

const colunasEvento = {
  id: eventos.id,
  titulo: eventos.titulo,
  slug: eventos.slug,
  descricao: eventos.descricao,
  local: eventos.local,
  inicio: eventos.inicio,
  fim: eventos.fim,
  preco: eventos.preco,
  linkIngresso: eventos.linkIngresso,
  esgotado: eventos.esgotado,
  capaId: imagens.id,
  capaLargura: imagens.largura,
  capaAltura: imagens.altura,
};

type LinhaEvento = {
  id: string;
  titulo: string;
  slug: string;
  descricao: string | null;
  local: string | null;
  inicio: Date;
  fim: Date | null;
  preco: string | null;
  linkIngresso: string | null;
  esgotado: boolean;
  capaId: string | null;
  capaLargura: number | null;
  capaAltura: number | null;
};

function paraEventoPublico(l: LinhaEvento): EventoPublico {
  return {
    id: l.id,
    titulo: l.titulo,
    slug: l.slug,
    descricao: l.descricao,
    local: l.local,
    inicio: l.inicio,
    fim: l.fim,
    preco: l.preco,
    linkIngresso: l.linkIngresso,
    esgotado: l.esgotado,
    capa:
      l.capaId && l.capaLargura !== null && l.capaAltura !== null
        ? { id: l.capaId, largura: l.capaLargura, altura: l.capaAltura }
        : null,
  };
}

/** Eventos publicados que ainda não passaram, em ordem de início. */
export async function listarProximosEventos(
  db: Banco,
  agora: Date,
): Promise<EventoPublico[]> {
  // Corte grosseiro no SQL; a regra de "passou" vem só de eventoJaPassou.
  const corte = new Date(agora.getTime() - UM_DIA_MS);
  const linhas = await db
    .select(colunasEvento)
    .from(eventos)
    .leftJoin(imagens, eq(imagens.id, eventos.capaId))
    .where(
      and(
        eq(eventos.publicado, true),
        or(gte(eventos.inicio, corte), gte(eventos.fim, agora)),
      ),
    )
    .orderBy(asc(eventos.inicio), asc(eventos.id));
  return linhas.filter((l) => !eventoJaPassou(l, agora)).map(paraEventoPublico);
}

export async function proximoEvento(
  db: Banco,
  agora: Date,
): Promise<EventoPublico | null> {
  return (await listarProximosEventos(db, agora))[0] ?? null;
}

/** Evento publicado pelo slug (inclusive os que já passaram); senão `null`. */
export async function obterEventoPublico(
  db: Banco,
  slug: string,
  agora: Date,
): Promise<(EventoPublico & { passou: boolean }) | null> {
  const [linha] = await db
    .select(colunasEvento)
    .from(eventos)
    .leftJoin(imagens, eq(imagens.id, eventos.capaId))
    .where(and(eq(eventos.slug, slug), eq(eventos.publicado, true)))
    .limit(1);
  if (!linha) return null;
  return { ...paraEventoPublico(linha), passou: eventoJaPassou(linha, agora) };
}
