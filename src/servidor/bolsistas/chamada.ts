/**
 * Aulas e chamada dos bolsistas: turmas do dia, lista de presença (combinados,
 * extras e disponíveis), salvar a chamada com controle de versão e "não houve aula".
 */

import {
  and,
  eq,
  inArray,
  isNotNull,
  isNull,
  type SQL,
  sql,
} from "drizzle-orm";
import { rotuloDaTurma } from "../alunos/carga";
import { type DataIso, diaDaSemana, ehDataIso } from "../alunos/datas";
import type { Banco } from "../banco/cliente";
import {
  acordosBolsista,
  aulas,
  bolsistas,
  modulos,
  pessoas,
  presencasAula,
  ritmos,
  situacoesBolsista,
  turmaDias,
  turmas,
} from "../banco/esquema";
import { ehUuid, executarTraduzindo } from "../cadastros/comum";
import type { Resultado } from "../cadastros/resultado";
import {
  ERROS_BANCO,
  ErrosDeFormulario,
  type Executor,
  transacaoComErros,
} from "../pessoas/cadastro-pessoa";
import { acordoVigenteEm, ativoEm } from "./regras";
import type { Preferencia } from "./textos";

export const MENSAGEM_CHAMADA_MUDOU =
  "Esta chamada foi salva por outra pessoa. Confira a chamada atual antes de salvar.";
export const MENSAGEM_CHAMADA_VAZIA =
  "Ninguém veio? Se não houve aula, use “Não houve aula”.";
export const MENSAGEM_DATA_INVALIDA = "Informe uma data válida.";
export const MENSAGEM_DATA_FUTURA =
  "Não dá para fazer chamada de um dia que ainda não chegou.";
export const MENSAGEM_SEM_AULA_NO_DIA =
  "Essa turma não tem aula nesse dia da semana.";
export const MENSAGEM_TURMA_INEXISTENTE = "Turma não encontrada.";
export const MENSAGEM_TURMA_INATIVA = "Escolha uma turma ativa.";
const MENSAGEM_NAO_BOLSISTA = "Só bolsistas podem receber presença.";
const MENSAGEM_BOLSISTA_INATIVO =
  "Só bolsistas ativos nesse dia podem receber presença.";
const MENSAGEM_NAO_HOUVE =
  "Esta aula está marcada como “não houve aula”. Desfaça antes.";
const MENSAGEM_COM_PRESENCA =
  "Desmarque as presenças antes de marcar “não houve aula”.";
const MENSAGEM_MOTIVO = "Informe o motivo.";
const MENSAGEM_NAO_ESTA_MARCADA =
  "Esta aula não está marcada como “não houve aula”.";

export type SituacaoChamada = "sem_chamada" | "realizada" | "nao_houve";

export type LinhaChamada = {
  pessoaId: string;
  nome: string;
  preferencia: Preferencia;
  presente: boolean;
};

type AulaLinha = typeof aulas.$inferSelect;

/**
 * Condição de "dia com chamada": aula realizada e com chamada salva. Feriado
 * ou esquecimento (sem chamada, ou "não houve" desfeito) não vira falta.
 */
export function comChamadaSalva(): SQL {
  return and(
    eq(aulas.situacao, "realizada"),
    isNotNull(aulas.chamadaSalvaEm),
  ) as SQL;
}

/**
 * Situação que a tela mostra: aula realizada sem chamada salva (ex.: "não
 * houve" desfeito) ainda está sem chamada — não conta como dia com chamada.
 */
function situacaoDaAula(aula: AulaLinha | null | undefined): SituacaoChamada {
  if (!aula) return "sem_chamada";
  if (aula.situacao === "realizada" && aula.chamadaSalvaEm === null) {
    return "sem_chamada";
  }
  return aula.situacao;
}

function erroDeData(data: string, hoje: DataIso): string | null {
  if (!ehDataIso(data)) return MENSAGEM_DATA_INVALIDA;
  if (data > hoje) return MENSAGEM_DATA_FUTURA;
  return null;
}

function falha<T>(erros: Record<string, string>): Resultado<T> {
  return { ok: false, erros };
}

/** Valida data, turma e dia; devolve a turma e a aula já existente (se houver). */
async function carregar(
  ex: Executor,
  turmaId: string,
  data: string,
  hoje: DataIso,
): Promise<Resultado<{ ativa: boolean; aula: AulaLinha | null }>> {
  const erroData = erroDeData(data, hoje);
  if (erroData) return falha({ data: erroData });
  if (!ehUuid(turmaId)) return falha({ turmaId: MENSAGEM_TURMA_INEXISTENTE });
  const [turma] = await ex
    .select({ id: turmas.id, ativa: turmas.ativa })
    .from(turmas)
    .where(eq(turmas.id, turmaId));
  if (!turma) return falha({ turmaId: MENSAGEM_TURMA_INEXISTENTE });
  const [aula] = await ex
    .select()
    .from(aulas)
    .where(and(eq(aulas.turmaId, turmaId), eq(aulas.data, data)));
  if (!aula) {
    if (!turma.ativa) return falha({ turmaId: MENSAGEM_TURMA_INATIVA });
    const dias = await ex
      .select({ dia: turmaDias.diaSemana })
      .from(turmaDias)
      .where(eq(turmaDias.turmaId, turmaId));
    if (!dias.some((d) => d.dia === diaDaSemana(data))) {
      return falha({ data: MENSAGEM_SEM_AULA_NO_DIA });
    }
  }
  return { ok: true, valor: { ativa: turma.ativa, aula: aula ?? null } };
}

export async function turmasDoDia(
  db: Banco,
  data: DataIso,
  hoje: DataIso,
): Promise<
  Resultado<
    {
      turmaId: string;
      rotulo: string;
      situacao: SituacaoChamada;
      presentes: number;
      motivo: string | null;
    }[]
  >
> {
  const erroData = erroDeData(data, hoje);
  if (erroData) return falha({ data: erroData });
  const dia = diaDaSemana(data);

  const linhas = await db
    .select({
      id: turmas.id,
      ativa: turmas.ativa,
      horarioInicio: turmas.horarioInicio,
      ritmo: ritmos.nome,
      modulo: modulos.nome,
    })
    .from(turmas)
    .innerJoin(ritmos, eq(ritmos.id, turmas.ritmoId))
    .innerJoin(modulos, eq(modulos.id, turmas.moduloId));
  const diasLinhas = await db.select().from(turmaDias);
  const diasPorTurma = new Map<string, number[]>();
  for (const d of diasLinhas) {
    const l = diasPorTurma.get(d.turmaId) ?? [];
    l.push(d.diaSemana);
    diasPorTurma.set(d.turmaId, l);
  }
  const aulasDoDia = await db.select().from(aulas).where(eq(aulas.data, data));
  const aulaPorTurma = new Map(aulasDoDia.map((a) => [a.turmaId, a]));
  const contagens = await db
    .select({ aulaId: presencasAula.aulaId, n: sql<number>`count(*)::int` })
    .from(presencasAula)
    .innerJoin(aulas, eq(aulas.id, presencasAula.aulaId))
    .where(and(eq(aulas.data, data), isNull(presencasAula.desmarcadaEm)))
    .groupBy(presencasAula.aulaId);
  const presentesPorAula = new Map(contagens.map((c) => [c.aulaId, c.n]));

  const valor = linhas
    .filter(
      (t) =>
        aulaPorTurma.has(t.id) ||
        (t.ativa && (diasPorTurma.get(t.id) ?? []).includes(dia)),
    )
    .sort(
      (a, b) =>
        a.horarioInicio.localeCompare(b.horarioInicio) ||
        a.id.localeCompare(b.id),
    )
    .map((t) => {
      const aula = aulaPorTurma.get(t.id);
      return {
        turmaId: t.id,
        rotulo: rotuloDaTurma({
          ritmo: t.ritmo,
          modulo: t.modulo,
          dias: diasPorTurma.get(t.id) ?? [],
          horarioInicio: t.horarioInicio,
        }),
        situacao: situacaoDaAula(aula),
        presentes: aula ? (presentesPorAula.get(aula.id) ?? 0) : 0,
        motivo: aula?.motivo ?? null,
      };
    });
  return { ok: true, valor };
}

function porNome<T extends { nome: string }>(l: T[]): T[] {
  return l.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function obterChamada(
  db: Banco,
  a: { turmaId: string; data: string },
  hoje: DataIso,
): Promise<
  Resultado<{
    aulaId: string | null;
    versao: number;
    situacao: SituacaoChamada;
    motivo: string | null;
    combinados: LinhaChamada[];
    extras: LinhaChamada[];
    disponiveis: { pessoaId: string; nome: string; preferencia: Preferencia }[];
    contagem: {
      vieram: number;
      conduzir: number;
      ser_conduzido: number;
      os_dois: number;
    };
  }>
> {
  const carregada = await carregar(db, a.turmaId, a.data, hoje);
  if (!carregada.ok) return carregada;
  const { aula } = carregada.valor;
  const data = a.data;

  const fichas = await db
    .select({
      pessoaId: bolsistas.pessoaId,
      nome: pessoas.nome,
      preferencia: bolsistas.preferencia,
    })
    .from(bolsistas)
    .innerJoin(pessoas, eq(pessoas.id, bolsistas.pessoaId));
  const acordos = await db.select().from(acordosBolsista);
  const situacoes = await db.select().from(situacoesBolsista);
  const vivas = aula
    ? await db
        .select({ pessoaId: presencasAula.pessoaId })
        .from(presencasAula)
        .where(
          and(
            eq(presencasAula.aulaId, aula.id),
            isNull(presencasAula.desmarcadaEm),
          ),
        )
    : [];
  const presentes = new Set(vivas.map((v) => v.pessoaId));

  const combinados: LinhaChamada[] = [];
  const extras: LinhaChamada[] = [];
  const disponiveis: {
    pessoaId: string;
    nome: string;
    preferencia: Preferencia;
  }[] = [];
  const contagem = { vieram: 0, conduzir: 0, ser_conduzido: 0, os_dois: 0 };
  const dia = diaDaSemana(data);

  for (const f of fichas) {
    const historico = situacoes
      .filter((s) => s.pessoaId === f.pessoaId)
      .map((s) => ({ tipo: s.tipo, data: s.data, criadoEm: s.criadoEm }));
    const ativo = ativoEm(historico, data);
    const vigente = acordoVigenteEm(
      acordos
        .filter((x) => x.pessoaId === f.pessoaId)
        .map((x) => ({
          dias: x.dias,
          vigenteDesde: x.vigenteDesde,
          criadoEm: x.criadoEm,
        })),
      data,
    );
    const presente = presentes.has(f.pessoaId);
    const linha: LinhaChamada = {
      pessoaId: f.pessoaId,
      nome: f.nome,
      preferencia: f.preferencia,
      presente,
    };
    if (presente) {
      contagem.vieram++;
      contagem[f.preferencia]++;
    }
    if (ativo && vigente?.includes(dia)) combinados.push(linha);
    else if (presente) extras.push(linha);
    else if (ativo)
      disponiveis.push({
        pessoaId: f.pessoaId,
        nome: f.nome,
        preferencia: f.preferencia,
      });
  }

  return {
    ok: true,
    valor: {
      aulaId: aula?.id ?? null,
      versao: aula?.versao ?? 0,
      situacao: situacaoDaAula(aula),
      motivo: aula?.motivo ?? null,
      combinados: porNome(combinados),
      extras: porNome(extras),
      disponiveis: porNome(disponiveis),
      contagem,
    },
  };
}

/** Cria a aula se não existir (devolve se foi criada agora) e trava a linha. */
async function criarETravar(
  tx: Executor,
  valores: typeof aulas.$inferInsert,
): Promise<{ aula: AulaLinha; criada: boolean }> {
  const inseridas = await tx
    .insert(aulas)
    .values(valores)
    .onConflictDoNothing({ target: [aulas.turmaId, aulas.data] })
    .returning({ id: aulas.id });
  const [aula] = await tx
    .select()
    .from(aulas)
    .where(
      and(eq(aulas.turmaId, valores.turmaId), eq(aulas.data, valores.data)),
    )
    .for("update");
  return { aula, criada: inseridas.length > 0 };
}

export async function salvarChamada(
  db: Banco,
  a: {
    turmaId: string;
    data: string;
    presentes: string[];
    versao: number;
    confirmarVazia?: boolean;
    feitoPor: string;
  },
  hoje: DataIso,
): Promise<Resultado<{ aulaId: string; versao: number }>> {
  const previa = await carregar(db, a.turmaId, a.data, hoje);
  if (!previa.ok) return previa;
  if (previa.valor.aula?.situacao === "nao_houve") {
    return falha({ _: MENSAGEM_NAO_HOUVE });
  }
  const pedidos = [...new Set(a.presentes)];
  if (!pedidos.every(ehUuid))
    return falha({ presentes: MENSAGEM_NAO_BOLSISTA });

  return executarTraduzindo<{ aulaId: string; versao: number }>(
    () =>
      transacaoComErros<{ aulaId: string; versao: number }>(db, async (tx) => {
        const { aula, criada } = await criarETravar(tx, {
          turmaId: a.turmaId,
          data: a.data,
          situacao: "realizada",
          criadoPor: a.feitoPor,
          chamadaSalvaPor: a.feitoPor,
          chamadaSalvaEm: new Date(),
        });
        if (aula.situacao === "nao_houve") {
          throw new ErrosDeFormulario({ _: MENSAGEM_NAO_HOUVE });
        }
        const versaoEsperada = criada ? 0 : aula.versao;
        if (a.versao !== versaoEsperada) {
          throw new ErrosDeFormulario({ _: MENSAGEM_CHAMADA_MUDOU });
        }

        const vivas = new Set(
          (
            await tx
              .select({ pessoaId: presencasAula.pessoaId })
              .from(presencasAula)
              .where(
                and(
                  eq(presencasAula.aulaId, aula.id),
                  isNull(presencasAula.desmarcadaEm),
                ),
              )
          ).map((p) => p.pessoaId),
        );
        // Lista vazia pede confirmação na primeira chamada (aula sem chamada
        // salva, mesmo que já exista por "não houve" desfeito) e ao esvaziar.
        if (
          pedidos.length === 0 &&
          !a.confirmarVazia &&
          (vivas.size > 0 || criada || aula.chamadaSalvaEm === null)
        ) {
          throw new ErrosDeFormulario({ _: MENSAGEM_CHAMADA_VAZIA });
        }

        if (pedidos.length > 0) {
          const fichas = await tx
            .select({ pessoaId: bolsistas.pessoaId })
            .from(bolsistas)
            .where(inArray(bolsistas.pessoaId, pedidos));
          if (fichas.length !== pedidos.length) {
            throw new ErrosDeFormulario({ presentes: MENSAGEM_NAO_BOLSISTA });
          }
        }
        const novos = pedidos.filter((id) => !vivas.has(id));
        if (novos.length > 0) {
          const situacoes = await tx
            .select()
            .from(situacoesBolsista)
            .where(inArray(situacoesBolsista.pessoaId, novos));
          for (const id of novos) {
            const h = situacoes
              .filter((s) => s.pessoaId === id)
              .map((s) => ({
                tipo: s.tipo,
                data: s.data,
                criadoEm: s.criadoEm,
              }));
            if (!ativoEm(h, a.data)) {
              throw new ErrosDeFormulario({
                presentes: MENSAGEM_BOLSISTA_INATIVO,
              });
            }
          }
          await tx.insert(presencasAula).values(
            novos.map((pessoaId) => ({
              aulaId: aula.id,
              pessoaId,
              marcadaPor: a.feitoPor,
            })),
          );
        }
        const saindo = [...vivas].filter((id) => !pedidos.includes(id));
        if (saindo.length > 0) {
          await tx
            .update(presencasAula)
            .set({ desmarcadaPor: a.feitoPor, desmarcadaEm: sql`now()` })
            .where(
              and(
                eq(presencasAula.aulaId, aula.id),
                inArray(presencasAula.pessoaId, saindo),
                isNull(presencasAula.desmarcadaEm),
              ),
            );
        }

        let versao = aula.versao;
        if (!criada) {
          versao = aula.versao + 1;
          await tx
            .update(aulas)
            .set({
              versao,
              alteradoPor: a.feitoPor,
              alteradoEm: sql`now()`,
              chamadaSalvaPor: a.feitoPor,
              chamadaSalvaEm: sql`now()`,
            })
            .where(eq(aulas.id, aula.id));
        }
        return { ok: true, valor: { aulaId: aula.id, versao } };
      }),
    ERROS_BANCO,
  );
}

export async function marcarNaoHouve(
  db: Banco,
  a: { turmaId: string; data: string; motivo: string; feitoPor: string },
  hoje: DataIso,
): Promise<Resultado<{ aulaId: string; versao: number }>> {
  const previa = await carregar(db, a.turmaId, a.data, hoje);
  if (!previa.ok) return previa;
  const motivo = a.motivo.trim();
  if (!motivo) return falha({ motivo: MENSAGEM_MOTIVO });

  return executarTraduzindo<{ aulaId: string; versao: number }>(
    () =>
      transacaoComErros<{ aulaId: string; versao: number }>(db, async (tx) => {
        const { aula, criada } = await criarETravar(tx, {
          turmaId: a.turmaId,
          data: a.data,
          situacao: "nao_houve",
          motivo,
          criadoPor: a.feitoPor,
        });
        if (criada) {
          return { ok: true, valor: { aulaId: aula.id, versao: aula.versao } };
        }
        const [viva] = await tx
          .select({ id: presencasAula.id })
          .from(presencasAula)
          .where(
            and(
              eq(presencasAula.aulaId, aula.id),
              isNull(presencasAula.desmarcadaEm),
            ),
          )
          .limit(1);
        if (viva) throw new ErrosDeFormulario({ _: MENSAGEM_COM_PRESENCA });
        const versao = aula.versao + 1;
        // Sem presença viva, a chamada salva antes não guarda ninguém: limpar
        // faz o "desfazer" voltar a "sem chamada", e o dia não vira falta.
        await tx
          .update(aulas)
          .set({
            situacao: "nao_houve",
            motivo,
            versao,
            alteradoPor: a.feitoPor,
            alteradoEm: sql`now()`,
            chamadaSalvaEm: null,
            chamadaSalvaPor: null,
          })
          .where(eq(aulas.id, aula.id));
        return { ok: true, valor: { aulaId: aula.id, versao } };
      }),
    ERROS_BANCO,
  );
}

export async function desfazerNaoHouve(
  db: Banco,
  a: { turmaId: string; data: string; feitoPor: string },
  hoje: DataIso,
): Promise<Resultado<{ aulaId: string; versao: number }>> {
  const previa = await carregar(db, a.turmaId, a.data, hoje);
  if (!previa.ok) return previa;
  if (previa.valor.aula?.situacao !== "nao_houve") {
    return falha({ _: MENSAGEM_NAO_ESTA_MARCADA });
  }
  const aulaId = previa.valor.aula.id;

  return executarTraduzindo<{ aulaId: string; versao: number }>(
    () =>
      transacaoComErros<{ aulaId: string; versao: number }>(db, async (tx) => {
        const [aula] = await tx
          .select()
          .from(aulas)
          .where(eq(aulas.id, aulaId))
          .for("update");
        if (aula.situacao !== "nao_houve") {
          throw new ErrosDeFormulario({ _: MENSAGEM_NAO_ESTA_MARCADA });
        }
        const versao = aula.versao + 1;
        await tx
          .update(aulas)
          .set({
            situacao: "realizada",
            motivo: null,
            versao,
            alteradoPor: a.feitoPor,
            alteradoEm: sql`now()`,
          })
          .where(eq(aulas.id, aulaId));
        return { ok: true, valor: { aulaId, versao } };
      }),
    ERROS_BANCO,
  );
}
