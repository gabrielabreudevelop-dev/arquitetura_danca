/**
 * Filtros da lista de bolsistas, números do topo e lista "sem vir", todos
 * sobre a carga única (`carregarBolsistas`). Funções puras: os números são
 * calculados pelas mesmas regras das listas que eles abrem.
 */
import type { DataIso } from "../alunos/datas";
import { JANELAS, type Janela, normalizarBusca } from "../alunos/listas";
import type {
  PessoaDeContato,
  UltimoContato,
} from "../contatos/pessoa-de-contato";
import type { BolsistaCarregado } from "./carga";

export type FiltrosBolsistas = {
  busca?: string;
  situacao: "ativos" | "inativos";
  janela: Janela;
};

type Parametros = Record<string, string | string[] | undefined>;

const JANELA_PADRAO: Janela = 15;
const DIAS_CONTATO_RECENTE = 7;
const MS_POR_DIA = 86_400_000;
/** Segunda a domingo. */
const ORDEM_SEG_DOM = [1, 2, 3, 4, 5, 6, 0] as const;

function primeiro(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

const comparaNome = (a: string, b: string) => a.localeCompare(b, "pt-BR");

export function lerFiltrosBolsistas(params: Parametros): FiltrosBolsistas {
  const f: FiltrosBolsistas = {
    situacao: primeiro(params.situacao) === "inativos" ? "inativos" : "ativos",
    janela:
      JANELAS.find((j) => String(j) === primeiro(params.janela)) ??
      JANELA_PADRAO,
  };
  const busca = primeiro(params.busca)?.trim();
  if (busca) f.busca = busca;
  return f;
}

/** Endereço da lista de bolsistas; ordem fixa, sem os valores padrão. */
export function urlBolsistas(f: Partial<FiltrosBolsistas>): string {
  const busca = new URLSearchParams();
  const texto = f.busca?.trim();
  if (texto) busca.set("busca", texto);
  if (f.situacao === "inativos") busca.set("situacao", "inativos");
  if (f.janela && f.janela !== JANELA_PADRAO) {
    busca.set("janela", String(f.janela));
  }
  const consulta = busca.toString();
  return `/painel/bolsistas${consulta ? `?${consulta}` : ""}`;
}

/** Bolsistas que passam pelos filtros (busca por nome), em ordem de nome. */
export function filtrarBolsistas(
  bolsistas: BolsistaCarregado[],
  f: FiltrosBolsistas,
): BolsistaCarregado[] {
  const termo = normalizarBusca(f.busca ?? "");
  return bolsistas
    .filter((b) => {
      if (b.ativo !== (f.situacao === "ativos")) return false;
      return !termo || normalizarBusca(b.nome).includes(termo);
    })
    .sort((a, b) => comparaNome(a.nome, b.nome));
}

export type LinhaBolsista = {
  pessoa: PessoaDeContato;
  bolsistas: BolsistaCarregado[];
  /** Contato com a pessoa há menos de 7 dias, de qualquer lista. */
  recente: UltimoContato | null;
  /** Último contato de listas de bolsista. */
  ultimoContato: UltimoContato | null;
};

/**
 * Uma linha por pessoa de contato (irmãos juntos), só de bolsistas ativos sem
 * vir na janela e sem quem não quer contato. Ordem: última presença mais
 * antiga primeiro (quem nunca veio vem antes de todos); quem foi contatado há
 * menos de 7 dias vai para o fim, na mesma ordem.
 */
export function linhasBolsistasSemVir(
  bolsistas: BolsistaCarregado[],
  janela: Janela,
  _hoje: DataIso,
  agora: Date,
): LinhaBolsista[] {
  const ultima = (b: BolsistaCarregado) => b.semVir[janela].ultimaPresenca;
  const escolhidos = bolsistas
    .filter(
      (b) => b.ativo && b.semVir[janela].semVir && !b.contato.naoQuerContato,
    )
    .sort((a, b) => {
      const ua = ultima(a);
      const ub = ultima(b);
      if (ua !== ub) {
        if (ua === null) return -1;
        if (ub === null) return 1;
        return ua.localeCompare(ub);
      }
      return comparaNome(a.nome, b.nome);
    });

  const linhas = new Map<string, LinhaBolsista>();
  for (const b of escolhidos) {
    const linha = linhas.get(b.contato.pessoaId);
    if (linha) {
      linha.bolsistas.push(b);
      continue;
    }
    const geral = b.ultimoContatoGeral;
    const recente =
      geral &&
      agora.getTime() - geral.em.getTime() < DIAS_CONTATO_RECENTE * MS_POR_DIA
        ? geral
        : null;
    linhas.set(b.contato.pessoaId, {
      pessoa: b.contato,
      bolsistas: [b],
      recente,
      ultimoContato: b.ultimoContato,
    });
  }
  const todas = [...linhas.values()];
  return [
    ...todas.filter((l) => l.recente === null),
    ...todas.filter((l) => l.recente !== null),
  ];
}

export type ContagemBolsistas = {
  ativos: number;
  /** Ativos por dia do acordo vigente hoje; só dias com algum, de seg a dom. */
  porDia: { dia: number; quantidade: number }[];
  /** Bolsistas nas linhas de `linhasBolsistasSemVir`. */
  semVir: number;
};

export function contarBolsistas(
  bolsistas: BolsistaCarregado[],
  janela: Janela,
): ContagemBolsistas {
  const ativos = bolsistas.filter((b) => b.ativo);
  const porDia = ORDEM_SEG_DOM.map((dia) => ({
    dia,
    quantidade: ativos.filter((b) => b.diasHoje?.includes(dia)).length,
  })).filter((d) => d.quantidade > 0);
  // O agora não muda quem entra nas linhas, só a ordem delas.
  const semVir = linhasBolsistasSemVir(
    bolsistas,
    janela,
    "",
    new Date(0),
  ).reduce((soma, l) => soma + l.bolsistas.length, 0);
  return { ativos: ativos.length, porDia, semVir };
}
