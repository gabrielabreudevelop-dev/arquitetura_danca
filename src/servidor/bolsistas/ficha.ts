/**
 * Ficha do bolsista: a carga do bolsista mais as versões do acordo de dias,
 * a frequência mês a mês (até 6 meses atrás), as últimas presenças, o
 * histórico (situação e dias, com quem fez) e os contatos de bolsista.
 */
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Executor } from "../alunos/cadastro";
import { rotuloDaTurma } from "../alunos/carga";
import { type DataIso, formatarDia, somarDias } from "../alunos/datas";
import {
  acordosBolsista,
  aulas,
  bloqueiosContato,
  contatos,
  mensagensProntas,
  modulos,
  pessoas,
  presencasAula,
  ritmos,
  situacoesBolsista,
  turmaDias,
  turmas,
} from "../banco/esquema";
import { ehUuid } from "../cadastros/comum";
import { type BolsistaCarregado, carregarBolsistas } from "./carga";
import { type Dia, frequencia } from "./regras";
import { diasCurtos } from "./textos";

export type FichaBolsista = {
  bolsista: BolsistaCarregado;
  versoes: { dias: number[]; desde: DataIso; ate: DataIso | null }[];
  meses: {
    mes: string;
    combinados: number;
    presentes: number;
    fora: number;
  }[];
  presencas: { data: DataIso; rotulo: string }[];
  historico: { em: Date; texto: string; por: string }[];
  contatos: {
    em: Date;
    por: string;
    mensagem: string | null;
    resultado: string | null;
    grupoId: string;
  }[];
  naoQuerContato: { em: Date; por: string } | null;
};

const SEM_AUTOR = "—";
const MESES_ANTERIORES = 6;
const LIMITE_PRESENCAS = 20;
const NOMES_MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/** Primeiro dia do mês `n` meses antes do mês da data. */
function primeiroDiaDoMes(data: DataIso, mesesAtras: number): DataIso {
  const ano = Number(data.slice(0, 4));
  const mes = Number(data.slice(5, 7)) - 1 - mesesAtras;
  const d = new Date(Date.UTC(ano, mes, 1));
  return d.toISOString().slice(0, 10);
}

export async function obterFichaBolsista(
  db: Executor,
  pessoaId: string,
  hoje: DataIso,
): Promise<FichaBolsista | null> {
  if (!ehUuid(pessoaId)) return null;
  const [bolsista] = await carregarBolsistas(db, hoje, { ids: [pessoaId] });
  if (!bolsista) return null;

  // Versões do acordo: a vigente primeiro; no mesmo `desde` vale a mais recente.
  const ordenadas = [...bolsista.acordos].sort(
    (a, b) =>
      a.vigenteDesde.localeCompare(b.vigenteDesde) ||
      a.criadoEm.getTime() - b.criadoEm.getTime(),
  );
  const unicas = ordenadas.filter(
    (v, i) => ordenadas[i + 1]?.vigenteDesde !== v.vigenteDesde,
  );
  const versoes = unicas
    .map((v, i) => {
      const seguinte = unicas[i + 1];
      return {
        dias: v.dias,
        desde: v.vigenteDesde,
        ate: seguinte ? somarDias(seguinte.vigenteDesde, -1) : null,
      };
    })
    .reverse();

  // Dias da faixa da ficha (a carga só cobre o mês anterior).
  const inicioFaixa = primeiroDiaDoMes(hoje, MESES_ANTERIORES);
  const naFaixa = and(gte(aulas.data, inicioFaixa), lte(aulas.data, hoje));
  const linhasAulas = await db
    .selectDistinct({ data: aulas.data })
    .from(aulas)
    .where(and(naFaixa, eq(aulas.situacao, "realizada")));
  const linhasPresencas = await db
    .selectDistinct({ data: aulas.data })
    .from(presencasAula)
    .innerJoin(aulas, eq(aulas.id, presencasAula.aulaId))
    .where(
      and(
        naFaixa,
        eq(presencasAula.pessoaId, bolsista.id),
        isNull(presencasAula.desmarcadaEm),
      ),
    );
  const diasComChamada = new Set(linhasAulas.map((a) => a.data));
  const presentes = new Set(linhasPresencas.map((a) => a.data));
  const dias = new Map<DataIso, Dia>();
  for (const data of new Set([...diasComChamada, ...presentes])) {
    dias.set(data, {
      data,
      comChamada: diasComChamada.has(data),
      presente: presentes.has(data),
    });
  }
  const entrada = {
    acordos: bolsista.acordos,
    historico: bolsista.historico,
    dias,
  };
  const meses: FichaBolsista["meses"] = [];
  for (let atras = 0; atras <= MESES_ANTERIORES; atras++) {
    const de = primeiroDiaDoMes(hoje, atras);
    const fimDoMes = somarDias(primeiroDiaDoMes(hoje, atras - 1), -1);
    const f = frequencia(entrada, de, fimDoMes < hoje ? fimDoMes : hoje);
    if (atras === 0 || f.combinados > 0 || f.presentes > 0 || f.fora > 0) {
      meses.push({ mes: NOMES_MESES[Number(de.slice(5, 7)) - 1] ?? "", ...f });
    }
  }

  // Últimas presenças vivas em aulas realizadas, com o rótulo da turma.
  const linhasUltimas = await db
    .select({
      data: aulas.data,
      ritmo: ritmos.nome,
      modulo: modulos.nome,
      horarioInicio: turmas.horarioInicio,
      dias: sql<
        number[]
      >`coalesce(array_agg(${turmaDias.diaSemana} order by ${turmaDias.diaSemana}) filter (where ${turmaDias.diaSemana} is not null), '{}')`,
    })
    .from(presencasAula)
    .innerJoin(aulas, eq(aulas.id, presencasAula.aulaId))
    .innerJoin(turmas, eq(turmas.id, aulas.turmaId))
    .innerJoin(ritmos, eq(ritmos.id, turmas.ritmoId))
    .innerJoin(modulos, eq(modulos.id, turmas.moduloId))
    .leftJoin(turmaDias, eq(turmaDias.turmaId, turmas.id))
    .where(
      and(
        eq(presencasAula.pessoaId, bolsista.id),
        isNull(presencasAula.desmarcadaEm),
        eq(aulas.situacao, "realizada"),
        lte(aulas.data, hoje),
      ),
    )
    .groupBy(presencasAula.id, aulas.id, turmas.id, ritmos.id, modulos.id)
    .orderBy(desc(aulas.data), desc(aulas.id))
    .limit(LIMITE_PRESENCAS);
  const presencas = linhasUltimas.map((l) => ({
    data: l.data,
    rotulo: rotuloDaTurma(l),
  }));

  // Histórico bruto, com quem fez (nada se apaga: inclui acordos substituídos).
  const situacoes = await db
    .select({
      tipo: situacoesBolsista.tipo,
      motivo: situacoesBolsista.motivo,
      em: situacoesBolsista.criadoEm,
      criadoPor: situacoesBolsista.criadoPor,
    })
    .from(situacoesBolsista)
    .where(eq(situacoesBolsista.pessoaId, bolsista.id));
  const acordos = await db
    .select({
      dias: acordosBolsista.dias,
      desde: acordosBolsista.vigenteDesde,
      em: acordosBolsista.criadoEm,
      criadoPor: acordosBolsista.criadoPor,
    })
    .from(acordosBolsista)
    .where(eq(acordosBolsista.pessoaId, bolsista.id))
    .orderBy(asc(acordosBolsista.criadoEm));

  const mensagem = alias(mensagensProntas, "mensagem");
  const contatosDaPessoa = await db
    .select({
      em: contatos.criadoEm,
      criadoPor: contatos.criadoPor,
      mensagem: mensagem.nome,
      resultado: contatos.resultado,
      grupoId: contatos.grupoId,
    })
    .from(contatos)
    .leftJoin(mensagem, eq(mensagem.id, contatos.mensagemId))
    .where(
      and(
        eq(contatos.alunoId, bolsista.id),
        inArray(contatos.lista, ["bolsista_ausente", "ficha_bolsista"]),
      ),
    )
    .orderBy(desc(contatos.criadoEm), desc(contatos.id));

  const [bloqueio] = await db
    .select({
      em: bloqueiosContato.marcadoEm,
      por: bloqueiosContato.marcadoPor,
    })
    .from(bloqueiosContato)
    .where(
      and(
        eq(bloqueiosContato.pessoaId, bolsista.contato.pessoaId),
        isNull(bloqueiosContato.desfeitoEm),
      ),
    );

  const idsPessoas = new Set<string>();
  for (const s of situacoes) idsPessoas.add(s.criadoPor);
  for (const a of acordos) idsPessoas.add(a.criadoPor);
  for (const c of contatosDaPessoa) idsPessoas.add(c.criadoPor);
  if (bloqueio) idsPessoas.add(bloqueio.por);
  const nomes = new Map<string, string>();
  if (idsPessoas.size > 0) {
    const linhas = await db
      .select({ id: pessoas.id, nome: pessoas.nome })
      .from(pessoas)
      .where(inArray(pessoas.id, [...idsPessoas]));
    for (const l of linhas) nomes.set(l.id, l.nome);
  }
  const nomeDe = (id: string) => nomes.get(id) ?? SEM_AUTOR;

  const historico = [
    ...situacoes.map((s) => ({
      em: s.em,
      texto:
        s.tipo === "ativacao"
          ? "Ativado"
          : s.motivo?.trim()
            ? `Inativado · ${s.motivo.trim()}`
            : "Inativado",
      por: nomeDe(s.criadoPor),
    })),
    ...acordos.map((a) => ({
      em: a.em,
      texto: `Dias: ${diasCurtos(a.dias)} (desde ${formatarDia(a.desde)})`,
      por: nomeDe(a.criadoPor),
    })),
  ].sort((a, b) => b.em.getTime() - a.em.getTime());

  return {
    bolsista,
    versoes,
    meses,
    presencas,
    historico,
    contatos: contatosDaPessoa.map((c) => ({
      em: c.em,
      por: nomeDe(c.criadoPor),
      mensagem: c.mensagem,
      resultado: c.resultado,
      grupoId: c.grupoId,
    })),
    naoQuerContato: bloqueio
      ? { em: bloqueio.em, por: nomeDe(bloqueio.por) }
      : null,
  };
}
