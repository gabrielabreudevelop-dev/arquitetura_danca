import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eventos } from "@/servidor/banco/esquema";
import { gravarCapa, lerCapa, processarCapa } from "@/servidor/imagens/capa";
import { criarBancoDeTeste } from "../apoio/banco";
import { criarEvento } from "../apoio/fabricas";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
beforeAll(async () => {
  banco = await criarBancoDeTeste();
});
afterAll(async () => {
  await banco.encerrar();
});

async function novaCapa(): Promise<{ id: string; dados: Buffer }> {
  const bytes = await sharp({
    create: { width: 300, height: 200, channels: 3, background: "#2c3e50" },
  })
    .png()
    .toBuffer();
  const processada = await processarCapa({
    bytes: new Uint8Array(bytes),
    tipo: "image/png",
  });
  const id = await gravarCapa(banco.db, processada);
  return { id, dados: processada.dados };
}

describe("capas", () => {
  it("devolve a capa de um evento publicado com os mesmos bytes", async () => {
    const capa = await novaCapa();
    await criarEvento(banco.db, { capaId: capa.id });
    const lida = await lerCapa(banco.db, capa.id, { incluirRascunhos: false });
    expect(lida?.tipo).toBe("image/jpeg");
    expect(lida?.dados.equals(capa.dados)).toBe(true);
  });

  it("esconde a capa de rascunho, exceto com incluirRascunhos", async () => {
    const capa = await novaCapa();
    await criarEvento(banco.db, {
      capaId: capa.id,
      publicado: false,
      primeiraPublicacaoEm: null,
    });
    expect(
      await lerCapa(banco.db, capa.id, { incluirRascunhos: false }),
    ).toBeNull();
    const lida = await lerCapa(banco.db, capa.id, { incluirRascunhos: true });
    expect(lida?.dados.equals(capa.dados)).toBe(true);
  });

  it("devolve a capa de novo ao publicar o evento", async () => {
    const capa = await novaCapa();
    const evento = await criarEvento(banco.db, {
      capaId: capa.id,
      publicado: false,
      primeiraPublicacaoEm: null,
    });
    await banco.db
      .update(eventos)
      .set({ publicado: true })
      .where(eq(eventos.id, evento.id));
    expect(
      await lerCapa(banco.db, capa.id, { incluirRascunhos: false }),
    ).not.toBeNull();
  });

  it("imagem sem evento só aparece com incluirRascunhos", async () => {
    const capa = await novaCapa();
    expect(
      await lerCapa(banco.db, capa.id, { incluirRascunhos: false }),
    ).toBeNull();
    expect(
      await lerCapa(banco.db, capa.id, { incluirRascunhos: true }),
    ).not.toBeNull();
  });

  it("id que não é uuid ou não existe devolve null sem lançar", async () => {
    for (const incluirRascunhos of [false, true]) {
      expect(
        await lerCapa(banco.db, "nao-e-uuid", { incluirRascunhos }),
      ).toBeNull();
      expect(await lerCapa(banco.db, "", { incluirRascunhos })).toBeNull();
      expect(
        await lerCapa(banco.db, randomUUID(), { incluirRascunhos }),
      ).toBeNull();
    }
  });
});
