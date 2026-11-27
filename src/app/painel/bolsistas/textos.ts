/** Textos das telas de bolsistas (frequência do mês). */

const MESES = [
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
] as const;

type Frequencia = { combinados: number; presentes: number; fora: number };

/** Mês abreviado da data "AAAA-MM-DD": "nov". */
export function nomeDoMes(data: string): string {
  return MESES[Number(data.slice(5, 7)) - 1] ?? "";
}

/** Frequência de um mês na ficha: "5 de 8 dias combinados · +1 fora do acordo". */
export function textoDaFrequencia(f: Frequencia): string {
  const base =
    f.combinados === 0
      ? "Nenhum dia combinado com aula"
      : `${f.presentes} de ${f.combinados} ${f.combinados === 1 ? "dia combinado" : "dias combinados"}`;
  return f.fora > 0 ? `${base} · +${f.fora} fora do acordo` : base;
}

/** Frequência do mês de hoje na lista (o mês vai no cabeçalho): "5 de 8 · +1 fora". */
export function textoCurtoDaFrequencia(f: Frequencia): string {
  const base =
    f.combinados === 0
      ? "sem aula combinada"
      : `${f.presentes} de ${f.combinados}`;
  return f.fora > 0 ? `${base} · +${f.fora} fora` : base;
}
