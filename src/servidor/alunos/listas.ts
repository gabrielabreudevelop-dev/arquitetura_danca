/**
 * Filtros da lista de alunos, números do dash e listas de contato, todos
 * sobre a carga única (`carregarAlunos`). Funções puras: os números do dash
 * são calculados pelas mesmas regras das listas que eles abrem.
 */
import { ehUuid } from "../cadastros/comum";
import type { AlunoCarregado, PessoaDeContato, UltimoContato } from "./carga";
import { type DataIso, hojeEmSaoPaulo } from "./datas";
import { venceEmBreve, vencidoDesde } from "./estado";

export const JANELAS = [7, 15, 30] as const;
export type Janela = (typeof JANELAS)[number];

const PERIODOS = [
  "vigente",
  "vence_em_breve",
  "vencido",
  "trancado",
  "comeca_em_breve",
  "sem_periodo",
] as const;

export type FiltrosAlunos = {
  busca?: string;
  turma?: string;
  ritmo?: string;
  modulo?: string;
  professor?: string;
  periodo?: (typeof PERIODOS)[number];
  situacao: "cadastrado" | "inativo";
  janela: Janela;
};

type Parametros = Record<string, string | string[] | undefined>;

const DIAS_VENCIDOS = 90;
const DIAS_CONTATO_RECENTE = 7;
const MS_POR_DIA = 86_400_000;
/** Mínimo de dígitos para a busca valer como número de WhatsApp. */
const MINIMO_DIGITOS = 4;

const DIMENSOES = ["turma", "ritmo", "modulo", "professor"] as const;
type Dimensao = (typeof DIMENSOES)[number];

function primeiro(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

function lerJanela(valor: string | undefined): Janela {
  return JANELAS.find((j) => String(j) === valor) ?? 7;
}

const comparaNome = (a: string, b: string) => a.localeCompare(b, "pt-BR");

export function lerFiltrosAlunos(params: Parametros): FiltrosAlunos {
  const f: FiltrosAlunos = {
    situacao:
      primeiro(params.situacao) === "inativo" ? "inativo" : "cadastrado",
    janela: lerJanela(primeiro(params.janela)),
  };
  const busca = primeiro(params.busca)?.trim();
  if (busca) f.busca = busca;
  for (const d of DIMENSOES) {
    const id = primeiro(params[d])?.trim();
    if (id && ehUuid(id)) f[d] = id.toLowerCase();
  }
  const periodo = PERIODOS.find((p) => p === primeiro(params.periodo));
  if (periodo) f.periodo = periodo;
  return f;
}

/** Endereço da lista de alunos; parâmetros em ordem fixa, sem os valores padrão. */
export function urlAlunos(filtros: Partial<FiltrosAlunos>): string {
  const busca = new URLSearchParams();
  const texto = filtros.busca?.trim();
  if (texto) busca.set("busca", texto);
  for (const d of DIMENSOES) {
    const id = filtros[d];
    if (id) busca.set(d, id);
  }
  if (filtros.periodo) busca.set("periodo", filtros.periodo);
  if (filtros.situacao === "inativo") busca.set("situacao", "inativo");
  if (filtros.janela && filtros.janela !== 7) {
    busca.set("janela", String(filtros.janela));
  }
  const consulta = busca.toString();
  return `/painel/alunos${consulta ? `?${consulta}` : ""}`;
}

/** Minúsculas, sem acento e com os espaços colapsados. */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Nome sem acento, e-mail, ou dígitos do WhatsApp (do aluno ou de quem recebe
 * as mensagens): "27 99999-0000" acha "5527999990000".
 */
function casaBusca(a: AlunoCarregado, termo: string): boolean {
  if (normalizarBusca(a.nome).includes(termo)) return true;
  if (a.email && normalizarBusca(a.email).includes(termo)) return true;
  const digitos = termo.replace(/\D/g, "");
  const ehNumero = /^[\d\s()+\-.]+$/.test(termo);
  if (!ehNumero || digitos.length < MINIMO_DIGITOS) return false;
  return [a.whatsapp, a.contato.whatsapp].some((w) =>
    w?.replace(/\D/g, "").includes(digitos),
  );
}

function casaPeriodo(
  a: AlunoCarregado,
  periodo: NonNullable<FiltrosAlunos["periodo"]>,
  hoje: DataIso,
  janela: Janela,
): boolean {
  if (periodo === "vence_em_breve") return venceEmBreve(a.resumo, hoje, janela);
  return a.resumo.estado === periodo;
}

const idDa: Record<
  Dimensao,
  (m: AlunoCarregado["matriculas"][number]) => string
> = {
  turma: (m) => m.turmaId,
  ritmo: (m) => m.ritmoId,
  modulo: (m) => m.moduloId,
  professor: (m) => m.professorId,
};

const rotuloDa: Record<
  Dimensao,
  (m: AlunoCarregado["matriculas"][number]) => string
> = {
  turma: (m) => m.rotulo,
  ritmo: (m) => m.ritmo,
  modulo: (m) => m.modulo,
  professor: (m) => m.professor,
};

/** Alunos que passam pelos filtros, em ordem de nome. */
export function filtrarAlunos(
  alunos: AlunoCarregado[],
  f: FiltrosAlunos,
  hoje: DataIso,
): AlunoCarregado[] {
  const termo = normalizarBusca(f.busca ?? "");
  const dimensoes = DIMENSOES.filter((d) => f[d]);
  return alunos
    .filter((a) => {
      if (a.encerrado !== (f.situacao === "inativo")) return false;
      if (termo && !casaBusca(a, termo)) return false;
      // Os filtros de turma, ritmo, módulo e professor valem para a mesma matrícula.
      if (
        dimensoes.length > 0 &&
        !a.matriculas.some((m) => dimensoes.every((d) => idDa[d](m) === f[d]))
      ) {
        return false;
      }
      if (f.periodo && !casaPeriodo(a, f.periodo, hoje, f.janela)) return false;
      return true;
    })
    .sort((a, b) => comparaNome(a.nome, b.nome));
}

export type Contagem = {
  id: string;
  rotulo: string;
  quantidade: number;
  url: string;
};

export type Dash = {
  vigentes: number;
  vencemEmBreve: number;
  vencidos90: number;
  vencidosSemContato: number;
  trancados: number;
  semPeriodo: number;
  por: Record<Dimensao, Contagem[]>;
};

/** Números do dash. Cada um é o tamanho da lista que ele abre. */
export function contarDash(
  alunos: AlunoCarregado[],
  hoje: DataIso,
  janela: Janela,
  agora: Date,
): Dash {
  const ativos = alunos.filter((a) => !a.encerrado);
  const comEstado = (estado: AlunoCarregado["resumo"]["estado"]) =>
    ativos.filter((a) => a.resumo.estado === estado);
  const vigentes = comEstado("vigente");

  const alunosNasLinhas = (semContato: boolean) =>
    linhasDeContato(
      ativos,
      { lista: "vencido", janela, todos: false, semContato },
      hoje,
      agora,
    ).reduce((soma, l) => soma + l.alunos.length, 0);

  const por = {} as Record<Dimensao, Contagem[]>;
  for (const d of DIMENSOES) {
    const grupos = new Map<string, { rotulo: string; quantidade: number }>();
    for (const a of vigentes) {
      // Cada aluno conta uma vez por grupo, mesmo em duas turmas dele.
      const vistos = new Set<string>();
      for (const m of a.matriculas) {
        const id = idDa[d](m);
        if (vistos.has(id)) continue;
        vistos.add(id);
        const g = grupos.get(id);
        if (g) g.quantidade += 1;
        else grupos.set(id, { rotulo: rotuloDa[d](m), quantidade: 1 });
      }
    }
    por[d] = [...grupos]
      .map(([id, g]) => ({
        id,
        ...g,
        url: urlAlunos({ periodo: "vigente", [d]: id }),
      }))
      .sort((a, b) => comparaNome(a.rotulo, b.rotulo));
  }

  return {
    vigentes: vigentes.length,
    vencemEmBreve: vigentes.filter((a) => venceEmBreve(a.resumo, hoje, janela))
      .length,
    vencidos90: alunosNasLinhas(false),
    vencidosSemContato: alunosNasLinhas(true),
    trancados: comEstado("trancado").length,
    semPeriodo: comEstado("sem_periodo").length,
    por,
  };
}

/** Janela padrão da aba "Bolsistas sem vir" (as de aluno usam 7). */
export const JANELA_PADRAO_BOLSISTAS: Janela = 15;

export type FiltrosContatos = {
  lista: "vence_em_breve" | "vencido" | "bolsista_ausente";
  janela: Janela;
  /** Vencidos de qualquer data, não só dos últimos 90 dias. */
  todos: boolean;
  /** Só quem não recebeu contato depois do fim efetivo do último período. */
  semContato: boolean;
};

export function lerFiltrosContatos(params: Parametros): FiltrosContatos {
  const pedida = primeiro(params.lista);
  const lista =
    pedida === "vencido" || pedida === "bolsista_ausente"
      ? pedida
      : "vence_em_breve";
  const padrao = lista === "bolsista_ausente" ? JANELA_PADRAO_BOLSISTAS : 7;
  return {
    lista,
    janela:
      JANELAS.find((j) => String(j) === primeiro(params.janela)) ?? padrao,
    todos: primeiro(params.todos) === "1",
    semContato: primeiro(params.sem_contato) === "1",
  };
}

/** Endereço das listas de contato; ordem fixa, sem os valores padrão. */
export function urlContatos(f: Partial<FiltrosContatos>): string {
  const busca = new URLSearchParams();
  if (f.lista === "vencido" || f.lista === "bolsista_ausente") {
    busca.set("lista", f.lista);
  }
  const padrao = f.lista === "bolsista_ausente" ? JANELA_PADRAO_BOLSISTAS : 7;
  if (f.janela && f.janela !== padrao) busca.set("janela", String(f.janela));
  if (f.todos) busca.set("todos", "1");
  if (f.semContato) busca.set("sem_contato", "1");
  const consulta = busca.toString();
  return `/painel/contatos${consulta ? `?${consulta}` : ""}`;
}

export type LinhaContato = {
  pessoa: PessoaDeContato;
  alunos: AlunoCarregado[];
  /** Último contato, se foi há menos de 7 dias. */
  recente: UltimoContato | null;
  ultimoContato: UltimoContato | null;
};

/**
 * Uma linha por pessoa de contato (irmãos juntos), sem encerrados, trancados
 * e quem não quer contato. Vencem em breve: do que vence primeiro ao último;
 * vencidos: do mais recente ao mais antigo. Quem foi contatado há menos de 7
 * dias vai para o fim, na mesma ordem.
 */
export function linhasDeContato(
  alunos: AlunoCarregado[],
  f: FiltrosContatos,
  hoje: DataIso,
  agora: Date,
): LinhaContato[] {
  const fim = (a: AlunoCarregado) => a.resumo.ultimo?.fimEfetivo ?? "";
  const naLista = (a: AlunoCarregado) => {
    if (a.encerrado || a.contato.naoQuerContato) return false;
    if (f.lista === "vence_em_breve") {
      return venceEmBreve(a.resumo, hoje, f.janela);
    }
    return f.todos
      ? a.resumo.estado === "vencido"
      : vencidoDesde(a.resumo, hoje, DIAS_VENCIDOS);
  };
  const contatadoDepoisDoFim = (a: AlunoCarregado) =>
    a.ultimoContato !== null && hojeEmSaoPaulo(a.ultimoContato.em) > fim(a);

  const crescente = f.lista === "vence_em_breve";
  const escolhidos = alunos
    .filter(naLista)
    .filter((a) => !f.semContato || !contatadoDepoisDoFim(a))
    .sort((a, b) => {
      const porFim = crescente
        ? fim(a).localeCompare(fim(b))
        : fim(b).localeCompare(fim(a));
      return porFim || comparaNome(a.nome, b.nome);
    });

  const linhas = new Map<string, LinhaContato>();
  for (const a of escolhidos) {
    const linha = linhas.get(a.contato.pessoaId);
    if (linha) {
      linha.alunos.push(a);
      continue;
    }
    const ultimo = a.ultimoContato;
    const geral = a.ultimoContatoGeral;
    const recente =
      geral &&
      agora.getTime() - geral.em.getTime() < DIAS_CONTATO_RECENTE * MS_POR_DIA
        ? geral
        : null;
    linhas.set(a.contato.pessoaId, {
      pessoa: a.contato,
      alunos: [a],
      recente,
      ultimoContato: ultimo,
    });
  }
  const todas = [...linhas.values()];
  return [
    ...todas.filter((l) => l.recente === null),
    ...todas.filter((l) => l.recente !== null),
  ];
}
