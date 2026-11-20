import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { z } from "zod";
import { ritmos } from "@/servidor/banco/esquema";
import { errosDeZod, traduzirErroBanco } from "@/servidor/cadastros/resultado";
import { criarBancoDeTeste } from "../apoio/banco";
import { criarRitmo, criarTurma } from "../apoio/fabricas";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
beforeAll(async () => {
  banco = await criarBancoDeTeste();
});
afterAll(async () => {
  await banco.encerrar();
});

const mapa = {
  ritmos_slug_unico: {
    campo: "slug",
    mensagem: "Esse endereço já está em uso.",
  },
};

async function capturar(promessa: PromiseLike<unknown>): Promise<unknown> {
  try {
    await promessa;
  } catch (e) {
    return e;
  }
  throw new Error("a operação deveria falhar");
}

it("traduz violação de unicidade pelo nome da constraint", async () => {
  const existente = await criarRitmo(banco.db);
  const erro = await capturar(criarRitmo(banco.db, { slug: existente.slug }));
  expect(traduzirErroBanco(erro, mapa)).toEqual({
    slug: "Esse endereço já está em uso.",
  });
});

it("traduz exclusão de ritmo em uso (23503) como erro geral", async () => {
  const turma = await criarTurma(banco.db);
  const erro = await capturar(
    banco.db.delete(ritmos).where(eq(ritmos.id, turma.ritmoId)),
  );
  expect(traduzirErroBanco(erro, mapa)).toEqual({
    _: "Está em uso; desative em vez de excluir.",
  });
});

it("devolve null para erro não reconhecido", () => {
  expect(traduzirErroBanco(new Error("x"), mapa)).toBeNull();
});

it("errosDeZod guarda a primeira mensagem de cada campo", () => {
  const esquema = z.object({
    nome: z.string().min(3, "Nome curto").regex(/^a/, "Começa com a"),
    idade: z.number("Informe a idade"),
  });
  const r = esquema.safeParse({ nome: "x", idade: "y" });
  expect(r.success).toBe(false);
  if (!r.success) {
    expect(errosDeZod(r.error)).toEqual({
      nome: "Nome curto",
      idade: "Informe a idade",
    });
  }
});
