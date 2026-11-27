/**
 * Regras puras (sem banco) dos bolsistas: acordo de dias vigente, situação
 * ativa/inativa, frequência num período e lista "sem vir".
 * Datas são "AAAA-MM-DD"; dia da semana 0 = domingo … 6 = sábado.
 */

import {
  type DataIso,
  diaDaSemana,
  diasEntre,
  somarDias,
} from "../alunos/datas";

export type VersaoAcordo = {
  dias: number[];
  vigenteDesde: DataIso;
  criadoEm: Date;
};

export type MudancaSituacao = {
  tipo: "ativacao" | "inativacao";
  data: DataIso;
  criadoEm: Date;
};

/** comChamada: alguma aula realizada com chamada salva no dia; presente: presença viva em alguma aula do dia. */
export type Dia = { data: DataIso; comChamada: boolean; presente: boolean };

export type EntradaFrequencia = {
  acordos: VersaoAcordo[];
  historico: MudancaSituacao[];
  dias: Map<DataIso, Dia>;
};

/** O item de maior data e, no empate, o de `criadoEm` mais recente. */
function maisRecente<T extends { criadoEm: Date }>(
  itens: T[],
  data: (item: T) => DataIso,
): T | null {
  let melhor: T | null = null;
  for (const item of itens) {
    if (
      melhor === null ||
      data(item) > data(melhor) ||
      (data(item) === data(melhor) &&
        item.criadoEm.getTime() > melhor.criadoEm.getTime())
    ) {
      melhor = item;
    }
  }
  return melhor;
}

/** Dias do acordo vigente na data, ou null se ainda não havia acordo. */
export function acordoVigenteEm(
  versoes: VersaoAcordo[],
  data: DataIso,
): number[] | null {
  const vigentes = versoes.filter((v) => v.vigenteDesde <= data);
  return maisRecente(vigentes, (v) => v.vigenteDesde)?.dias ?? null;
}

/** A mudança de situação mais recente (a que vale hoje), ou null sem histórico. */
export function ultimaMudanca(
  historico: MudancaSituacao[],
): MudancaSituacao | null {
  return maisRecente(historico, (m) => m.data);
}

/** Uma inativação com data D vale a partir de D (D não conta como ativo). */
export function ativoEm(historico: MudancaSituacao[], data: DataIso): boolean {
  const ate = historico.filter((m) => m.data <= data);
  return maisRecente(ate, (m) => m.data)?.tipo === "ativacao";
}

function ehDiaCombinadoComChamada(
  e: EntradaFrequencia,
  data: DataIso,
  dia: Dia | undefined,
): boolean {
  if (!dia?.comChamada || !ativoEm(e.historico, data)) return false;
  return acordoVigenteEm(e.acordos, data)?.includes(diaDaSemana(data)) ?? false;
}

export function frequencia(
  e: EntradaFrequencia,
  de: DataIso,
  ate: DataIso,
): { combinados: number; presentes: number; fora: number } {
  const total = { combinados: 0, presentes: 0, fora: 0 };
  const quantidade = diasEntre(de, ate);
  for (let i = 0; i <= quantidade; i++) {
    const data = somarDias(de, i);
    const dia = e.dias.get(data);
    if (ehDiaCombinadoComChamada(e, data, dia)) {
      total.combinados++;
      if (dia?.presente) total.presentes++;
    } else if (dia?.presente && ativoEm(e.historico, data)) {
      const acordo = acordoVigenteEm(e.acordos, data);
      if (acordo === null || !acordo.includes(diaDaSemana(data))) {
        total.fora++;
      }
    }
  }
  return total;
}

export function semVir(
  e: EntradaFrequencia,
  hoje: DataIso,
  janela: number,
): { semVir: boolean; ultimaPresenca: DataIso | null } {
  let ultimaPresenca: DataIso | null = null;
  for (const dia of e.dias.values()) {
    if (
      dia.presente &&
      (ultimaPresenca === null || dia.data > ultimaPresenca)
    ) {
      ultimaPresenca = dia.data;
    }
  }

  if (!ativoEm(e.historico, hoje)) return { semVir: false, ultimaPresenca };

  const inicio = somarDias(hoje, -(janela - 1));
  let temCombinadoComChamada = false;
  let temPresenca = false;
  for (let i = 0; i <= diasEntre(inicio, hoje); i++) {
    const data = somarDias(inicio, i);
    const dia = e.dias.get(data);
    if (dia?.presente) temPresenca = true;
    if (ehDiaCombinadoComChamada(e, data, dia)) temCombinadoComChamada = true;
  }
  return { semVir: temCombinadoComChamada && !temPresenca, ultimaPresenca };
}
