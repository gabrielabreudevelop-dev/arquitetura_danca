import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { montarPaginaInicial } from "@/servidor/vitrine/pagina-inicial";
import { criarBancoDeTeste } from "../apoio/banco";
import {
  criarEvento,
  criarModulo,
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
beforeEach(async () => {
  await banco.sql(
    "truncate table eventos, turma_dias, turmas, ritmos, modulos, imagens cascade",
  );
});

const AGORA = new Date("2026-12-01T15:00:00Z");
const dias = (n: number) => new Date(AGORA.getTime() + n * 86_400_000);

describe("montarPaginaInicial", () => {
  it("sem eventos nem ritmos, não tem destaque", async () => {
    expect(await montarPaginaInicial(banco.db, AGORA)).toEqual({
      destaque: null,
      outrosEventos: 0,
      ritmos: [],
    });
  });

  it("destaca o evento mais próximo e conta os outros", async () => {
    await criarEvento(banco.db, { titulo: "Baile de Verão", inicio: dias(20) });
    await criarEvento(banco.db, {
      titulo: "Baile de Dezembro",
      inicio: dias(12),
    });
    await criarEvento(banco.db, { titulo: "Já foi", inicio: dias(-3) });
    await criarEvento(banco.db, {
      titulo: "Rascunho",
      inicio: dias(2),
      publicado: false,
    });

    const pagina = await montarPaginaInicial(banco.db, AGORA);
    expect(pagina.destaque?.titulo).toBe("Baile de Dezembro");
    expect(pagina.outrosEventos).toBe(1);
  });

  it("traz os ritmos da grade, na ordem cadastrada", async () => {
    const modulo = await criarModulo(banco.db, { nome: "Iniciante" });
    const tango = await criarRitmo(banco.db, {
      nome: "Tango",
      slug: "tango",
      ordem: 2,
    });
    const forro = await criarRitmo(banco.db, {
      nome: "Forró",
      slug: "forro",
      ordem: 1,
    });
    await criarRitmo(banco.db, { nome: "Sem turma", slug: "sem-turma" });
    for (const r of [tango, forro])
      await criarTurma(banco.db, { ritmoId: r?.id, moduloId: modulo?.id });

    const pagina = await montarPaginaInicial(banco.db, AGORA);
    expect(pagina.ritmos).toEqual([
      { nome: "Forró", slug: "forro" },
      { nome: "Tango", slug: "tango" },
    ]);
    expect(pagina.destaque).toBeNull();
  });
});
