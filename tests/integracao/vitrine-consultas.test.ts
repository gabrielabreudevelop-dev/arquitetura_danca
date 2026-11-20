import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { imagens } from "@/servidor/banco/esquema";
import {
  listarProximosEventos,
  listarRitmosDaGrade,
  obterEventoPublico,
  obterGradeDoRitmo,
  proximoEvento,
} from "@/servidor/vitrine/consultas";
import { criarBancoDeTeste } from "../apoio/banco";
import {
  criarEvento,
  criarModulo,
  criarProfessor,
  criarRitmo,
  criarTurma,
} from "../apoio/fabricas";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
beforeAll(async () => {
  banco = await criarBancoDeTeste();
});
afterAll(async () => {
  await banco.encerrar();
});
// O banco é compartilhado: limpa tudo para cada teste enxergar só o que criou.
beforeEach(async () => {
  await banco.sql(
    "truncate table eventos, turma_dias, turmas, ritmos, modulos, imagens cascade",
  );
});

const AGORA = new Date("2026-12-01T15:00:00Z");
const hora = (h: number) => new Date(AGORA.getTime() + h * 3_600_000);

describe("listarRitmosDaGrade", () => {
  it("traz só ritmos ativos com turma ativa em módulo ativo, pela ordem", async () => {
    const modulo = await criarModulo(banco.db, { nome: "Iniciante" });
    const moduloOff = await criarModulo(banco.db, { ativo: false });
    const b = await criarRitmo(banco.db, {
      nome: "Bolero",
      slug: "bolero",
      ordem: 2,
    });
    const a = await criarRitmo(banco.db, {
      nome: "Axé",
      slug: "axe",
      ordem: 1,
    });
    const off = await criarRitmo(banco.db, { slug: "off", ativo: false });
    const semTurma = await criarRitmo(banco.db, { slug: "sem-turma" });
    const turmaOff = await criarRitmo(banco.db, { slug: "turma-off" });
    const moduloInativo = await criarRitmo(banco.db, { slug: "modulo-off" });
    for (const r of [b, a, off])
      await criarTurma(banco.db, { ritmoId: r?.id, moduloId: modulo?.id });
    await criarTurma(banco.db, {
      ritmoId: turmaOff?.id,
      moduloId: modulo?.id,
      ativa: false,
    });
    await criarTurma(banco.db, {
      ritmoId: moduloInativo?.id,
      moduloId: moduloOff?.id,
    });
    expect(semTurma).toBeDefined();

    expect(await listarRitmosDaGrade(banco.db)).toEqual([
      { nome: "Axé", slug: "axe" },
      { nome: "Bolero", slug: "bolero" },
    ]);
  });
});

describe("obterGradeDoRitmo", () => {
  async function cenario() {
    const prof = await criarProfessor(banco.db, { nome: "Fulana Secreta" });
    const ritmo = await criarRitmo(banco.db, { nome: "Forró", slug: "forro" });
    const ini = await criarModulo(banco.db, { nome: "Iniciante", ordem: 1 });
    const inter = await criarModulo(banco.db, {
      nome: "Intermediário",
      ordem: 2,
    });
    const off = await criarModulo(banco.db, {
      nome: "Avançado",
      ordem: 3,
      ativo: false,
    });
    const base = { ritmoId: ritmo?.id, professorId: prof?.id };
    const t1 = await criarTurma(banco.db, {
      ...base,
      moduloId: inter?.id,
      dias: [2],
      horarioInicio: "18:00",
      horarioFim: "19:00",
    });
    const t2 = await criarTurma(banco.db, {
      ...base,
      moduloId: ini?.id,
      dias: [4, 2],
      horarioInicio: "20:00",
      horarioFim: "21:00",
    });
    const t3 = await criarTurma(banco.db, {
      ...base,
      moduloId: ini?.id,
      dias: [1],
      horarioInicio: "19:00",
      horarioFim: "20:00",
    });
    await criarTurma(banco.db, { ...base, moduloId: ini?.id, ativa: false });
    await criarTurma(banco.db, { ...base, moduloId: off?.id });
    return { t1, t2, t3 };
  }

  it("ordena por módulo, primeiro dia e início, sem dados de professor", async () => {
    const { t1, t2, t3 } = await cenario();
    const grade = await obterGradeDoRitmo(banco.db, "forro", {});
    expect(grade?.ritmo).toEqual({ nome: "Forró", slug: "forro" });
    expect(grade?.modulos).toEqual([
      { nome: "Iniciante", slug: "iniciante" },
      { nome: "Intermediário", slug: "intermediario" },
    ]);
    expect(grade?.turmas.map((t) => t.id)).toEqual([t3.id, t2.id, t1.id]);
    expect(grade?.turmas[1]).toEqual({
      id: t2.id,
      modulo: "Iniciante",
      dias: [2, 4],
      horarioInicio: "20:00:00",
      horarioFim: "21:00:00",
    });
    expect(grade?.filtrosAplicados).toEqual({});
    const json = JSON.stringify(grade);
    expect(json).not.toContain("Fulana Secreta");
    expect(json.toLowerCase()).not.toContain("professor");
  });

  it("filtra por dia e por módulo", async () => {
    const { t1, t2 } = await cenario();
    const porDia = await obterGradeDoRitmo(banco.db, "forro", { dia: "ter" });
    expect(porDia?.turmas.map((t) => t.id).sort()).toEqual(
      [t1.id, t2.id].sort(),
    );
    expect(porDia?.filtrosAplicados).toEqual({ dia: "ter" });
    const porModulo = await obterGradeDoRitmo(banco.db, "forro", {
      modulo: "iniciante",
    });
    expect(porModulo?.turmas.every((t) => t.modulo === "Iniciante")).toBe(true);
    expect(porModulo?.turmas).toHaveLength(2);
    // a lista de módulos continua completa
    expect(porModulo?.modulos).toHaveLength(2);
  });

  it("ignora filtros desconhecidos", async () => {
    await cenario();
    const todas = await obterGradeDoRitmo(banco.db, "forro", {});
    const g = await obterGradeDoRitmo(banco.db, "forro", {
      dia: "xyz",
      modulo: "nao-existe",
    });
    expect(g?.turmas).toEqual(todas?.turmas);
    expect(g?.filtrosAplicados).toEqual({});
  });

  it("devolve null para ritmo inexistente ou desativado", async () => {
    await criarRitmo(banco.db, { slug: "velho", ativo: false });
    expect(await obterGradeDoRitmo(banco.db, "velho", {})).toBeNull();
    expect(await obterGradeDoRitmo(banco.db, "nada", {})).toBeNull();
  });
});

describe("eventos públicos", () => {
  it("proximoEvento ignora rascunho e passado, escolhe o mais próximo, aceita esgotado", async () => {
    await criarEvento(banco.db, { inicio: hora(-48), publicado: true });
    await criarEvento(banco.db, { inicio: hora(2), publicado: false });
    const longe = await criarEvento(banco.db, { inicio: hora(200) });
    const perto = await criarEvento(banco.db, {
      inicio: hora(72),
      esgotado: true,
    });
    const prox = await proximoEvento(banco.db, AGORA);
    expect(prox?.id).toBe(perto.id);
    expect(prox?.esgotado).toBe(true);
    expect(longe.id).not.toBe(prox?.id);
  });

  it("proximoEvento é null sem eventos futuros", async () => {
    await criarEvento(banco.db, { inicio: hora(-72) });
    expect(await proximoEvento(banco.db, AGORA)).toBeNull();
  });

  it("usa a regra eventoJaPassou: sem fim vale até o fim do dia; com fim, até o fim", async () => {
    // 2026-12-01 10:00 em São Paulo (13:00Z), sem fim: ainda não passou às 15:00Z
    const hoje = await criarEvento(banco.db, {
      inicio: new Date("2026-12-01T13:00:00Z"),
    });
    // começou ontem, terminou há 1h: passou
    await criarEvento(banco.db, { inicio: hora(-5), fim: hora(-1) });
    // começou ontem e termina daqui a 1h: não passou
    const virada = await criarEvento(banco.db, {
      inicio: hora(-5),
      fim: hora(1),
    });
    const lista = await listarProximosEventos(banco.db, AGORA);
    expect(lista.map((e) => e.id)).toEqual([virada.id, hoje.id]);
  });

  it("listarProximosEventos em ordem de início, sem rascunhos e sem passados", async () => {
    const c = await criarEvento(banco.db, { inicio: hora(300) });
    const a = await criarEvento(banco.db, { inicio: hora(30) });
    const b = await criarEvento(banco.db, { inicio: hora(100) });
    await criarEvento(banco.db, { inicio: hora(40), publicado: false });
    await criarEvento(banco.db, { inicio: hora(-100) });
    const lista = await listarProximosEventos(banco.db, AGORA);
    expect(lista.map((e) => e.id)).toEqual([a.id, b.id, c.id]);
  });

  it("inclui a capa e nenhum nome de pessoa", async () => {
    const prof = await criarProfessor(banco.db, { nome: "Beltrano Reservado" });
    await criarTurma(banco.db, { professorId: prof?.id });
    const [img] = await banco.db
      .insert(imagens)
      .values({
        dados: Buffer.from("x"),
        tipo: "image/webp",
        largura: 800,
        altura: 450,
        tamanho: 1,
      })
      .returning();
    await criarEvento(banco.db, {
      inicio: hora(30),
      capaId: img?.id,
      slug: "com-capa",
    });
    const lista = await listarProximosEventos(banco.db, AGORA);
    expect(lista[0]?.capa).toEqual({ id: img?.id, largura: 800, altura: 450 });
    const detalhe = await obterEventoPublico(banco.db, "com-capa", AGORA);
    expect(
      JSON.stringify([lista, detalhe, await proximoEvento(banco.db, AGORA)]),
    ).not.toContain("Beltrano");
  });

  it("obterEventoPublico: rascunho e inexistente são null; passado traz passou: true", async () => {
    await criarEvento(banco.db, { slug: "rascunho", publicado: false });
    const velho = await criarEvento(banco.db, {
      slug: "velho",
      inicio: hora(-100),
    });
    const futuro = await criarEvento(banco.db, {
      slug: "futuro",
      inicio: hora(100),
    });
    expect(await obterEventoPublico(banco.db, "rascunho", AGORA)).toBeNull();
    expect(await obterEventoPublico(banco.db, "nada", AGORA)).toBeNull();
    expect((await obterEventoPublico(banco.db, "velho", AGORA))?.passou).toBe(
      true,
    );
    expect((await obterEventoPublico(banco.db, "velho", AGORA))?.id).toBe(
      velho.id,
    );
    const f = await obterEventoPublico(banco.db, "futuro", AGORA);
    expect(f?.passou).toBe(false);
    expect(f?.id).toBe(futuro.id);
  });
});
