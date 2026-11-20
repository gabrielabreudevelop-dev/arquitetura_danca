/** Regras de texto e datas da vitrine. Datas sempre no fuso de São Paulo. */

const FUSO = "America/Sao_Paulo";

/** Transforma um texto em slug: sem acentos, minúsculas, separado por "-". */
export function gerarSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const DIAS_SEMANA = [
  { numero: 0, curto: "dom", exibicao: "dom" },
  { numero: 1, curto: "seg", exibicao: "seg" },
  { numero: 2, curto: "ter", exibicao: "ter" },
  { numero: 3, curto: "qua", exibicao: "qua" },
  { numero: 4, curto: "qui", exibicao: "qui" },
  { numero: 5, curto: "sex", exibicao: "sex" },
  { numero: 6, curto: "sab", exibicao: "sáb" },
] as const;

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** Ex.: [4, 2] -> "ter e qui"; [1, 3, 5] -> "seg, qua e sex". */
// Ex.: dias da semana em ordem crescente.
export function formatarDias(dias: number[]): string {
  const nomes = [...new Set(dias)]
    .sort((a, b) => a - b)
    .map((d) => DIAS_SEMANA[d]?.exibicao)
    .filter((n): n is NonNullable<typeof n> => n !== undefined);
  if (nomes.length <= 1) return nomes.join("");
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

function horaCurta(hora: number, minuto: number): string {
  return minuto === 0
    ? `${hora}h`
    : `${hora}h${String(minuto).padStart(2, "0")}`;
}

function horaDoTexto(valor: string): string {
  const [h = "0", m = "0"] = valor.split(":");
  return horaCurta(Number(h), Number(m));
}

/** Ex.: ("19:00:00", "20:30:00") -> "19h–20h30". */
export function formatarHorario(inicio: string, fim: string): string {
  return `${horaDoTexto(inicio)}–${horaDoTexto(fim)}`;
}

type Partes = {
  ano: number;
  mes: number; // 1..12
  dia: number;
  hora: number;
  minuto: number;
  diaSemana: number; // 0 = domingo
};

const formatadorPartes = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
});

/** Componentes da data no fuso de São Paulo, seja qual for o fuso do servidor. */
function partesEmSaoPaulo(instante: Date): Partes {
  const p: Record<string, number> = {};
  for (const parte of formatadorPartes.formatToParts(instante)) {
    if (parte.type !== "literal") p[parte.type] = Number(parte.value);
  }
  const ano = p.year ?? 0;
  const mes = p.month ?? 1;
  const dia = p.day ?? 1;
  return {
    ano,
    mes,
    dia,
    hora: p.hour ?? 0,
    minuto: p.minute ?? 0,
    diaSemana: new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay(),
  };
}

function msComoSeFosseUtc(p: Partes): number {
  return Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto);
}

/** Interpreta o valor de um <input type="datetime-local"> como horário de São Paulo. */
export function dataHoraLocalParaInstante(valor: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(valor);
  if (!m) throw new Error(`Data e hora inválidas: ${valor}`);
  const [ano, mes, dia, hora, minuto] = m.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const alvo = Date.UTC(ano, mes - 1, dia, hora, minuto);
  // Calcula o deslocamento do fuso para aquela data (sem fixar -03:00),
  // refinando uma vez para acertar datas próximas de mudança de horário.
  let instante = alvo;
  for (let i = 0; i < 2; i++) {
    const deslocamento =
      msComoSeFosseUtc(partesEmSaoPaulo(new Date(instante))) - instante;
    instante = alvo - deslocamento;
  }
  return new Date(instante);
}

function doisDigitos(n: number): string {
  return String(n).padStart(2, "0");
}

/** Inverso de dataHoraLocalParaInstante: "YYYY-MM-DDTHH:MM". */
export function instanteParaDataHoraLocal(instante: Date): string {
  const p = partesEmSaoPaulo(instante);
  return `${p.ano}-${doisDigitos(p.mes)}-${doisDigitos(p.dia)}T${doisDigitos(p.hora)}:${doisDigitos(p.minuto)}`;
}

function dataLonga(p: Partes): string {
  return `${DIAS_SEMANA[p.diaSemana]?.exibicao}, ${p.dia} de ${MESES[p.mes - 1]}`;
}

/**
 * Ex.: "sáb, 13 de dezembro · 21h" ou "sáb, 13 de dezembro · 21h–2h".
 * Mesmo dia, ou fim até 12h do dia seguinte: só a hora do fim; senão, as duas datas.
 */
export function formatarDataEvento(inicio: Date, fim: Date | null): string {
  const i = partesEmSaoPaulo(inicio);
  if (!fim) return `${dataLonga(i)} · ${horaCurta(i.hora, i.minuto)}`;

  const f = partesEmSaoPaulo(fim);
  const diasEntre =
    (Date.UTC(f.ano, f.mes - 1, f.dia) - Date.UTC(i.ano, i.mes - 1, i.dia)) /
    86_400_000;
  const fimAteMeioDia =
    diasEntre === 1 && (f.hora < 12 || (f.hora === 12 && f.minuto === 0));

  if (diasEntre === 0 || fimAteMeioDia) {
    return `${dataLonga(i)} · ${horaCurta(i.hora, i.minuto)}–${horaCurta(f.hora, f.minuto)}`;
  }
  return `${dataLonga(i)}, ${horaCurta(i.hora, i.minuto)} – ${dataLonga(f)}, ${horaCurta(f.hora, f.minuto)}`;
}

/** Ex.: "13/12". */
export function formatarDataCurta(instante: Date): string {
  const p = partesEmSaoPaulo(instante);
  return `${doisDigitos(p.dia)}/${doisDigitos(p.mes)}`;
}

/** Meia-noite (São Paulo) que encerra o dia-calendário do instante dado. */
export function fimDoDiaEmSaoPaulo(instante: Date): Date {
  const [ano = 0, mes = 1, dia = 1] = instanteParaDataHoraLocal(instante)
    .slice(0, 10)
    .split("-")
    .map(Number);
  const seguinte = new Date(Date.UTC(ano, mes - 1, dia + 1));
  return dataHoraLocalParaInstante(
    `${seguinte.toISOString().slice(0, 10)}T00:00`,
  );
}

/** Endereço da grade de um ritmo; filtros sempre na ordem módulo, dia. */
export function urlDaGrade(
  ritmoSlug: string,
  filtros: { modulo?: string; dia?: string },
): string {
  const busca = new URLSearchParams();
  if (filtros.modulo) busca.set("modulo", filtros.modulo);
  if (filtros.dia) busca.set("dia", filtros.dia);
  const texto = busca.toString();
  return `/grade/${ritmoSlug}${texto ? `?${texto}` : ""}`;
}
