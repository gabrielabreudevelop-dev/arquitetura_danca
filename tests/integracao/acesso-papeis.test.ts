import { afterAll, beforeAll, expect, it } from "vitest";
import { papeisAtivos } from "@/servidor/auth/acesso";
import { pessoaPapeis, pessoas } from "@/servidor/banco/esquema";
import { criarBancoDeTeste } from "../apoio/banco";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
beforeAll(async () => {
  banco = await criarBancoDeTeste();
});
afterAll(async () => {
  await banco.encerrar();
});

it("não devolve papel com ativo = false", async () => {
  const [pessoa] = await banco.db
    .insert(pessoas)
    .values({ nome: "Equipe" })
    .returning();
  await banco.db.insert(pessoaPapeis).values([
    { pessoaId: pessoa.id, papel: "atendente", ativo: true },
    { pessoaId: pessoa.id, papel: "administracao", ativo: false },
  ]);
  expect(await papeisAtivos(banco.db, pessoa.id)).toEqual(["atendente"]);
});
