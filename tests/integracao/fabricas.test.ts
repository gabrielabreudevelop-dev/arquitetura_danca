import { afterAll, beforeAll, expect, it } from "vitest";
import { criarBancoDeTeste } from "../apoio/banco";
import {
  criarEvento,
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

it("as fábricas criam linhas coerentes", async () => {
  const turma = await criarTurma(banco.db, { dias: [1] });
  expect(turma.horarioInicio).toBe("19:00:00");
  const dias = await banco.sql(
    `select dia_semana from turma_dias where turma_id = '${turma.id}'`,
  );
  expect(dias).toEqual([{ dia_semana: 1 }]);
  await criarRitmo(banco.db);
  await criarProfessor(banco.db);
  const evento = await criarEvento(banco.db);
  expect(evento.publicado).toBe(true);
  expect(evento.primeiraPublicacaoEm).not.toBeNull();
  const rascunho = await criarEvento(banco.db, { publicado: false });
  expect(rascunho.primeiraPublicacaoEm).toBeNull();
});
