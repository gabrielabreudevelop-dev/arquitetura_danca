import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  extensoesPeriodo,
  periodosContratados,
  pessoaPapeis,
  pessoas,
  responsabilidades,
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

async function criarPessoa(valores: Partial<typeof pessoas.$inferInsert> = {}) {
  const [pessoa] = await banco.db
    .insert(pessoas)
    .values({ nome: "Pessoa de teste", ...valores })
    .returning();
  return pessoa;
}

async function criarPeriodo(alunoId: string) {
  const [periodo] = await banco.db
    .insert(periodosContratados)
    .values({ alunoId, inicio: "2026-01-01", fim: "2026-06-30" })
    .returning();
  return periodo;
}

it("recusa dois e-mails iguais com maiúsculas diferentes", async () => {
  const sufixo = randomUUID();
  await criarPessoa({ email: `ana-${sufixo}@x.com` });
  await esperarErroPg(
    banco.db
      .insert(pessoas)
      .values({ nome: "Outra Ana", email: `ANA-${sufixo}@x.com` }),
    "23505",
  );
});

it("permite várias pessoas sem e-mail", async () => {
  await criarPessoa({ email: null });
  await criarPessoa({ email: null });
});

it("uma pessoa pode ter vários papéis", async () => {
  const pessoa = await criarPessoa();
  await banco.db.insert(pessoaPapeis).values([
    { pessoaId: pessoa.id, papel: "aluno" },
    { pessoaId: pessoa.id, papel: "responsavel" },
  ]);
  const linhas = await banco.db.select().from(pessoaPapeis);
  expect(linhas.filter((l) => l.pessoaId === pessoa.id)).toHaveLength(2);
});

it("recusa responsável igual ao próprio aluno", async () => {
  const pessoa = await criarPessoa();
  await esperarErroPg(
    banco.db
      .insert(responsabilidades)
      .values({ responsavelId: pessoa.id, alunoId: pessoa.id }),
    "23514",
  );
});

it("recusa período com fim antes do início", async () => {
  const aluno = await criarPessoa();
  await esperarErroPg(
    banco.db
      .insert(periodosContratados)
      .values({ alunoId: aluno.id, inicio: "2026-06-30", fim: "2026-01-01" }),
    "23514",
  );
});

it("recusa extensão com dias <= 0 ou motivo vazio", async () => {
  const aluno = await criarPessoa();
  const periodo = await criarPeriodo(aluno.id);
  await esperarErroPg(
    banco.db.insert(extensoesPeriodo).values({
      periodoId: periodo.id,
      dias: 0,
      motivo: "Doença",
      criadoPor: aluno.id,
    }),
    "23514",
  );
  await esperarErroPg(
    banco.db.insert(extensoesPeriodo).values({
      periodoId: periodo.id,
      dias: 7,
      motivo: "  ",
      criadoPor: aluno.id,
    }),
    "23514",
  );
});
