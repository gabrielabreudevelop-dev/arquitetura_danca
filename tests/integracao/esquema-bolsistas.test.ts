import { afterAll, beforeAll, expect, it } from "vitest";
import { criarBancoDeTeste } from "../apoio/banco";
import { esperarErroPg } from "../apoio/erros-pg";
import {
  criarAdministracao,
  criarAula,
  criarBolsista,
  criarTurma,
  marcarPresenca,
} from "../apoio/fabricas";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
beforeAll(async () => {
  banco = await criarBancoDeTeste();
});
afterAll(async () => {
  await banco.encerrar();
});

type Linha = Record<string, unknown>;

it("traz a semente 'Bolsista sem vir' ativa e mantém as duas mensagens do M2", async () => {
  const mensagens = await banco.sql(
    "select nome, finalidade, texto from mensagens_prontas where ativa order by finalidade",
  );
  expect(mensagens).toEqual([
    { nome: "Renovação", finalidade: "renovacao", texto: expect.any(String) },
    {
      nome: "Convite para voltar",
      finalidade: "retorno",
      texto: expect.any(String),
    },
    {
      nome: "Bolsista sem vir",
      finalidade: "bolsista",
      texto:
        "Oi, {nome}! Sentimos sua falta nas aulas de {dias}. Tudo bem por aí?",
    },
  ]);
});

it("acordos_bolsista recusa dias vazios e fora de 0 a 6", async () => {
  const adm = await criarAdministracao(banco.db);
  const bolsista = await criarBolsista(banco.db, { criadoPor: adm.id });
  const inserir = (dias: string) =>
    banco.sql(
      `insert into acordos_bolsista (pessoa_id, dias, vigente_desde, criado_por) values ('${bolsista.id}', '${dias}', '2026-11-02', '${adm.id}')`,
    ) as Promise<Linha[]>;
  await esperarErroPg(inserir("{}"), "23514");
  await esperarErroPg(inserir("{7}"), "23514");
  await esperarErroPg(inserir("{2,-1}"), "23514");
  await inserir("{0,6}");
});

it("a fábrica cria bolsista com papel, ativação e acordo vigente", async () => {
  const adm = await criarAdministracao(banco.db);
  const b = await criarBolsista(banco.db, {
    criadoPor: adm.id,
    dias: [1, 3],
    desde: "2026-10-05",
  });
  const [ficha] = await banco.sql(
    `select preferencia from bolsistas where pessoa_id = '${b.id}'`,
  );
  expect(ficha).toEqual({ preferencia: "os_dois" });
  expect(
    await banco.sql(
      `select papel, ativo from pessoa_papeis where pessoa_id = '${b.id}'`,
    ),
  ).toEqual([{ papel: "bolsista", ativo: true }]);
  expect(
    await banco.sql(
      `select tipo, data::text as data from situacoes_bolsista where pessoa_id = '${b.id}'`,
    ),
  ).toEqual([{ tipo: "ativacao", data: "2026-10-05" }]);
  expect(
    await banco.sql(
      `select dias, vigente_desde::text as desde from acordos_bolsista where pessoa_id = '${b.id}'`,
    ),
  ).toEqual([{ dias: [1, 3], desde: "2026-10-05" }]);
});

it("a fábrica cria aluno e bolsista só quando pedido", async () => {
  const adm = await criarAdministracao(banco.db);
  const b = await criarBolsista(banco.db, {
    criadoPor: adm.id,
    tambemAluno: true,
  });
  expect(
    await banco.sql(
      `select papel, ativo from pessoa_papeis where pessoa_id = '${b.id}' order by papel`,
    ),
  ).toEqual([
    { papel: "aluno", ativo: true },
    { papel: "bolsista", ativo: true },
  ]);
});

it("aulas recusa a mesma turma e data duas vezes e 'não houve' sem motivo", async () => {
  const adm = await criarAdministracao(banco.db);
  const turma = await criarTurma(banco.db);
  await criarAula(banco.db, {
    turmaId: turma.id,
    data: "2026-11-03",
    criadoPor: adm.id,
  });
  await esperarErroPg(
    criarAula(banco.db, {
      turmaId: turma.id,
      data: "2026-11-03",
      criadoPor: adm.id,
    }),
    "23505",
  );
  const semMotivo = (motivo: string) =>
    banco.sql(
      `insert into aulas (turma_id, data, situacao, motivo, criado_por) values ('${turma.id}', '2026-11-10', 'nao_houve', ${motivo}, '${adm.id}')`,
    );
  await esperarErroPg(semMotivo("null"), "23514");
  await esperarErroPg(semMotivo("'   '"), "23514");
  await semMotivo("'Feriado'");
});

it("presencas_aula aceita uma desmarcada e uma viva, mas não duas vivas", async () => {
  const adm = await criarAdministracao(banco.db);
  const turma = await criarTurma(banco.db);
  const aula = await criarAula(banco.db, {
    turmaId: turma.id,
    data: "2026-11-03",
    criadoPor: adm.id,
  });
  const b = await criarBolsista(banco.db, { criadoPor: adm.id });
  const primeira = await marcarPresenca(banco.db, {
    aulaId: aula.id,
    pessoaId: b.id,
    por: adm.id,
  });
  await esperarErroPg(
    marcarPresenca(banco.db, { aulaId: aula.id, pessoaId: b.id, por: adm.id }),
    "23505",
  );
  await banco.sql(
    `update presencas_aula set desmarcada_em = now(), desmarcada_por = '${adm.id}' where id = '${primeira.id}'`,
  );
  await marcarPresenca(banco.db, {
    aulaId: aula.id,
    pessoaId: b.id,
    por: adm.id,
  });
  expect(
    await banco.sql(
      `select count(*)::int as n from presencas_aula where aula_id = '${aula.id}'`,
    ),
  ).toEqual([{ n: 2 }]);
});

it("presencas_aula recusa desmarcação com só uma das duas colunas", async () => {
  const adm = await criarAdministracao(banco.db);
  const turma = await criarTurma(banco.db);
  const aula = await criarAula(banco.db, {
    turmaId: turma.id,
    data: "2026-11-03",
    criadoPor: adm.id,
  });
  const b = await criarBolsista(banco.db, { criadoPor: adm.id });
  const p = await marcarPresenca(banco.db, {
    aulaId: aula.id,
    pessoaId: b.id,
    por: adm.id,
  });
  await esperarErroPg(
    banco.sql(
      `update presencas_aula set desmarcada_em = now() where id = '${p.id}'`,
    ),
    "23514",
  );
  await esperarErroPg(
    banco.sql(
      `update presencas_aula set desmarcada_por = '${adm.id}' where id = '${p.id}'`,
    ),
    "23514",
  );
});
