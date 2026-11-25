/**
 * Contas mostradas nos formulários da ficha antes de salvar ("Fim passa de
 * 08/12 para 12/12"), feitas no navegador com as mesmas regras do servidor.
 * O servidor recalcula tudo ao salvar; aqui é só a prévia.
 */
import { diasPorAulas } from "@/servidor/alunos/conversao";
import {
  type DataIso,
  diasEntre,
  ehDataIso,
  fimPeloPlano,
  formatarDia,
  somarDias,
} from "@/servidor/alunos/datas";
import { normalizarBusca } from "@/servidor/alunos/listas";
import { ehUuid } from "@/servidor/cadastros/comum";

/** Turma de uma matrícula aberta, com os dias por semana (para converter aulas). */
export type TurmaConversao = { turmaId: string; diasPorSemana: number };

export type Unidade = "dias" | "aulas";

function contarDias(n: number): string {
  return `${n} ${n === 1 ? "dia" : "dias"}`;
}

function contarAulas(n: number): string {
  return `${n} ${n === 1 ? "aula" : "aulas"}`;
}

/** Inteiro maior que zero digitado no campo; senão `null`. */
function lerQuantidade(texto: string): number | null {
  const t = texto.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Fim pelo plano para o campo "Fim"; "" sem plano ou com início inválido. */
export function fimPeloPlanoOuVazio(
  inicio: string,
  plano: { quantidade: number; unidade: "meses" | "dias" } | undefined,
): string {
  if (!plano || !ehDataIso(inicio)) return "";
  return fimPeloPlano(inicio, plano);
}

/** "Fim passa de 08/12 para 12/12". */
export function fraseDoFim(antes: DataIso, depois: DataIso): string {
  return `Fim passa de ${formatarDia(antes)} para ${formatarDia(depois)}`;
}

/**
 * Dias de uma quantidade digitada. Em aulas, usa a turma escolhida ou a
 * única turma; `null` quando não dá para saber (como o servidor recusaria).
 */
export function diasDaQuantidade(
  quantidade: string,
  unidade: Unidade,
  turmas: TurmaConversao[],
  turmaId: string,
): number | null {
  const q = lerQuantidade(quantidade);
  if (q === null) return null;
  if (unidade === "dias") return q;
  const turma =
    turmas.length === 1 ? turmas[0] : turmas.find((t) => t.turmaId === turmaId);
  if (!turma || turma.diasPorSemana <= 0) return null;
  return diasPorAulas(q, turma.diasPorSemana);
}

/** Conta da extensão: "Fim passa de 08/12 para 12/12 (+4 dias)." */
export function contaDaExtensao(
  fimAtual: DataIso,
  quantidade: string,
  unidade: Unidade,
  turmas: TurmaConversao[],
  turmaId: string,
): string | null {
  const dias = diasDaQuantidade(quantidade, unidade, turmas, turmaId);
  if (dias === null) return null;
  const detalhe =
    unidade === "aulas"
      ? `${contarAulas(Number(quantidade.trim()))} = ${contarDias(dias)}`
      : `+${contarDias(dias)}`;
  return `${fraseDoFim(fimAtual, somarDias(fimAtual, dias))} (${detalhe}).`;
}

/** Conta do trancamento: "19 dias parados. Fim passa de 31/12 para 19/01." */
export function contaDaPausa(
  inicio: string,
  volta: string,
  fimAtual: DataIso | null,
): string | null {
  if (!ehDataIso(inicio) || !ehDataIso(volta) || volta <= inicio) return null;
  const dias = diasEntre(inicio, volta);
  const parados = `${contarDias(dias)} ${dias === 1 ? "parado" : "parados"}.`;
  if (!fimAtual) return parados;
  return `${parados} ${fraseDoFim(fimAtual, somarDias(fimAtual, dias))}.`;
}

/** Conta da transferência, do lado de quem cede. */
export function contaDaTransferencia(a: {
  nome: string;
  fimAtual: DataIso;
  restantes: number;
  quantidade: string;
  unidade: Unidade;
  turmas: TurmaConversao[];
  turmaId: string;
}): string | null {
  const dias = diasDaQuantidade(a.quantidade, a.unidade, a.turmas, a.turmaId);
  if (dias === null) return null;
  if (dias > a.restantes) {
    const pedido =
      a.unidade === "aulas"
        ? `${contarAulas(Number(a.quantidade.trim()))} = ${contarDias(dias)}`
        : contarDias(dias);
    return `${pedido}: mais do que os ${contarDias(a.restantes)} que restam.`;
  }
  const depois = somarDias(a.fimAtual, -dias);
  return `Fim de ${a.nome} passa de ${formatarDia(a.fimAtual)} para ${formatarDia(depois)} (−${contarDias(dias)}).`;
}

/** "Restam 9 dias para transferir." */
export function textoRestam(dias: number): string {
  return dias === 1
    ? "Resta 1 dia para transferir."
    : `Restam ${dias} dias para transferir.`;
}

/** Filtra por nome, sem diferenciar acentos nem maiúsculas. */
export function filtrarPorNome<T extends { nome: string }>(
  lista: T[],
  busca: string,
): T[] {
  const termo = normalizarBusca(busca);
  if (!termo) return lista;
  return lista.filter((p) => normalizarBusca(p.nome).includes(termo));
}

const TIPOS_ANULAR = ["ajuste", "periodo", "trancamento", "transferencia"];

export type AlvoAnular = {
  tipo: "ajuste" | "periodo" | "trancamento" | "transferencia";
  id: string;
};

/**
 * `tipo` e `alvo` do endereço ou do formulário de anulação. Lotes são
 * anulados em outra tela. Qualquer outra coisa vira `null`.
 */
export function lerAlvoAnular(tipo: unknown, alvo: unknown): AlvoAnular | null {
  if (typeof tipo !== "string" || !TIPOS_ANULAR.includes(tipo)) return null;
  if (typeof alvo !== "string" || !ehUuid(alvo)) return null;
  return { tipo: tipo as AlvoAnular["tipo"], id: alvo.toLowerCase() };
}
