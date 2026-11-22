/**
 * Transferência de dias do período de um aluno para outro e a anulação dela.
 * Quem cede ganha uma linha `transferencia_saida`; quem recebe ganha uma
 * linha `transferencia_entrada` no último período (se ele ainda não terminou)
 * ou um período novo de origem `transferencia`. Toda escrita roda numa
 * transação que trava os dois alunos em ordem de id.
 */
import { and, eq, isNull } from "drizzle-orm";
import type { Banco } from "../banco/cliente";
import {
  ajustesPeriodo,
  periodosContratados,
  pessoas,
  trancamentos,
  transferencias,
} from "../banco/esquema";
import { ehUuid, executarTraduzindo } from "../cadastros/comum";
import type { Resultado } from "../cadastros/resultado";
import {
  alunoAtivoOuErro,
  type Executor,
  MENSAGEM_ENCERRADO,
} from "./cadastro";
import { type DataIso, ehDataIso, formatarDia, somarDias } from "./datas";
import {
  calcularEstado,
  diasRestantes,
  fimEfetivo,
  ultimoPeriodo,
} from "./estado";
import {
  carregarPeriodosDoAluno,
  diasDoAjuste,
  travarAlunosEmOrdem,
} from "./periodos";

const MENSAGEM_DATA = "Informe uma data válida.";
const MENSAGEM_MOTIVO = "Informe o motivo.";
const MENSAGEM_QUANTIDADE = "Informe um número inteiro maior que zero.";
const MENSAGEM_JA_ANULADO = "Isso já foi anulado.";
const MENSAGEM_CEDENTE =
  "Só é possível transferir de um período vigente e não trancado.";

type Falha = { ok: false; erros: Record<string, string> };

const falha = (campo: string, mensagem: string): Falha => ({
  ok: false,
  erros: { [campo]: mensagem },
});

async function primeiroNome(tx: Executor, alunoId: string): Promise<string> {
  const [p] = await tx
    .select({ nome: pessoas.nome })
    .from(pessoas)
    .where(eq(pessoas.id, alunoId));
  return p?.nome.trim().split(/\s+/)[0] ?? "Quem cede";
}

/**
 * Cede `quantidade` (dias ou aulas) do último período de quem cede a outro
 * aluno. `hoje` define o que ainda resta a ceder e se o período de quem
 * recebe ainda vale.
 */
export async function transferir(
  db: Banco,
  entrada: {
    deAlunoId: string;
    paraAlunoId: string;
    quantidade: string | number;
    unidade: string;
    turmaId?: string;
    motivo: string;
    inicioRecebedor?: string;
    feitoPor: string;
  },
  hoje: DataIso,
): Promise<Resultado<{ transferenciaId: string; dias: number }>> {
  // `ehUuid` aceita maiúsculas: normaliza uma vez para comparar e travar em ordem.
  const a = {
    ...entrada,
    deAlunoId: String(entrada.deAlunoId ?? "").toLowerCase(),
    paraAlunoId: String(entrada.paraAlunoId ?? "").toLowerCase(),
  };
  const erros: Record<string, string> = {};
  const texto = String(a.quantidade ?? "").trim();
  const numero = /^\d+$/.test(texto) ? Number(texto) : 0;
  const quantidade = Number.isSafeInteger(numero) && numero > 0 ? numero : null;
  if (quantidade === null) erros.quantidade = MENSAGEM_QUANTIDADE;
  const unidade =
    a.unidade === "dias" || a.unidade === "aulas" ? a.unidade : null;
  if (!unidade) erros.unidade = "Escolha dias ou aulas.";
  const motivo = a.motivo?.trim() ?? "";
  if (!motivo) erros.motivo = MENSAGEM_MOTIVO;
  const turmaId = a.turmaId?.trim() || undefined;
  if (turmaId && !ehUuid(turmaId)) erros.turmaId = "Escolha a turma das aulas.";
  const inicioInformado = a.inicioRecebedor?.trim() || undefined;
  if (inicioInformado !== undefined && !ehDataIso(inicioInformado)) {
    erros.inicioRecebedor = MENSAGEM_DATA;
  }
  if (!ehUuid(a.paraAlunoId)) erros.paraAlunoId = "Escolha quem recebe.";
  else if (a.paraAlunoId === a.deAlunoId) {
    erros.paraAlunoId = "Escolha outra pessoa.";
  }
  if (quantidade === null || !unidade || Object.keys(erros).length > 0) {
    return { ok: false, erros };
  }

  return executarTraduzindo<{ transferenciaId: string; dias: number }>(
    () =>
      db.transaction(async (tx) => {
        if (!ehUuid(a.deAlunoId)) return falha("_", "Aluno não encontrado.");
        await travarAlunosEmOrdem(tx, [a.deAlunoId, a.paraAlunoId]);
        const cedenteAtivo = await alunoAtivoOuErro(tx, a.deAlunoId);
        if (!cedenteAtivo.ok) return cedenteAtivo;
        const recebedorAtivo = await alunoAtivoOuErro(tx, a.paraAlunoId);
        if (!recebedorAtivo.ok) {
          return recebedorAtivo.erros._ === MENSAGEM_ENCERRADO
            ? recebedorAtivo
            : falha("paraAlunoId", "Aluno não encontrado.");
        }

        // Lido depois das travas: gravações simultâneas já terminaram.
        const doCedente = await carregarPeriodosDoAluno(tx, a.deAlunoId);
        const resumo = calcularEstado({ encerrado: false, ...doCedente }, hoje);
        if (resumo.estado !== "vigente" || resumo.ultimo === null) {
          return falha("_", MENSAGEM_CEDENTE);
        }
        const limite = diasRestantes(resumo, hoje);
        const conversao = await diasDoAjuste(tx, {
          alunoId: a.deAlunoId,
          quantidade,
          unidade,
          turmaId,
        });
        if (!conversao.ok) return conversao;
        const { dias, turmaConversaoId } = conversao.valor;
        if (dias > limite) {
          const nome = await primeiroNome(tx, a.deAlunoId);
          return falha(
            "quantidade",
            `${nome} pode ceder até ${limite} ${limite === 1 ? "dia" : "dias"}.`,
          );
        }

        const doRecebedor = await carregarPeriodosDoAluno(tx, a.paraAlunoId);
        const ultimoRecebedor = ultimoPeriodo(doRecebedor.periodos);
        const recebeNoUltimo =
          ultimoRecebedor !== null && fimEfetivo(ultimoRecebedor) >= hoje;
        let periodoDestinoId: string;
        if (recebeNoUltimo) {
          // `inicioRecebedor` não se aplica: a entrada vai no último período.
          periodoDestinoId = ultimoRecebedor.id;
        } else {
          const inicio = inicioInformado ?? hoje;
          if (ultimoRecebedor) {
            const fimAtual = fimEfetivo(ultimoRecebedor);
            if (inicio <= fimAtual) {
              return falha(
                "inicioRecebedor",
                `O período atual vai até ${formatarDia(fimAtual)}. O novo precisa começar a partir de ${formatarDia(somarDias(fimAtual, 1))}.`,
              );
            }
          }
          const [novo] = await tx
            .insert(periodosContratados)
            .values({
              alunoId: a.paraAlunoId,
              inicio,
              fim: somarDias(inicio, dias - 1),
              planoId: null,
              origem: "transferencia",
              criadoPor: a.feitoPor,
            })
            .returning({ id: periodosContratados.id });
          periodoDestinoId = novo.id;
        }

        const [transferencia] = await tx
          .insert(transferencias)
          .values({
            periodoOrigemId: resumo.ultimo.id,
            periodoDestinoId,
            dias,
            motivo,
            criadoPor: a.feitoPor,
          })
          .returning({ id: transferencias.id });
        await tx.insert(ajustesPeriodo).values({
          periodoId: resumo.ultimo.id,
          tipo: "transferencia_saida",
          dias: -dias,
          quantidadeDigitada: quantidade,
          unidadeDigitada: unidade,
          turmaConversaoId,
          motivo,
          transferenciaId: transferencia.id,
          criadoPor: a.feitoPor,
        });
        if (recebeNoUltimo) {
          await tx.insert(ajustesPeriodo).values({
            periodoId: periodoDestinoId,
            tipo: "transferencia_entrada",
            dias,
            quantidadeDigitada: dias,
            unidadeDigitada: "dias",
            motivo,
            transferenciaId: transferencia.id,
            criadoPor: a.feitoPor,
          });
        }
        return {
          ok: true as const,
          valor: { transferenciaId: transferencia.id, dias },
        };
      }),
    {},
  );
}

async function buscarTransferencia(tx: Executor, transferenciaId: string) {
  const [t] = await tx
    .select({
      id: transferencias.id,
      dias: transferencias.dias,
      periodoOrigemId: transferencias.periodoOrigemId,
      periodoDestinoId: transferencias.periodoDestinoId,
      anuladoEm: transferencias.anuladoEm,
    })
    .from(transferencias)
    .where(eq(transferencias.id, transferenciaId));
  if (!t) return undefined;
  const [origem] = await tx
    .select({ alunoId: periodosContratados.alunoId })
    .from(periodosContratados)
    .where(eq(periodosContratados.id, t.periodoOrigemId));
  const [destino] = await tx
    .select({ alunoId: periodosContratados.alunoId })
    .from(periodosContratados)
    .where(eq(periodosContratados.id, t.periodoDestinoId));
  return { ...t, cedenteId: origem.alunoId, recebedorId: destino.alunoId };
}

/**
 * Anula a transferência: a saída e a entrada (ou o período criado para quem
 * recebeu). Vale também com aluno encerrado: corrigir o histórico não exige
 * reabrir. Bloqueia se o período criado já tem outros lançamentos ou se
 * devolver os dias faria o período de quem cedeu invadir o seguinte.
 */
export async function anularTransferencia(
  db: Banco,
  a: { transferenciaId: string; motivo: string; feitoPor: string },
): Promise<Resultado<null>> {
  const motivo = a.motivo?.trim() ?? "";
  if (!motivo) return falha("motivo", MENSAGEM_MOTIVO);
  const naoEncontrada = falha("_", "Transferência não encontrada.");
  if (!ehUuid(a.transferenciaId)) return naoEncontrada;

  return executarTraduzindo<null>(
    () =>
      db.transaction(async (tx) => {
        const lida = await buscarTransferencia(tx, a.transferenciaId);
        if (!lida) return naoEncontrada;
        await travarAlunosEmOrdem(tx, [lida.cedenteId, lida.recebedorId]);
        const t = await buscarTransferencia(tx, a.transferenciaId);
        if (!t) return naoEncontrada;
        if (t.anuladoEm) return falha("_", MENSAGEM_JA_ANULADO);

        const linhas = await tx
          .select({ id: ajustesPeriodo.id, tipo: ajustesPeriodo.tipo })
          .from(ajustesPeriodo)
          .where(
            and(
              eq(ajustesPeriodo.transferenciaId, t.id),
              isNull(ajustesPeriodo.anuladoEm),
            ),
          );
        const criouPeriodo = !linhas.some(
          (l) => l.tipo === "transferencia_entrada",
        );

        if (criouPeriodo) {
          const outras = await tx
            .select({ id: ajustesPeriodo.id })
            .from(ajustesPeriodo)
            .where(
              and(
                eq(ajustesPeriodo.periodoId, t.periodoDestinoId),
                isNull(ajustesPeriodo.anuladoEm),
              ),
            );
          const trancamentosVivos = await tx
            .select({ id: trancamentos.id })
            .from(trancamentos)
            .where(
              and(
                eq(trancamentos.periodoId, t.periodoDestinoId),
                isNull(trancamentos.anuladoEm),
              ),
            );
          if (outras.length > 0 || trancamentosVivos.length > 0) {
            return falha(
              "_",
              "O período recebido já tem outros lançamentos. Anule-os antes.",
            );
          }
        }

        // Devolver os dias estica o período de quem cedeu: não pode invadir o próximo.
        const { periodos } = await carregarPeriodosDoAluno(tx, t.cedenteId);
        const origem = periodos.find((p) => p.id === t.periodoOrigemId);
        if (origem) {
          const novoFim = fimEfetivo({
            ...origem,
            diasAjustes: origem.diasAjustes + t.dias,
          });
          if (
            periodos.some(
              (p) => p.inicio > origem.inicio && p.inicio <= novoFim,
            )
          ) {
            const nome = await primeiroNome(tx, t.cedenteId);
            return falha(
              "_",
              `Anular agora faria o período de ${nome} encostar no próximo. Anule ou corrija o próximo período antes.`,
            );
          }
        }

        const anulacao = {
          anuladoEm: new Date(),
          anuladoPor: a.feitoPor,
          motivoAnulacao: motivo,
        };
        await tx
          .update(ajustesPeriodo)
          .set(anulacao)
          .where(
            and(
              eq(ajustesPeriodo.transferenciaId, t.id),
              isNull(ajustesPeriodo.anuladoEm),
            ),
          );
        if (criouPeriodo) {
          await tx
            .update(periodosContratados)
            .set(anulacao)
            .where(eq(periodosContratados.id, t.periodoDestinoId));
        }
        await tx
          .update(transferencias)
          .set(anulacao)
          .where(eq(transferencias.id, t.id));
        return { ok: true as const, valor: null };
      }),
    {},
  );
}
