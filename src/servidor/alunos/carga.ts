/**
 * Carga única dos alunos: tudo o que o dash, a lista de alunos, as listas de
 * contato e a ficha precisam, com no máximo uma consulta por tabela. O estado
 * do período sai de `calcularEstado`; filtros e contagens ficam em `listas.ts`.
 */
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  ajustesPeriodo,
  matriculas,
  modulos,
  periodosContratados,
  pessoaPapeis,
  pessoas,
  planos,
  responsabilidades,
  ritmos,
  trancamentos,
  turmaDias,
  turmas,
} from "../banco/esquema";
import { ehUuid } from "../cadastros/comum";
import {
  carregarContatos,
  type PessoaDeContato,
  pessoaDeContato,
  type UltimoContato,
} from "../contatos/pessoa-de-contato";
import { formatarDias, formatarHora } from "../vitrine/texto";
import type { Executor } from "./cadastro";
import { type DataIso, ehMenor } from "./datas";
import {
  calcularEstado,
  type PeriodoParaEstado,
  type ResumoPeriodo,
  type TrancamentoParaEstado,
  ultimoPeriodo,
} from "./estado";

export type { PessoaDeContato, UltimoContato };

export type MatriculaAberta = {
  matriculaId: string;
  turmaId: string;
  entrada: DataIso;
  ritmoId: string;
  ritmo: string;
  moduloId: string;
  modulo: string;
  professorId: string;
  professor: string;
  /** Dias da semana em ordem (0 = domingo). */
  dias: number[];
  horarioInicio: string;
  /** Ex.: "Forró Iniciante · ter e qui 19h". */
  rotulo: string;
};

export type AlunoCarregado = {
  id: string;
  nome: string;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  nascimento: DataIso;
  menor: boolean;
  encerrado: boolean;
  responsavel: {
    id: string;
    nome: string;
    whatsapp: string | null;
    email: string | null;
  } | null;
  matriculas: MatriculaAberta[];
  periodos: PeriodoParaEstado[];
  trancamentos: TrancamentoParaEstado[];
  /** Nome do plano do último período (nulo sem período ou se veio de transferência). */
  planoUltimo: string | null;
  resumo: ResumoPeriodo;
  contato: PessoaDeContato;
  /** Último contato de listas de aluno (o que a linha mostra e o resultado usa). */
  ultimoContato: UltimoContato | null;
  /** Último contato de qualquer lista, inclusive de bolsista (aviso de contato recente). */
  ultimoContatoGeral: UltimoContato | null;
};

/** Rótulo da turma: "Forró Iniciante · ter e qui 19h". */
export function rotuloDaTurma(t: {
  ritmo: string;
  modulo: string;
  dias: number[];
  horarioInicio: string;
}): string {
  return `${t.ritmo} ${t.modulo} · ${formatarDias(t.dias)} ${formatarHora(t.horarioInicio)}`;
}

type Responsavel = NonNullable<AlunoCarregado["responsavel"]>;

function agrupar<T>(linhas: T[], chave: (l: T) => string): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const l of linhas) {
    const k = chave(l);
    const lista = mapa.get(k);
    if (lista) lista.push(l);
    else mapa.set(k, [l]);
  }
  return mapa;
}

/**
 * Todos os alunos (papel `aluno`, ativo ou encerrado) ou só os `ids` pedidos
 * (ids que não são uuid são ignorados), em ordem de nome.
 */
export async function carregarAlunos(
  db: Executor,
  hoje: DataIso,
  opcoes: { ids?: string[] } = {},
): Promise<AlunoCarregado[]> {
  const ids = opcoes.ids
    ? [...new Set(opcoes.ids.filter(ehUuid).map((id) => id.toLowerCase()))]
    : null;
  if (ids?.length === 0) return [];
  // Filtro por aluno nas tabelas que têm a coluna; sem `ids`, tudo.
  const doAluno = (coluna: Parameters<typeof inArray>[0]) =>
    ids ? inArray(coluna, ids) : undefined;

  const linhasAlunos = await db
    .select({
      id: pessoas.id,
      nome: pessoas.nome,
      whatsapp: pessoas.whatsapp,
      email: pessoas.email,
      instagram: pessoas.instagram,
      nascimento: pessoas.dataNascimento,
      ativo: pessoaPapeis.ativo,
    })
    .from(pessoas)
    .innerJoin(
      pessoaPapeis,
      and(
        eq(pessoaPapeis.pessoaId, pessoas.id),
        eq(pessoaPapeis.papel, "aluno"),
      ),
    )
    .where(doAluno(pessoas.id));
  if (linhasAlunos.length === 0) return [];

  const responsavel = alias(pessoas, "responsavel");
  const linhasResponsaveis = await db
    .select({
      alunoId: responsabilidades.alunoId,
      id: responsavel.id,
      nome: responsavel.nome,
      whatsapp: responsavel.whatsapp,
      email: responsavel.email,
    })
    .from(responsabilidades)
    .innerJoin(responsavel, eq(responsavel.id, responsabilidades.responsavelId))
    .where(doAluno(responsabilidades.alunoId))
    .orderBy(asc(responsavel.nome), asc(responsavel.id));

  const professor = alias(pessoas, "professor");
  const linhasMatriculas = await db
    .select({
      alunoId: matriculas.alunoId,
      matriculaId: matriculas.id,
      turmaId: turmas.id,
      entrada: matriculas.entrada,
      ritmoId: ritmos.id,
      ritmo: ritmos.nome,
      moduloId: modulos.id,
      modulo: modulos.nome,
      professorId: professor.id,
      professor: professor.nome,
      dias: sql<
        number[]
      >`coalesce(array_agg(${turmaDias.diaSemana} order by ${turmaDias.diaSemana}) filter (where ${turmaDias.diaSemana} is not null), '{}')`,
      horarioInicio: turmas.horarioInicio,
    })
    .from(matriculas)
    .innerJoin(turmas, eq(turmas.id, matriculas.turmaId))
    .innerJoin(ritmos, eq(ritmos.id, turmas.ritmoId))
    .innerJoin(modulos, eq(modulos.id, turmas.moduloId))
    .innerJoin(professor, eq(professor.id, turmas.professorId))
    .leftJoin(turmaDias, eq(turmaDias.turmaId, turmas.id))
    .where(and(isNull(matriculas.saida), doAluno(matriculas.alunoId)))
    .groupBy(matriculas.id, turmas.id, ritmos.id, modulos.id, professor.id)
    .orderBy(
      asc(ritmos.ordem),
      asc(ritmos.nome),
      asc(modulos.ordem),
      asc(turmas.horarioInicio),
      asc(turmas.id),
    );

  const linhasPeriodos = await db
    .select({
      alunoId: periodosContratados.alunoId,
      id: periodosContratados.id,
      inicio: periodosContratados.inicio,
      fim: periodosContratados.fim,
      diasAjustes:
        sql<number>`coalesce(sum(${ajustesPeriodo.dias}) filter (where ${ajustesPeriodo.anuladoEm} is null), 0)`.mapWith(
          Number,
        ),
      plano: planos.nome,
    })
    .from(periodosContratados)
    .leftJoin(
      ajustesPeriodo,
      eq(ajustesPeriodo.periodoId, periodosContratados.id),
    )
    .leftJoin(planos, eq(planos.id, periodosContratados.planoId))
    .where(
      and(
        isNull(periodosContratados.anuladoEm),
        doAluno(periodosContratados.alunoId),
      ),
    )
    .groupBy(periodosContratados.id, planos.id)
    .orderBy(asc(periodosContratados.inicio));

  const linhasTrancamentos = await db
    .select({
      alunoId: periodosContratados.alunoId,
      id: trancamentos.id,
      periodoId: trancamentos.periodoId,
      inicio: trancamentos.inicio,
      volta: trancamentos.volta,
    })
    .from(trancamentos)
    .innerJoin(
      periodosContratados,
      eq(periodosContratados.id, trancamentos.periodoId),
    )
    .where(
      and(
        isNull(trancamentos.anuladoEm),
        isNull(periodosContratados.anuladoEm),
        doAluno(periodosContratados.alunoId),
      ),
    )
    .orderBy(asc(trancamentos.inicio));

  const responsaveisPorAluno = agrupar(linhasResponsaveis, (r) => r.alunoId);
  const base = linhasAlunos.map((p) => {
    const nascimento = p.nascimento ?? "";
    const menor = nascimento !== "" && ehMenor(nascimento, hoje);
    const r = responsaveisPorAluno.get(p.id)?.[0];
    const responsavelDoAluno: Responsavel | null = r
      ? { id: r.id, nome: r.nome, whatsapp: r.whatsapp, email: r.email }
      : null;
    return {
      p,
      nascimento,
      menor,
      responsavel: responsavelDoAluno,
      contato: pessoaDeContato(
        { id: p.id, nome: p.nome, whatsapp: p.whatsapp, menor },
        responsavelDoAluno,
      ),
    };
  });

  // Bloqueios e contatos são da pessoa de contato (o aluno ou o responsável).
  const idsDeContato = ids
    ? [...new Set(base.map((b) => b.contato.pessoaId))]
    : null;
  const { bloqueados, ultimoPorPessoa, recentePorPessoa } =
    await carregarContatos(db, idsDeContato, "aluno");

  const matriculasPorAluno = agrupar(linhasMatriculas, (m) => m.alunoId);
  const periodosPorAluno = agrupar(linhasPeriodos, (p) => p.alunoId);
  const trancamentosPorAluno = agrupar(linhasTrancamentos, (t) => t.alunoId);

  const alunos = base.map(
    ({ p, nascimento, menor, responsavel: resp, contato }): AlunoCarregado => {
      const encerrado = !p.ativo;
      const linhasP = periodosPorAluno.get(p.id) ?? [];
      const periodos: PeriodoParaEstado[] = linhasP.map((l) => ({
        id: l.id,
        inicio: l.inicio,
        fim: l.fim,
        diasAjustes: l.diasAjustes,
      }));
      const listaTrancamentos: TrancamentoParaEstado[] = (
        trancamentosPorAluno.get(p.id) ?? []
      ).map((t) => ({
        id: t.id,
        periodoId: t.periodoId,
        inicio: t.inicio,
        volta: t.volta,
      }));
      const ultimo = ultimoPeriodo(periodos);
      const ultimoContato = ultimoPorPessoa.get(contato.pessoaId) ?? null;
      const ultimoContatoGeral = recentePorPessoa.get(contato.pessoaId) ?? null;
      return {
        id: p.id,
        nome: p.nome,
        whatsapp: p.whatsapp,
        email: p.email,
        instagram: p.instagram,
        nascimento,
        menor,
        encerrado,
        responsavel: resp,
        matriculas: (matriculasPorAluno.get(p.id) ?? []).map(
          ({ alunoId: _, ...m }) => ({ ...m, rotulo: rotuloDaTurma(m) }),
        ),
        periodos,
        trancamentos: listaTrancamentos,
        planoUltimo: linhasP.find((l) => l.id === ultimo?.id)?.plano ?? null,
        resumo: calcularEstado(
          { encerrado, periodos, trancamentos: listaTrancamentos },
          hoje,
        ),
        contato: {
          ...contato,
          naoQuerContato: bloqueados.has(contato.pessoaId),
        },
        ultimoContato,
        ultimoContatoGeral,
      };
    },
  );
  return alunos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
