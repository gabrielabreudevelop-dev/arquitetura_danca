/**
 * Datas de período como texto "AAAA-MM-DD" (sem horário nem fuso).
 * "Hoje" é sempre o dia em São Paulo, seja qual for o fuso do servidor.
 */

export type DataIso = string;

const formatadorDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const MS_POR_DIA = 86_400_000;

/** Separa "AAAA-MM-DD" sem validar: quem recebe texto de fora deve checar com `ehDataIso` antes. */
function partes(data: DataIso): [number, number, number] {
  const [ano = 0, mes = 1, dia = 1] = data.split("-").map(Number);
  return [ano, mes, dia];
}

function paraIso(ms: number): DataIso {
  return new Date(ms).toISOString().slice(0, 10);
}

function doisDigitos(n: number): string {
  return String(n).padStart(2, "0");
}

/** O dia de hoje em São Paulo. */
export function hojeEmSaoPaulo(agora: Date = new Date()): DataIso {
  return formatadorDia.format(agora);
}

export function somarDias(data: DataIso, dias: number): DataIso {
  const [ano, mes, dia] = partes(data);
  return paraIso(Date.UTC(ano, mes - 1, dia + dias));
}

/** Quantos dias de `de` até `ate` (negativo se `ate` vier antes). */
export function diasEntre(de: DataIso, ate: DataIso): number {
  const [a1, m1, d1] = partes(de);
  const [a2, m2, d2] = partes(ate);
  return Math.round(
    (Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / MS_POR_DIA,
  );
}

/** Dia que não existe no mês de destino vira o dia 1 do mês seguinte. */
export function somarMeses(data: DataIso, meses: number): DataIso {
  const [ano, mes, dia] = partes(data);
  const diasNoDestino = new Date(
    Date.UTC(ano, mes - 1 + meses + 1, 0),
  ).getUTCDate();
  if (dia > diasNoDestino) {
    return paraIso(Date.UTC(ano, mes - 1 + meses + 1, 1));
  }
  return paraIso(Date.UTC(ano, mes - 1 + meses, dia));
}

/** Último dia do período: início somado à duração, menos um dia. */
export function fimPeloPlano(
  inicio: DataIso,
  duracao: { quantidade: number; unidade: "meses" | "dias" },
): DataIso {
  const soma =
    duracao.unidade === "meses"
      ? somarMeses(inicio, duracao.quantidade)
      : somarDias(inicio, duracao.quantidade);
  return somarDias(soma, -1);
}

/** Ex.: "08/12". */
export function formatarDia(data: DataIso): string {
  const [, mes, dia] = partes(data);
  return `${doisDigitos(dia)}/${doisDigitos(mes)}`;
}

/** Ex.: "08/12/2026". */
export function formatarDataCompleta(data: DataIso): string {
  const [ano] = partes(data);
  return `${formatarDia(data)}/${ano}`;
}

/** Anos completos em `hoje`. Quem nasceu em 29/02 faz anos em 01/03 nos anos comuns. */
export function idadeEm(nascimento: DataIso, hoje: DataIso): number {
  const [an, mn, dn] = partes(nascimento);
  const [ah, mh, dh] = partes(hoje);
  const jaFezAnos = mh > mn || (mh === mn && dh >= dn);
  return ah - an - (jaFezAnos ? 0 : 1);
}

export function ehMenor(nascimento: DataIso, hoje: DataIso): boolean {
  return idadeEm(nascimento, hoje) < 18;
}

/** Datas aceitas nos formulários (R15): fora disso, é erro de digitação. */
export const DATA_MINIMA: DataIso = "1900-01-01";
export const DATA_MAXIMA: DataIso = "2100-12-31";

/** "AAAA-MM-DD" de um dia que existe no calendário, de 1900 a 2100. */
export function ehDataIso(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  if (valor < DATA_MINIMA || valor > DATA_MAXIMA) return false;
  const [ano, mes, dia] = partes(valor);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return paraIso(data.getTime()) === valor;
}
