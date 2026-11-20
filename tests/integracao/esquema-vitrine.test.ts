import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  eventos,
  imagens,
  pessoaPapeis,
  pessoas,
  ritmos,
} from "@/servidor/banco/esquema";
import { criarBancoDeTeste } from "../apoio/banco";
import { esperarErroPg } from "../apoio/erros-pg";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
beforeAll(async () => {
  banco = await criarBancoDeTeste();
});
afterAll(async () => {
  await banco.encerrar();
});

const sufixo = () => randomUUID().slice(0, 8);

async function novoRitmo(valores: Partial<typeof ritmos.$inferInsert> = {}) {
  const [ritmo] = await banco.db
    .insert(ritmos)
    .values({
      nome: `Ritmo ${randomUUID()}`,
      slug: `ritmo-${sufixo()}`,
      ...valores,
    })
    .returning();
  return ritmo;
}

async function novaImagem() {
  const [imagem] = await banco.db
    .insert(imagens)
    .values({
      dados: Buffer.from([1, 2, 3]),
      tipo: "image/webp",
      largura: 10,
      altura: 10,
      tamanho: 3,
    })
    .returning();
  return imagem;
}

async function novoEvento(valores: Partial<typeof eventos.$inferInsert> = {}) {
  const [evento] = await banco.db
    .insert(eventos)
    .values({
      titulo: "Evento",
      slug: `evento-${sufixo()}`,
      inicio: new Date(),
      ...valores,
    })
    .returning();
  return evento;
}

it("recusa slug de ritmo repetido", async () => {
  const ritmo = await novoRitmo();
  await esperarErroPg(novoRitmo({ slug: ritmo.slug }), "23505");
});

it("recusa slug de ritmo fora do formato", async () => {
  await esperarErroPg(novoRitmo({ slug: "Forró" }), "23514");
});

it("ordem do ritmo nasce 0", async () => {
  const ritmo = await novoRitmo();
  expect(ritmo.ordem).toBe(0);
});

it("recusa link de ingresso que não seja https", async () => {
  await esperarErroPg(novoEvento({ linkIngresso: "http://x" }), "23514");
  const evento = await novoEvento({ linkIngresso: "https://x.com/i" });
  expect(evento.esgotado).toBe(false);
});

it("apagar a imagem deixa capa_id nulo no evento", async () => {
  const imagem = await novaImagem();
  const evento = await novoEvento({ capaId: imagem.id });
  expect(evento.capaId).toBe(imagem.id);
  await banco.db.delete(imagens).where(eq(imagens.id, imagem.id));
  const [depois] = await banco.db
    .select()
    .from(eventos)
    .where(eq(eventos.id, evento.id));
  expect(depois.capaId).toBeNull();
});

it("imagens.dados grava e lê um Buffer byte a byte", async () => {
  const dados = randomBytes(2048);
  const [gravada] = await banco.db
    .insert(imagens)
    .values({
      dados,
      tipo: "image/webp",
      largura: 1,
      altura: 1,
      tamanho: dados.length,
    })
    .returning();
  const [lida] = await banco.db
    .select()
    .from(imagens)
    .where(eq(imagens.id, gravada.id));
  expect(Buffer.isBuffer(lida.dados)).toBe(true);
  expect(lida.dados.equals(dados)).toBe(true);
});

it("pessoa_papeis.ativo nasce true", async () => {
  const [pessoa] = await banco.db
    .insert(pessoas)
    .values({ nome: "Pessoa" })
    .returning();
  const [linha] = await banco.db
    .insert(pessoaPapeis)
    .values({ pessoaId: pessoa.id, papel: "aluno" })
    .returning();
  expect(linha.ativo).toBe(true);
});
