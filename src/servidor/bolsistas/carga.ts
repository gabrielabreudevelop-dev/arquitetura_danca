/**
 * Carga única dos bolsistas: tudo o que a lista, a ficha e a lista "sem vir"
 * precisam, com no máximo uma consulta por tabela. As regras (acordo vigente,
 * situação, frequência, sem vir) vêm de `regras.ts`; filtros e contagens
 * ficam em `listas.ts`.
 */
import { and, asc, eq, gte, inArray, isNull, lte, max } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Executor } from "../alunos/cadastro";
import type { AlunoCarregado } from "../alunos/carga";
import { type DataIso, ehMenor, somarDias } from "../alunos/datas";
import type { Janela } from "../alunos/listas";
import {
  acordosBolsista,
  aulas,
  bolsistas,
  pessoas,
  presencasAula,
  responsabilidades,
  situacoesBolsista,
} from "../banco/esquema";
import { ehUuid } from "../cadastros/comum";
import {
  carregarContatos,
  type PessoaDeContato,
  pessoaDeContato,
  type UltimoContato,
} from "../contatos/pessoa-de-contato";
import {
  acordoVigenteEm,
  ativoEm,
  type Dia,
  frequencia,
  type MudancaSituacao,
  semVir,
  type VersaoAcordo,
} from "./regras";
import type { Preferencia } from "./textos";

const JANELAS_CARGA: readonly Janela[] = [7, 15, 30];

export type BolsistaCarregado = {
  id: string;
  nome: string;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  nascimento: DataIso;
  menor: boolean;
  /** Bolsa ativa hoje. */
  ativo: boolean;
  preferencia: Preferencia;
  acordos: VersaoAcordo[];
  historico: MudancaSituacao[];
  /** Dias do acordo vigente hoje (0 = domingo), ou nulo se ainda não há acordo. */
  diasHoje: number[] | null;
  /** Dias com aula realizada ou presença, do início da janela de carga até hoje. */
  dias: Map<DataIso, Dia>;
  responsavel: AlunoCarregado["responsavel"];
  contato: PessoaDeContato;
  /** Último contato de listas de bolsista (o que a linha mostra e o resultado usa). */
  ultimoContato: UltimoContato | null;
  /** Último contato de qualquer lista, inclusive de aluno (aviso de contato recente). */
  ultimoContatoGeral: UltimoContato | null;
  /** Frequência do mês de hoje (do dia 1 até hoje). */
  mes: { combinados: number; presentes: number; fora: number };
  semVir: Record<Janela, { semVir: boolean; ultimaPresenca: DataIso | null }>;
};

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

/** Primeiro dia do mês anterior ou hoje − 30, o que for mais antigo. */
function inicioDaCarga(hoje: DataIso): DataIso {
  const primeiroDoMes = `${hoje.slice(0, 7)}-01`;
  const primeiroDoAnterior = `${somarDias(primeiroDoMes, -1).slice(0, 7)}-01`;
  const trintaDias = somarDias(hoje, -30);
  return primeiroDoAnterior < trintaDias ? primeiroDoAnterior : trintaDias;
}

/**
 * Todos os bolsistas (ativos ou não) ou só os `ids` pedidos (ids que não são
 * uuid são ignorados), em ordem de nome.
 */
export async function carregarBolsistas(
  db: Executor,
  hoje: DataIso,
  opcoes: { ids?: string[] } = {},
): Promise<BolsistaCarregado[]> {
  const ids = opcoes.ids
    ? [...new Set(opcoes.ids.filter(ehUuid).map((id) => id.toLowerCase()))]
    : null;
  if (ids?.length === 0) return [];
  const doBolsista = (coluna: Parameters<typeof inArray>[0]) =>
    ids ? inArray(coluna, ids) : undefined;

  const linhasBolsistas = await db
    .select({
      id: pessoas.id,
      nome: pessoas.nome,
      whatsapp: pessoas.whatsapp,
      email: pessoas.email,
      instagram: pessoas.instagram,
      nascimento: pessoas.dataNascimento,
      preferencia: bolsistas.preferencia,
    })
    .from(bolsistas)
    .innerJoin(pessoas, eq(pessoas.id, bolsistas.pessoaId))
    .where(doBolsista(bolsistas.pessoaId));
  if (linhasBolsistas.length === 0) return [];

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
    .where(doBolsista(responsabilidades.alunoId))
    .orderBy(asc(responsavel.nome), asc(responsavel.id));

  const linhasAcordos = await db
    .select({
      pessoaId: acordosBolsista.pessoaId,
      dias: acordosBolsista.dias,
      vigenteDesde: acordosBolsista.vigenteDesde,
      criadoEm: acordosBolsista.criadoEm,
    })
    .from(acordosBolsista)
    .where(doBolsista(acordosBolsista.pessoaId));

  const linhasSituacoes = await db
    .select({
      pessoaId: situacoesBolsista.pessoaId,
      tipo: situacoesBolsista.tipo,
      data: situacoesBolsista.data,
      criadoEm: situacoesBolsista.criadoEm,
    })
    .from(situacoesBolsista)
    .where(doBolsista(situacoesBolsista.pessoaId));

  const inicio = inicioDaCarga(hoje);
  const noPeriodo = and(gte(aulas.data, inicio), lte(aulas.data, hoje));
  // Dias em que alguma turma teve aula realizada (vale para todos os bolsistas).
  const linhasAulas = await db
    .select({ data: aulas.data })
    .from(aulas)
    .where(and(noPeriodo, eq(aulas.situacao, "realizada")));
  const linhasPresencas = await db
    .select({ pessoaId: presencasAula.pessoaId, data: aulas.data })
    .from(presencasAula)
    .innerJoin(aulas, eq(aulas.id, presencasAula.aulaId))
    .where(
      and(
        noPeriodo,
        isNull(presencasAula.desmarcadaEm),
        doBolsista(presencasAula.pessoaId),
      ),
    );

  // Última presença viva em toda a história (a janela carregada não alcança).
  const linhasUltimas = await db
    .select({ pessoaId: presencasAula.pessoaId, data: max(aulas.data) })
    .from(presencasAula)
    .innerJoin(aulas, eq(aulas.id, presencasAula.aulaId))
    .where(
      and(
        isNull(presencasAula.desmarcadaEm),
        eq(aulas.situacao, "realizada"),
        lte(aulas.data, hoje),
        doBolsista(presencasAula.pessoaId),
      ),
    )
    .groupBy(presencasAula.pessoaId);
  const ultimaPorPessoa = new Map(
    linhasUltimas.map((u) => [u.pessoaId, u.data]),
  );

  const responsaveisPorAluno = agrupar(linhasResponsaveis, (r) => r.alunoId);
  const base = linhasBolsistas.map((p) => {
    const nascimento = p.nascimento ?? "";
    const menor = nascimento !== "" && ehMenor(nascimento, hoje);
    const r = responsaveisPorAluno.get(p.id)?.[0];
    const responsavelDoBolsista: AlunoCarregado["responsavel"] = r
      ? { id: r.id, nome: r.nome, whatsapp: r.whatsapp, email: r.email }
      : null;
    return {
      p,
      nascimento,
      menor,
      responsavel: responsavelDoBolsista,
      contato: pessoaDeContato(
        { id: p.id, nome: p.nome, whatsapp: p.whatsapp, menor },
        responsavelDoBolsista,
      ),
    };
  });

  const idsDeContato = ids
    ? [...new Set(base.map((b) => b.contato.pessoaId))]
    : null;
  const { bloqueados, ultimoPorPessoa, recentePorPessoa } =
    await carregarContatos(db, idsDeContato, "bolsista");

  const diasComChamada = new Set(linhasAulas.map((a) => a.data));
  const acordosPorPessoa = agrupar(linhasAcordos, (a) => a.pessoaId);
  const situacoesPorPessoa = agrupar(linhasSituacoes, (s) => s.pessoaId);
  const presencasPorPessoa = agrupar(linhasPresencas, (s) => s.pessoaId);
  const primeiroDoMes = `${hoje.slice(0, 7)}-01`;

  const resultado = base.map(
    ({
      p,
      nascimento,
      menor,
      responsavel: resp,
      contato,
    }): BolsistaCarregado => {
      const acordos: VersaoAcordo[] = (acordosPorPessoa.get(p.id) ?? []).map(
        (a) => ({
          dias: a.dias,
          vigenteDesde: a.vigenteDesde,
          criadoEm: a.criadoEm,
        }),
      );
      const historico: MudancaSituacao[] = (
        situacoesPorPessoa.get(p.id) ?? []
      ).map((s) => ({ tipo: s.tipo, data: s.data, criadoEm: s.criadoEm }));
      const presentes = new Set(
        (presencasPorPessoa.get(p.id) ?? []).map((x) => x.data),
      );
      const dias = new Map<DataIso, Dia>();
      for (const data of new Set([...diasComChamada, ...presentes])) {
        dias.set(data, {
          data,
          comChamada: diasComChamada.has(data),
          presente: presentes.has(data),
        });
      }
      const entrada = { acordos, historico, dias };
      const semVirPorJanela = {} as BolsistaCarregado["semVir"];
      const historica = ultimaPorPessoa.get(p.id) ?? null;
      for (const j of JANELAS_CARGA) {
        const r = semVir(entrada, hoje, j);
        const ultimaPresenca =
          historica !== null &&
          (r.ultimaPresenca === null || historica > r.ultimaPresenca)
            ? historica
            : r.ultimaPresenca;
        semVirPorJanela[j] = { semVir: r.semVir, ultimaPresenca };
      }
      return {
        id: p.id,
        nome: p.nome,
        whatsapp: p.whatsapp,
        email: p.email,
        instagram: p.instagram,
        nascimento,
        menor,
        ativo: ativoEm(historico, hoje),
        preferencia: p.preferencia,
        acordos,
        historico,
        diasHoje: acordoVigenteEm(acordos, hoje),
        dias,
        responsavel: resp,
        contato: {
          ...contato,
          naoQuerContato: bloqueados.has(contato.pessoaId),
        },
        ultimoContato: ultimoPorPessoa.get(contato.pessoaId) ?? null,
        ultimoContatoGeral: recentePorPessoa.get(contato.pessoaId) ?? null,
        mes: frequencia(entrada, primeiroDoMes, hoje),
        semVir: semVirPorJanela,
      };
    },
  );
  return resultado.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
