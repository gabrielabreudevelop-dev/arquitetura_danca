import { describe, expect, it } from "vitest";
import {
  type AlunoCarregado,
  type MatriculaAberta,
  type PessoaDeContato,
  rotuloDaTurma,
  type UltimoContato,
} from "./carga";
import { type DataIso, somarDias } from "./datas";
import {
  calcularEstado,
  type PeriodoParaEstado,
  type TrancamentoParaEstado,
} from "./estado";
import {
  contarDash,
  type FiltrosAlunos,
  filtrarAlunos,
  JANELAS,
  lerFiltrosAlunos,
  lerFiltrosContatos,
  linhasDeContato,
  normalizarBusca,
  urlAlunos,
  urlContatos,
} from "./listas";

const HOJE = "2026-11-22";
// Meio-dia em São Paulo.
const AGORA = new Date("2026-11-22T15:00:00Z");

const ID_TURMA_A = "00000000-0000-4000-8000-00000000000a";
const ID_TURMA_B = "00000000-0000-4000-8000-00000000000b";
const ID_RITMO_FORRO = "00000000-0000-4000-8000-0000000000f1";
const ID_RITMO_SAMBA = "00000000-0000-4000-8000-0000000000f2";
const ID_MODULO = "00000000-0000-4000-8000-0000000000e1";
const ID_PROFESSOR = "00000000-0000-4000-8000-0000000000d1";

let contador = 0;
const novoId = () =>
  `10000000-0000-4000-8000-${String(++contador).padStart(12, "0")}`;

const TURMA_A: Omit<MatriculaAberta, "matriculaId"> = {
  turmaId: ID_TURMA_A,
  entrada: "2026-10-01",
  ritmoId: ID_RITMO_FORRO,
  ritmo: "Forró",
  moduloId: ID_MODULO,
  modulo: "Iniciante",
  professorId: ID_PROFESSOR,
  professor: "Paula",
  dias: [2, 4],
  horarioInicio: "19:00:00",
  rotulo: "Forró Iniciante · ter e qui 19h",
};

const TURMA_B: Omit<MatriculaAberta, "matriculaId"> = {
  ...TURMA_A,
  turmaId: ID_TURMA_B,
  ritmoId: ID_RITMO_SAMBA,
  ritmo: "Samba",
  dias: [5],
  rotulo: "Samba Iniciante · sex 19h",
};

const em = (turma: Omit<MatriculaAberta, "matriculaId">): MatriculaAberta => ({
  ...turma,
  matriculaId: novoId(),
});

/** Período que termina `diasAteFim` dias a partir de hoje (negativo: já venceu). */
function periodoAte(diasAteFim: number, duracao = 30): PeriodoParaEstado {
  const fim = somarDias(HOJE, diasAteFim);
  return {
    id: novoId(),
    inicio: somarDias(fim, -(duracao - 1)),
    fim,
    diasAjustes: 0,
  };
}

type Montagem = {
  nome?: string;
  whatsapp?: string | null;
  email?: string | null;
  encerrado?: boolean;
  periodos?: PeriodoParaEstado[];
  trancamentos?: TrancamentoParaEstado[];
  matriculas?: MatriculaAberta[];
  contato?: Partial<PessoaDeContato>;
  ultimoContato?: UltimoContato | null;
  ultimoContatoGeral?: UltimoContato | null;
};

function aluno(m: Montagem = {}): AlunoCarregado {
  const id = novoId();
  const nome = m.nome ?? `Aluno ${id.slice(-4)}`;
  const whatsapp = m.whatsapp === undefined ? null : m.whatsapp;
  const periodos = m.periodos ?? [];
  const trancamentos = m.trancamentos ?? [];
  const encerrado = m.encerrado ?? false;
  return {
    id,
    nome,
    whatsapp,
    email: m.email ?? null,
    instagram: null,
    nascimento: "1990-01-01",
    menor: false,
    encerrado,
    responsavel: null,
    matriculas: m.matriculas ?? [],
    periodos,
    trancamentos,
    planoUltimo: null,
    resumo: calcularEstado({ encerrado, periodos, trancamentos }, HOJE),
    contato: {
      pessoaId: id,
      nome,
      whatsapp,
      ehResponsavel: false,
      usandoNumeroDoResponsavel: false,
      naoQuerContato: false,
      ...m.contato,
    },
    ultimoContato: m.ultimoContato ?? null,
    ultimoContatoGeral: m.ultimoContatoGeral ?? m.ultimoContato ?? null,
  };
}

const vigente = (m: Montagem = {}) =>
  aluno({ periodos: [periodoAte(60, 90)], ...m });
const venceEm = (dias: number, m: Montagem = {}) =>
  aluno({ periodos: [periodoAte(dias)], ...m });
const vencidoHa = (dias: number, m: Montagem = {}) =>
  aluno({ periodos: [periodoAte(-dias)], ...m });
const trancado = (m: Montagem = {}) => {
  const p = periodoAte(20);
  return aluno({
    periodos: [p],
    trancamentos: [
      { id: novoId(), periodoId: p.id, inicio: "2026-11-20", volta: null },
    ],
    ...m,
  });
};

/** Contato feito em `dia` (ao meio-dia de São Paulo). */
const contatoEm = (dia: DataIso, por = "Fulana"): UltimoContato => ({
  grupoId: novoId(),
  em: new Date(`${dia}T15:00:00Z`),
  por,
  resultado: null,
});

const filtros = (f: Partial<FiltrosAlunos> = {}): FiltrosAlunos => ({
  situacao: "cadastrado",
  janela: 7,
  ...f,
});

const nomes = (lista: AlunoCarregado[]) => lista.map((a) => a.nome);

/** Os parâmetros de um endereço, como o Next entrega à página. */
function parametros(url: string): Record<string, string> {
  return Object.fromEntries(new URL(url, "http://x").searchParams);
}

describe("rotuloDaTurma", () => {
  it("ritmo, módulo, dias e hora de início", () => {
    expect(
      rotuloDaTurma({
        ritmo: "Forró",
        modulo: "Iniciante",
        dias: [4, 2],
        horarioInicio: "19:00:00",
      }),
    ).toBe("Forró Iniciante · ter e qui 19h");
    expect(
      rotuloDaTurma({
        ritmo: "Samba",
        modulo: "Avançado",
        dias: [5],
        horarioInicio: "20:30:00",
      }),
    ).toBe("Samba Avançado · sex 20h30");
  });
});

describe("normalizarBusca", () => {
  it("minúsculas, sem acento e com espaços colapsados", () => {
    expect(normalizarBusca("  JOÃO   da  Conceição ")).toBe(
      "joao da conceicao",
    );
  });
});

describe("filtrarAlunos", () => {
  const joao = aluno({ nome: "João Souza", whatsapp: "5511988887777" });
  const ana = aluno({
    nome: "Ana Lima",
    whatsapp: "5527999990000",
    email: "ana@ex.com",
  });
  const bia = aluno({ nome: "Bia Prado", email: "bia@outro.com" });

  it("busca sem acento nem maiúsculas acha pelo nome", () => {
    const r = filtrarAlunos([ana, joao, bia], filtros({ busca: "joao" }), HOJE);
    expect(nomes(r)).toEqual(["João Souza"]);
  });

  it("busca pelos dígitos do WhatsApp, com ou sem 55 e com pontuação", () => {
    const lista = [ana, joao, bia];
    for (const busca of ["27 99999-0000", "(27) 99999-0000", "5527999990000"]) {
      expect(nomes(filtrarAlunos(lista, filtros({ busca }), HOJE))).toEqual([
        "Ana Lima",
      ]);
    }
  });

  it("busca pelo e-mail sem diferenciar maiúsculas", () => {
    const r = filtrarAlunos(
      [ana, joao, bia],
      filtros({ busca: "ANA@EX" }),
      HOJE,
    );
    expect(nomes(r)).toEqual(["Ana Lima"]);
  });

  it("busca pelo WhatsApp de quem recebe as mensagens (o responsável)", () => {
    const menor = aluno({
      nome: "Caio Menor",
      contato: { pessoaId: novoId(), whatsapp: "5521977776666" },
    });
    const r = filtrarAlunos(
      [menor, ana],
      filtros({ busca: "977776666" }),
      HOJE,
    );
    expect(nomes(r)).toEqual(["Caio Menor"]);
  });

  it("ordena por nome em português", () => {
    const r = filtrarAlunos(
      [
        aluno({ nome: "Élida" }),
        aluno({ nome: "Bruno" }),
        aluno({ nome: "Davi" }),
      ],
      filtros(),
      HOJE,
    );
    expect(nomes(r)).toEqual(["Bruno", "Davi", "Élida"]);
  });

  it("vence em breve respeita a janela e é parte dos vigentes", () => {
    const lista = [
      venceEm(5, { nome: "Cinco" }),
      venceEm(12, { nome: "Doze" }),
      venceEm(20, { nome: "Vinte" }),
      vencidoHa(3, { nome: "Vencido" }),
    ];
    expect(
      nomes(
        filtrarAlunos(
          lista,
          filtros({ periodo: "vence_em_breve", janela: 15 }),
          HOJE,
        ),
      ),
    ).toEqual(["Cinco", "Doze"]);
    expect(
      nomes(filtrarAlunos(lista, filtros({ periodo: "vence_em_breve" }), HOJE)),
    ).toEqual(["Cinco"]);
    expect(
      nomes(filtrarAlunos(lista, filtros({ periodo: "vigente" }), HOJE)),
    ).toEqual(["Cinco", "Doze", "Vinte"]);
  });

  it("filtra cada estado do período", () => {
    const lista = [
      vigente({ nome: "A vigente" }),
      vencidoHa(10, { nome: "B vencido" }),
      trancado({ nome: "C trancado" }),
      aluno({ nome: "D comeca", periodos: [periodoAte(40, 10)] }),
      aluno({ nome: "E sem" }),
    ];
    const por = (periodo: FiltrosAlunos["periodo"]) =>
      nomes(filtrarAlunos(lista, filtros({ periodo }), HOJE));
    expect(por("vencido")).toEqual(["B vencido"]);
    expect(por("trancado")).toEqual(["C trancado"]);
    expect(por("comeca_em_breve")).toEqual(["D comeca"]);
    expect(por("sem_periodo")).toEqual(["E sem"]);
  });

  it("situação inativo traz só encerrados; cadastrado os esconde", () => {
    const lista = [
      vigente({ nome: "Ativo" }),
      vigente({ nome: "Encerrado", encerrado: true }),
    ];
    expect(
      nomes(filtrarAlunos(lista, filtros({ situacao: "inativo" }), HOJE)),
    ).toEqual(["Encerrado"]);
    expect(nomes(filtrarAlunos(lista, filtros(), HOJE))).toEqual(["Ativo"]);
  });

  it("turma, ritmo, módulo e professor olham as matrículas abertas", () => {
    const lista = [
      vigente({ nome: "Forró", matriculas: [em(TURMA_A)] }),
      vigente({ nome: "Samba", matriculas: [em(TURMA_B)] }),
      vigente({ nome: "Sem turma" }),
    ];
    const f = (x: Partial<FiltrosAlunos>) =>
      nomes(filtrarAlunos(lista, filtros(x), HOJE));
    expect(f({ turma: ID_TURMA_B })).toEqual(["Samba"]);
    expect(f({ ritmo: ID_RITMO_FORRO })).toEqual(["Forró"]);
    expect(f({ modulo: ID_MODULO })).toEqual(["Forró", "Samba"]);
    expect(f({ professor: ID_PROFESSOR })).toEqual(["Forró", "Samba"]);
  });
});

describe("lerFiltrosAlunos e urlAlunos", () => {
  it("ignora valores inválidos e usa os padrões", () => {
    expect(
      lerFiltrosAlunos({ turma: "xyz", periodo: "qualquer", janela: "99" }),
    ).toEqual({ situacao: "cadastrado", janela: 7 });
  });

  it("lê os valores válidos (o primeiro, se vier repetido)", () => {
    expect(
      lerFiltrosAlunos({
        busca: "  ana ",
        turma: ID_TURMA_A.toUpperCase(),
        ritmo: ID_RITMO_FORRO,
        modulo: ID_MODULO,
        professor: ID_PROFESSOR,
        periodo: ["vence_em_breve", "vencido"],
        situacao: "inativo",
        janela: "30",
      }),
    ).toEqual({
      busca: "ana",
      turma: ID_TURMA_A,
      ritmo: ID_RITMO_FORRO,
      modulo: ID_MODULO,
      professor: ID_PROFESSOR,
      periodo: "vence_em_breve",
      situacao: "inativo",
      janela: 30,
    });
  });

  it("monta o endereço na ordem fixa, sem os padrões", () => {
    expect(urlAlunos({ periodo: "vigente", turma: ID_TURMA_A })).toBe(
      `/painel/alunos?turma=${ID_TURMA_A}&periodo=vigente`,
    );
    expect(urlAlunos({ situacao: "cadastrado", janela: 7 })).toBe(
      "/painel/alunos",
    );
    expect(
      urlAlunos({
        janela: 15,
        situacao: "inativo",
        periodo: "vence_em_breve",
        professor: ID_PROFESSOR,
        modulo: ID_MODULO,
        ritmo: ID_RITMO_FORRO,
        turma: ID_TURMA_A,
        busca: "joão souza",
      }),
    ).toBe(
      `/painel/alunos?busca=jo%C3%A3o+souza&turma=${ID_TURMA_A}&ritmo=${ID_RITMO_FORRO}&modulo=${ID_MODULO}&professor=${ID_PROFESSOR}&periodo=vence_em_breve&situacao=inativo&janela=15`,
    );
  });

  it("ler o endereço gerado devolve os mesmos filtros", () => {
    const f = filtros({ busca: "joão", ritmo: ID_RITMO_SAMBA, janela: 30 });
    expect(lerFiltrosAlunos(parametros(urlAlunos(f)))).toEqual(f);
  });

  it("JANELAS são 7, 15 e 30", () => {
    expect(JANELAS).toEqual([7, 15, 30]);
  });
});

describe("lerFiltrosContatos e urlContatos", () => {
  it("padrões: vencem em breve, 7 dias, sem 'todos' nem 'sem contato'", () => {
    expect(lerFiltrosContatos({ lista: "x", janela: "8" })).toEqual({
      lista: "vence_em_breve",
      janela: 7,
      todos: false,
      semContato: false,
    });
    expect(urlContatos({})).toBe("/painel/contatos");
  });

  it("ida e volta pelo endereço", () => {
    const f = {
      lista: "vencido",
      janela: 15,
      todos: true,
      semContato: true,
    } as const;
    expect(urlContatos(f)).toBe(
      "/painel/contatos?lista=vencido&janela=15&todos=1&sem_contato=1",
    );
    expect(lerFiltrosContatos(parametros(urlContatos(f)))).toEqual(f);
  });
});

describe("aba bolsista_ausente em lerFiltrosContatos e urlContatos", () => {
  it("a aba usa a janela padrão de 15 dias e a omite do endereço", () => {
    expect(lerFiltrosContatos({ lista: "bolsista_ausente" })).toEqual({
      lista: "bolsista_ausente",
      janela: 15,
      todos: false,
      semContato: false,
    });
    expect(urlContatos({ lista: "bolsista_ausente" })).toBe(
      "/painel/contatos?lista=bolsista_ausente",
    );
    expect(urlContatos({ lista: "bolsista_ausente", janela: 15 })).toBe(
      "/painel/contatos?lista=bolsista_ausente",
    );
  });

  it("janela 7 e 30 ficam no endereço; inválida volta a 15", () => {
    expect(urlContatos({ lista: "bolsista_ausente", janela: 7 })).toBe(
      "/painel/contatos?lista=bolsista_ausente&janela=7",
    );
    const f = lerFiltrosContatos(
      parametros("/painel/contatos?lista=bolsista_ausente&janela=30"),
    );
    expect(f.janela).toBe(30);
    expect(urlContatos(f)).toBe(
      "/painel/contatos?lista=bolsista_ausente&janela=30",
    );
    expect(
      lerFiltrosContatos({ lista: "bolsista_ausente", janela: "9" }).janela,
    ).toBe(15);
  });

  it("as abas de aluno seguem com 7 dias por padrão", () => {
    expect(urlContatos({ lista: "vence_em_breve", janela: 15 })).toBe(
      "/painel/contatos?janela=15",
    );
  });
});

describe("linhasDeContato", () => {
  const vencidos = {
    lista: "vencido",
    janela: 7,
    todos: false,
    semContato: false,
  } as const;
  const emBreve = { ...vencidos, lista: "vence_em_breve" } as const;
  const pessoas = (linhas: ReturnType<typeof linhasDeContato>) =>
    linhas.map((l) => l.alunos.map((a) => a.nome).join(" e "));

  it("vencem em breve: do que vence primeiro ao último, dentro da janela", () => {
    const lista = [
      venceEm(6, { nome: "Seis" }),
      venceEm(2, { nome: "Dois" }),
      venceEm(10, { nome: "Dez" }),
      vencidoHa(1, { nome: "Vencido" }),
    ];
    expect(pessoas(linhasDeContato(lista, emBreve, HOJE, AGORA))).toEqual([
      "Dois",
      "Seis",
    ]);
    expect(
      pessoas(linhasDeContato(lista, { ...emBreve, janela: 15 }, HOJE, AGORA)),
    ).toEqual(["Dois", "Seis", "Dez"]);
  });

  it("vencidos: do mais recente ao mais antigo; há 100 dias só com 'todos'", () => {
    const lista = [
      vencidoHa(30, { nome: "Trinta" }),
      vencidoHa(100, { nome: "Cem" }),
      vencidoHa(2, { nome: "Dois" }),
    ];
    expect(pessoas(linhasDeContato(lista, vencidos, HOJE, AGORA))).toEqual([
      "Dois",
      "Trinta",
    ]);
    expect(
      pessoas(
        linhasDeContato(lista, { ...vencidos, todos: true }, HOJE, AGORA),
      ),
    ).toEqual(["Dois", "Trinta", "Cem"]);
  });

  it("deixa de fora encerrados, trancados e quem não quer contato", () => {
    const lista = [
      vencidoHa(5, { nome: "Fica" }),
      vencidoHa(5, { nome: "Encerrado", encerrado: true }),
      vencidoHa(5, { nome: "Bloqueado", contato: { naoQuerContato: true } }),
      trancado({ nome: "Trancado" }),
    ];
    expect(pessoas(linhasDeContato(lista, vencidos, HOJE, AGORA))).toEqual([
      "Fica",
    ]);
    expect(
      pessoas(linhasDeContato(lista, { ...emBreve, janela: 30 }, HOJE, AGORA)),
    ).toEqual([]);
  });

  it("irmãos com o mesmo responsável viram uma linha só", () => {
    const carla = {
      pessoaId: novoId(),
      nome: "Carla",
      whatsapp: "5511912345678",
      ehResponsavel: true,
    };
    const lista = [
      vencidoHa(3, { nome: "Bruno", contato: carla }),
      vencidoHa(10, { nome: "Outra" }),
      vencidoHa(20, { nome: "Lia", contato: carla }),
    ];
    const linhas = linhasDeContato(lista, vencidos, HOJE, AGORA);
    expect(linhas).toHaveLength(2);
    expect(linhas[0].pessoa.nome).toBe("Carla");
    expect(linhas[0].alunos.length).toBe(2);
    expect(pessoas(linhas)).toEqual(["Bruno e Lia", "Outra"]);
  });

  it("contatado há 3 dias vai para o fim, com o contato recente", () => {
    const recente = contatoEm(somarDias(HOJE, -3));
    const antigo = contatoEm(somarDias(HOJE, -8));
    const lista = [
      vencidoHa(20, { nome: "Contatado", ultimoContato: recente }),
      vencidoHa(30, { nome: "Antigo", ultimoContato: antigo }),
      vencidoHa(40, { nome: "Nunca" }),
    ];
    const linhas = linhasDeContato(lista, vencidos, HOJE, AGORA);
    expect(pessoas(linhas)).toEqual(["Antigo", "Nunca", "Contatado"]);
    expect(linhas[2].recente).toEqual(recente);
    expect(linhas[0].recente).toBeNull();
    expect(linhas[0].ultimoContato).toEqual(antigo);
  });

  it("sem contato: esconde quem recebeu contato depois do vencimento", () => {
    const lista = [
      vencidoHa(20, {
        nome: "Depois",
        ultimoContato: contatoEm(somarDias(HOJE, -10)),
      }),
      vencidoHa(20, {
        nome: "Antes",
        ultimoContato: contatoEm(somarDias(HOJE, -25)),
      }),
      vencidoHa(20, {
        nome: "No último dia",
        ultimoContato: contatoEm(somarDias(HOJE, -20)),
      }),
      vencidoHa(20, { nome: "Nunca" }),
    ];
    expect(
      pessoas(
        linhasDeContato(lista, { ...vencidos, semContato: true }, HOJE, AGORA),
      ).sort(),
    ).toEqual(["Antes", "No último dia", "Nunca"]);
  });

  it("o dia do contato é o de São Paulo", () => {
    // 01:00 UTC do dia seguinte ao vencimento ainda é o dia do vencimento em São Paulo.
    const fim = somarDias(HOJE, -20);
    const lista = [
      vencidoHa(20, {
        nome: "Madrugada",
        ultimoContato: {
          ...contatoEm(fim),
          em: new Date(`${somarDias(fim, 1)}T01:00:00Z`),
        },
      }),
    ];
    expect(
      pessoas(
        linhasDeContato(lista, { ...vencidos, semContato: true }, HOJE, AGORA),
      ),
    ).toEqual(["Madrugada"]);
  });
});

describe("contarDash", () => {
  const carla = {
    pessoaId: novoId(),
    nome: "Carla",
    whatsapp: "5511912345678",
    ehResponsavel: true,
  };
  const alunos = [
    vigente({ nome: "V1", matriculas: [em(TURMA_A), em(TURMA_B)] }),
    vigente({ nome: "V2", matriculas: [em(TURMA_A)] }),
    vigente({ nome: "V3" }),
    venceEm(3, { nome: "B1", matriculas: [em(TURMA_B)] }),
    venceEm(12, { nome: "B2", matriculas: [em(TURMA_A)] }),
    vencidoHa(5, { nome: "X1", contato: carla }),
    vencidoHa(8, { nome: "X2", contato: carla }),
    vencidoHa(15, {
      nome: "X3",
      ultimoContato: contatoEm(somarDias(HOJE, -2)),
    }),
    vencidoHa(40, {
      nome: "X4",
      ultimoContato: contatoEm(somarDias(HOJE, -60)),
    }),
    vencidoHa(120, { nome: "X5" }),
    vencidoHa(10, { nome: "X6", contato: { naoQuerContato: true } }),
    trancado({ nome: "T1", matriculas: [em(TURMA_A)] }),
    aluno({ nome: "S1" }),
    aluno({ nome: "S2" }),
    aluno({ nome: "C1", periodos: [periodoAte(40, 10)] }),
    vigente({ nome: "E1", encerrado: true, matriculas: [em(TURMA_A)] }),
    aluno({ nome: "E2", encerrado: true }),
  ];

  it("conta só os não encerrados", () => {
    const d = contarDash(alunos, HOJE, 7, AGORA);
    expect(d.vigentes).toBe(5);
    expect(d.vencemEmBreve).toBe(1);
    expect(d.trancados).toBe(1);
    expect(d.semPeriodo).toBe(2);
    // X1, X2, X3, X4 (X5 venceu há mais de 90 dias; X6 não quer contato).
    expect(d.vencidos90).toBe(4);
    // X3 recebeu contato depois de vencer.
    expect(d.vencidosSemContato).toBe(3);
    expect(contarDash(alunos, HOJE, 15, AGORA).vencemEmBreve).toBe(2);
  });

  it("'por' conta vigentes com matrícula aberta, cada aluno uma vez por grupo", () => {
    const d = contarDash(alunos, HOJE, 7, AGORA);
    const resumo = (lista: { rotulo: string; quantidade: number }[]) =>
      lista.map((c) => `${c.rotulo}: ${c.quantidade}`);
    expect(resumo(d.por.turma)).toEqual([
      "Forró Iniciante · ter e qui 19h: 3",
      "Samba Iniciante · sex 19h: 2",
    ]);
    expect(resumo(d.por.ritmo)).toEqual(["Forró: 3", "Samba: 2"]);
    expect(resumo(d.por.modulo)).toEqual(["Iniciante: 4"]);
    expect(resumo(d.por.professor)).toEqual(["Paula: 4"]);
    expect(d.por.turma[0]).toEqual({
      id: ID_TURMA_A,
      rotulo: "Forró Iniciante · ter e qui 19h",
      quantidade: 3,
      url: urlAlunos({ periodo: "vigente", turma: ID_TURMA_A }),
    });
  });

  it("os números batem com as listas que eles abrem", () => {
    for (const janela of JANELAS) {
      const d = contarDash(alunos, HOJE, janela, AGORA);
      const naLista = (url: string) =>
        filtrarAlunos(alunos, lerFiltrosAlunos(parametros(url)), HOJE).length;
      expect(naLista(urlAlunos({ periodo: "vigente", janela }))).toBe(
        d.vigentes,
      );
      expect(naLista(urlAlunos({ periodo: "vence_em_breve", janela }))).toBe(
        d.vencemEmBreve,
      );
      expect(naLista(urlAlunos({ periodo: "trancado", janela }))).toBe(
        d.trancados,
      );
      expect(naLista(urlAlunos({ periodo: "sem_periodo", janela }))).toBe(
        d.semPeriodo,
      );
      for (const grupo of Object.values(d.por)) {
        for (const c of grupo) expect(naLista(c.url)).toBe(c.quantidade);
      }
      const nosContatos = (url: string) =>
        linhasDeContato(
          alunos,
          lerFiltrosContatos(parametros(url)),
          HOJE,
          AGORA,
        ).reduce((soma, l) => soma + l.alunos.length, 0);
      expect(nosContatos(urlContatos({ lista: "vencido", janela }))).toBe(
        d.vencidos90,
      );
      expect(
        nosContatos(
          urlContatos({ lista: "vencido", janela, semContato: true }),
        ),
      ).toBe(d.vencidosSemContato);
    }
  });
});
