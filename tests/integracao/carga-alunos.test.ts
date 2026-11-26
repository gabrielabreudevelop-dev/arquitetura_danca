import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cadastrarAluno,
  type DadosAluno,
  encerrarAluno,
} from "@/servidor/alunos/cadastro";
import { type AlunoCarregado, carregarAlunos } from "@/servidor/alunos/carga";
import { contarDash } from "@/servidor/alunos/listas";
import { matricular } from "@/servidor/alunos/matriculas";
import {
  anularAjuste,
  anularPeriodo,
  estender,
  registrarPeriodo,
} from "@/servidor/alunos/periodos";
import { trancar } from "@/servidor/alunos/trancamentos";
import { bloqueiosContato, contatos } from "@/servidor/banco/esquema";
import { criarBancoDeTeste } from "../apoio/banco";
import {
  criarAdministracao,
  criarAluno,
  criarModulo,
  criarPlano,
  criarProfessor,
  criarRitmo,
  criarTurma,
} from "../apoio/fabricas";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
let adm: Awaited<ReturnType<typeof criarAdministracao>>;
let plano: Awaited<ReturnType<typeof criarPlano>>;

const HOJE = "2026-11-22";
const AGORA = new Date("2026-11-22T15:00:00Z");

beforeAll(async () => {
  banco = await criarBancoDeTeste();
  adm = await criarAdministracao(banco.db);
  plano = await criarPlano(banco.db, { nome: "Mensal" });
});
afterAll(async () => {
  await banco.encerrar();
});

function ok<T>(r: { ok: true; valor: T } | { ok: false; erros: unknown }): T {
  if (!r.ok) throw new Error(JSON.stringify(r.erros));
  return r.valor;
}

async function cadastrar(
  dados: Partial<DadosAluno> & { nome: string },
  hoje = HOJE,
): Promise<string> {
  const valor = ok(
    await cadastrarAluno(
      banco.db,
      { nascimento: "1990-01-01", ...dados },
      adm.id,
      hoje,
    ),
  );
  if (valor.tipo !== "criado") throw new Error(valor.tipo);
  return valor.alunoId;
}

async function periodo(alunoId: string, inicio: string, fim: string) {
  return ok(
    await registrarPeriodo(banco.db, {
      alunoId,
      planoId: plano.id,
      inicio,
      fim,
      feitoPor: adm.id,
    }),
  ).periodoId;
}

const whatsapp = () =>
  `11 9${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;

function porId(lista: AlunoCarregado[], id: string): AlunoCarregado {
  const a = lista.find((x) => x.id === id);
  if (!a) throw new Error(`aluno ${id} não carregado`);
  return a;
}

describe("carregarAlunos", () => {
  it("monta estado, contato, matrículas e plano de cada aluno", async () => {
    const professor = await criarProfessor(banco.db, { nome: "Paula Reis" });
    const ritmo = await criarRitmo(banco.db, { nome: "Forró" });
    const modulo = await criarModulo(banco.db, { nome: "Iniciante" });
    const turma = await criarTurma(banco.db, {
      ritmoId: ritmo.id,
      moduloId: modulo.id,
      professorId: professor.id,
      dias: [4, 2],
      horarioInicio: "19:00",
      horarioFim: "20:30",
    });

    const vigente = await cadastrar({
      nome: "Ana Vigente",
      whatsapp: whatsapp(),
    });
    await periodo(vigente, "2026-11-01", "2026-11-30");
    ok(
      await matricular(banco.db, {
        alunoId: vigente,
        turmaId: turma.id,
        entrada: "2026-11-05",
        feitoPor: adm.id,
      }),
    );

    const trancado = await cadastrar({
      nome: "Bia Trancada",
      whatsapp: whatsapp(),
    });
    await periodo(trancado, "2026-11-01", "2026-11-30");
    ok(
      await trancar(
        banco.db,
        { alunoId: trancado, inicio: "2026-11-20", feitoPor: adm.id },
        HOJE,
      ),
    );

    const comeca = await cadastrar({
      nome: "Caio Começa",
      whatsapp: whatsapp(),
    });
    await periodo(comeca, "2026-12-01", "2026-12-31");

    const vencido = await cadastrar({
      nome: "Davi Vencido",
      whatsapp: whatsapp(),
    });
    await periodo(vencido, "2026-10-01", "2026-10-31");

    const semPeriodo = await cadastrar({
      nome: "Eva Sem",
      whatsapp: whatsapp(),
    });

    const encerrado = await cadastrar({
      nome: "Fábio Encerrado",
      whatsapp: whatsapp(),
    });
    await periodo(encerrado, "2026-11-01", "2026-11-30");
    ok(
      await encerrarAluno(banco.db, {
        alunoId: encerrado,
        data: HOJE,
        feitoPor: adm.id,
      }),
    );

    const menor = await cadastrar({
      nome: "Gabi Menor",
      nascimento: "2014-05-10",
      responsavel: { novo: true, nome: "Carla Mãe", whatsapp: "27 99999-0000" },
    });
    // Fez 18 anos em 01/11; cadastrado quando ainda era menor, sem WhatsApp próprio.
    const fez18 = await cadastrar(
      {
        nome: "Hugo Dezoito",
        nascimento: "2008-11-01",
        responsavel: { novo: true, nome: "Iara Pai", whatsapp: whatsapp() },
      },
      "2026-10-15",
    );
    // O cadastro exige WhatsApp de adulto; dado antigo pode não ter.
    const semNada = (
      await criarAluno(banco.db, { nome: "João Sem Nada", whatsapp: null })
    ).id;

    const lista = await carregarAlunos(banco.db, HOJE);

    expect(porId(lista, vigente).resumo.estado).toBe("vigente");
    expect(porId(lista, trancado).resumo.estado).toBe("trancado");
    expect(porId(lista, comeca).resumo.estado).toBe("comeca_em_breve");
    expect(porId(lista, vencido).resumo.estado).toBe("vencido");
    expect(porId(lista, semPeriodo).resumo.estado).toBe("sem_periodo");
    expect(porId(lista, encerrado).resumo.estado).toBe("encerrado");
    expect(porId(lista, encerrado).encerrado).toBe(true);
    expect(porId(lista, trancado).trancamentos).toHaveLength(1);

    const ana = porId(lista, vigente);
    expect(ana.planoUltimo).toBe("Mensal");
    expect(ana.matriculas).toHaveLength(1);
    expect(ana.matriculas[0]).toMatchObject({
      turmaId: turma.id,
      entrada: "2026-11-05",
      ritmoId: ritmo.id,
      ritmo: "Forró",
      moduloId: modulo.id,
      modulo: "Iniciante",
      professorId: professor.id,
      professor: "Paula Reis",
      dias: [2, 4],
      horarioInicio: "19:00:00",
      rotulo: "Forró Iniciante · ter e qui 19h",
    });
    expect(ana.contato).toEqual({
      pessoaId: vigente,
      nome: "Ana Vigente",
      whatsapp: ana.whatsapp,
      ehResponsavel: false,
      usandoNumeroDoResponsavel: false,
      naoQuerContato: false,
    });
    expect(porId(lista, semPeriodo).planoUltimo).toBeNull();
    // Encerrar fecha as matrículas: nenhuma aberta.
    expect(porId(lista, encerrado).matriculas).toEqual([]);

    const gabi = porId(lista, menor);
    expect(gabi.menor).toBe(true);
    expect(gabi.nascimento).toBe("2014-05-10");
    expect(gabi.responsavel).toMatchObject({
      nome: "Carla Mãe",
      whatsapp: "5527999990000",
    });
    expect(gabi.contato).toEqual({
      pessoaId: gabi.responsavel?.id,
      nome: "Carla Mãe",
      whatsapp: "5527999990000",
      ehResponsavel: true,
      usandoNumeroDoResponsavel: false,
      naoQuerContato: false,
    });

    const hugo = porId(lista, fez18);
    expect(hugo.menor).toBe(false);
    expect(hugo.whatsapp).toBeNull();
    expect(hugo.contato).toMatchObject({
      pessoaId: hugo.responsavel?.id,
      nome: "Iara Pai",
      ehResponsavel: true,
      usandoNumeroDoResponsavel: true,
    });
    expect(hugo.contato.whatsapp).toBe(hugo.responsavel?.whatsapp);

    expect(porId(lista, semNada).contato).toEqual({
      pessoaId: semNada,
      nome: "João Sem Nada",
      whatsapp: null,
      ehResponsavel: false,
      usandoNumeroDoResponsavel: false,
      naoQuerContato: false,
    });

    // Só pelos ids pedidos (e ids inválidos são ignorados).
    const doisIds = await carregarAlunos(banco.db, HOJE, {
      ids: [menor, vencido, "lixo"],
    });
    expect(doisIds.map((a) => a.nome)).toEqual(["Davi Vencido", "Gabi Menor"]);
    expect(await carregarAlunos(banco.db, HOJE, { ids: ["lixo"] })).toEqual([]);
  });

  it("marca 'não quer contato' pela pessoa de contato (bloqueio aberto)", async () => {
    const irmao1 = await cadastrar({
      nome: "Lia Irmã",
      nascimento: "2015-01-01",
      responsavel: { novo: true, nome: "Marta Mãe", whatsapp: whatsapp() },
    });
    const [lia] = await carregarAlunos(banco.db, HOJE, { ids: [irmao1] });
    const responsavelId = lia.responsavel?.id ?? "";
    const desfeito = await cadastrar({
      nome: "Nina Voltou",
      whatsapp: whatsapp(),
    });
    await banco.db.insert(bloqueiosContato).values([
      { pessoaId: responsavelId, marcadoPor: adm.id },
      {
        pessoaId: desfeito,
        marcadoPor: adm.id,
        desfeitoEm: new Date(),
        desfeitoPor: adm.id,
      },
    ]);
    const lista = await carregarAlunos(banco.db, HOJE, {
      ids: [irmao1, desfeito],
    });
    expect(porId(lista, irmao1).contato.naoQuerContato).toBe(true);
    expect(porId(lista, desfeito).contato.naoQuerContato).toBe(false);
  });

  it("períodos e ajustes anulados não contam", async () => {
    const id = await cadastrar({
      nome: "Olga Anulações",
      whatsapp: whatsapp(),
    });
    const errado = await periodo(id, "2026-11-01", "2026-12-31");
    ok(
      await anularPeriodo(banco.db, {
        periodoId: errado,
        motivo: "digitado errado",
        feitoPor: adm.id,
      }),
    );
    const certo = await periodo(id, "2026-11-01", "2026-11-30");
    const mantido = ok(
      await estender(
        banco.db,
        {
          alunoId: id,
          quantidade: 3,
          unidade: "dias",
          motivo: "feriado",
          feitoPor: adm.id,
        },
        HOJE,
      ),
    );
    const anulado = ok(
      await estender(
        banco.db,
        {
          alunoId: id,
          quantidade: 10,
          unidade: "dias",
          motivo: "engano",
          feitoPor: adm.id,
        },
        HOJE,
      ),
    );
    ok(
      await anularAjuste(banco.db, {
        ajusteId: anulado.ajusteId,
        motivo: "engano",
        feitoPor: adm.id,
      }),
    );
    expect(mantido.dias).toBe(3);

    const [olga] = await carregarAlunos(banco.db, HOJE, { ids: [id] });
    expect(olga.periodos).toEqual([
      { id: certo, inicio: "2026-11-01", fim: "2026-11-30", diasAjustes: 3 },
    ]);
    expect(olga.resumo.ultimo?.fimEfetivo).toBe("2026-12-03");
  });

  it("último contato da pessoa e 'vencidos sem contato' mudam com um contato novo", async () => {
    const id = await cadastrar({ nome: "Paulo Vencido", whatsapp: whatsapp() });
    await periodo(id, "2026-10-01", "2026-10-31");
    const antes = await carregarAlunos(banco.db, HOJE);
    expect(porId(antes, id).ultimoContato).toBeNull();
    const dashAntes = contarDash(antes, HOJE, 7, AGORA);

    const paulo = porId(antes, id);
    const grupoAntigo = randomUUID();
    const grupoNovo = randomUUID();
    await banco.db.insert(contatos).values([
      {
        // Antes do vencimento: não tira da lista "sem contato".
        grupoId: grupoAntigo,
        alunoId: id,
        pessoaContatoId: paulo.contato.pessoaId,
        whatsapp: paulo.contato.whatsapp ?? "",
        lista: "vence_em_breve",
        criadoPor: adm.id,
        criadoEm: new Date("2026-10-28T15:00:00Z"),
      },
    ]);
    const comAntigo = await carregarAlunos(banco.db, HOJE);
    expect(porId(comAntigo, id).ultimoContato?.grupoId).toBe(grupoAntigo);
    expect(contarDash(comAntigo, HOJE, 7, AGORA).vencidosSemContato).toBe(
      dashAntes.vencidosSemContato,
    );

    await banco.db.insert(contatos).values({
      grupoId: grupoNovo,
      alunoId: id,
      pessoaContatoId: paulo.contato.pessoaId,
      whatsapp: paulo.contato.whatsapp ?? "",
      lista: "vencido",
      criadoPor: adm.id,
      criadoEm: new Date("2026-11-10T15:00:00Z"),
      resultado: "vai_pensar",
      resultadoPor: adm.id,
      resultadoEm: new Date("2026-11-10T16:00:00Z"),
    });
    const depois = await carregarAlunos(banco.db, HOJE);
    expect(porId(depois, id).ultimoContato).toEqual({
      grupoId: grupoNovo,
      em: new Date("2026-11-10T15:00:00Z"),
      por: adm.nome,
      resultado: "vai_pensar",
    });
    const dashDepois = contarDash(depois, HOJE, 7, AGORA);
    expect(dashDepois.vencidosSemContato).toBe(
      dashAntes.vencidosSemContato - 1,
    );
    expect(dashDepois.vencidos90).toBe(dashAntes.vencidos90);
  });
});
