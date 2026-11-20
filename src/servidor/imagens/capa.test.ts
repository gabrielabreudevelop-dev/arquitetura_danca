import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ErroCapa, processarCapa, TAMANHO_MAXIMO_CAPA } from "./capa";

function cor(largura: number, altura: number) {
  return sharp({
    create: {
      width: largura,
      height: altura,
      channels: 3,
      background: "#c0392b",
    },
  });
}

async function png(largura: number, altura: number) {
  return new Uint8Array(await cor(largura, altura).png().toBuffer());
}

async function jpeg(largura: number, altura: number) {
  return new Uint8Array(await cor(largura, altura).jpeg().toBuffer());
}

describe("processarCapa", () => {
  it("converte PNG 3000x1500 em JPEG 1200x600", async () => {
    const r = await processarCapa({
      bytes: await png(3000, 1500),
      tipo: "image/png",
    });
    expect(r.dados[0]).toBe(0xff);
    expect(r.dados[1]).toBe(0xd8);
    expect(r.largura).toBe(1200);
    expect(r.altura).toBe(600);
    expect(r.tamanho).toBe(r.dados.length);
  });

  it("mantém a proporção: 1080x1350 vira 960x1200", async () => {
    const r = await processarCapa({
      bytes: await jpeg(1080, 1350),
      tipo: "image/jpeg",
    });
    expect([r.largura, r.altura]).toEqual([960, 1200]);
  });

  it("não amplia imagem pequena", async () => {
    const r = await processarCapa({
      bytes: await jpeg(800, 600),
      tipo: "image/jpeg",
    });
    expect([r.largura, r.altura]).toEqual([800, 600]);
  });

  it("aplica a orientação EXIF e remove o EXIF", async () => {
    const bytes = new Uint8Array(
      await cor(400, 200).jpeg().withMetadata({ orientation: 6 }).toBuffer(),
    );
    expect((await sharp(bytes).metadata()).orientation).toBe(6);
    const r = await processarCapa({ bytes, tipo: "image/jpeg" });
    expect([r.largura, r.altura]).toEqual([200, 400]);
    const meta = await sharp(r.dados).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
  });

  it("mantém foto ruidosa 4000x3000 em até 350 KB", async () => {
    // Ruído de granulação média (400x300 ampliado), parecido com uma foto
    // detalhada; ruído branco puro é incompressível e não representa fotos.
    const ruido = await sharp(randomBytes(400 * 300 * 3), {
      raw: { width: 400, height: 300, channels: 3 },
    })
      .resize(4000, 3000, { kernel: "cubic" })
      .jpeg({ quality: 90 })
      .toBuffer();
    expect(ruido.length).toBeLessThan(TAMANHO_MAXIMO_CAPA);
    const r = await processarCapa({
      bytes: new Uint8Array(ruido),
      tipo: "image/jpeg",
    });
    expect(r.tamanho).toBeLessThanOrEqual(350_000);
  });

  it("rejeita tipo que não é imagem aceita", async () => {
    await expect(
      processarCapa({
        bytes: new Uint8Array([1, 2, 3]),
        tipo: "application/pdf",
      }),
    ).rejects.toThrow(new ErroCapa("Envie uma imagem JPEG, PNG ou WebP."));
  });

  it("rejeita PDF declarado como JPEG", async () => {
    const pdf = new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n");
    await expect(
      processarCapa({ bytes: pdf, tipo: "image/jpeg" }),
    ).rejects.toThrow("Envie uma imagem JPEG, PNG ou WebP.");
    await expect(
      processarCapa({ bytes: pdf, tipo: "image/jpeg" }),
    ).rejects.toBeInstanceOf(ErroCapa);
  });

  it("rejeita arquivo vazio", async () => {
    await expect(
      processarCapa({ bytes: new Uint8Array(0), tipo: "image/png" }),
    ).rejects.toThrow("O arquivo está vazio.");
  });

  it("rejeita arquivo acima de 10 MB", async () => {
    await expect(
      processarCapa({
        bytes: new Uint8Array(TAMANHO_MAXIMO_CAPA + 1),
        tipo: "image/png",
      }),
    ).rejects.toThrow("A imagem pode ter até 10 MB.");
  });
});
