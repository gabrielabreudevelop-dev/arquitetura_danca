import { afterAll, beforeAll, expect, it } from "vitest";
import { criarBancoDeTeste } from "../apoio/banco";
import { esperarErroPg } from "../apoio/erros-pg";
import {
  criarAdministracao,
  criarAluno,
  criarMatricula,
  criarPeriodo,
  criarTurma,
} from "../apoio/fabricas";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
beforeAll(async () => {
  banco = await criarBancoDeTeste();
});
afterAll(async () => {
  await banco.encerrar();
});

type Linha = Record<string, unknown>;

async function admin() {
  return criarAdministracao(banco.db);
}

async function periodoNovo() {
  const adm = await admin();
  const aluno = await criarAluno(banco.db);
  const periodo = await criarPeriodo(banco.db, {
    alunoId: aluno.id,
    inicio: "2026-01-01",
    fim: "2026-01-31",
    criadoPor: adm.id,
  });
  return { adm, aluno, periodo };
}

function inserirAjuste(
  periodoId: string,
  criadoPor: string,
  extra: Record<string, string | number | null> = {},
) {
  const v: Record<string, string | number | null> = {
    periodo_id: periodoId,
    tipo: "extensao",
    dias: 3,
    quantidade_digitada: 3,
    unidade_digitada: "dias",
    motivo: "Doença",
    criado_por: criadoPor,
    ...extra,
  };
  const colunas = Object.keys(v).join(", ");
  const valores = Object.values(v)
    .map((x) => (x === null ? "null" : `'${x}'`))
    .join(", ");
  return banco.sql(
    `insert into ajustes_periodo (${colunas}) values (${valores}) returning id`,
  ) as Promise<Linha[]>;
}

it("traz as sementes: unidade dos ajustes e duas mensagens prontas ativas", async () => {
  const config = await banco.sql(
    "select valor from configuracoes where chave = 'unidade_ajustes'",
  );
  expect(config).toEqual([{ valor: "dias" }]);
  const mensagens = await banco.sql(
    "select nome, finalidade from mensagens_prontas where ativa order by finalidade",
  );
  expect(mensagens).toEqual([
    { nome: "Renovação", finalidade: "renovacao" },
    { nome: "Convite para voltar", finalidade: "retorno" },
    // Semente do marco de bolsistas (0012).
    { nome: "Bolsista sem vir", finalidade: "bolsista" },
  ]);
});

it("ajustes_periodo recusa dias inválidos para o tipo, aulas sem turma e extensão sem motivo", async () => {
  const { adm, periodo } = await periodoNovo();
  await esperarErroPg(inserirAjuste(periodo.id, adm.id, { dias: 0 }), "23514");
  await esperarErroPg(
    inserirAjuste(periodo.id, adm.id, { dias: -3, tipo: "extensao" }),
    "23514",
  );
  await esperarErroPg(
    inserirAjuste(periodo.id, adm.id, {
      dias: 3,
      tipo: "transferencia_saida",
    }),
    "23514",
  );
  await esperarErroPg(
    inserirAjuste(periodo.id, adm.id, { unidade_digitada: "aulas" }),
    "23514",
  );
  await esperarErroPg(
    inserirAjuste(periodo.id, adm.id, { motivo: null }),
    "23514",
  );
  await esperarErroPg(
    inserirAjuste(periodo.id, adm.id, { motivo: "  " }),
    "23514",
  );
  // Válidos: saída com dias negativos; aulas com turma; trancamento sem motivo.
  await inserirAjuste(periodo.id, adm.id, {
    dias: -3,
    tipo: "transferencia_saida",
  });
  const turma = await criarTurma(banco.db);
  await inserirAjuste(periodo.id, adm.id, {
    unidade_digitada: "aulas",
    turma_conversao_id: turma.id,
  });
  await inserirAjuste(periodo.id, adm.id, {
    tipo: "trancamento",
    motivo: null,
  });
});

it("ajustes_periodo: anular passa uma vez; alterar dias, anular de novo e apagar falham", async () => {
  const { adm, periodo } = await periodoNovo();
  const [ajuste] = await inserirAjuste(periodo.id, adm.id);
  const id = ajuste.id as string;

  await esperarErroPg(
    banco.sql(`update ajustes_periodo set dias = 9 where id = '${id}'`),
    "P0001",
  );
  await esperarErroPg(
    banco.sql(
      `update ajustes_periodo set anulado_em = now(), anulado_por = '${adm.id}', dias = 9 where id = '${id}'`,
    ),
    "P0001",
  );
  await banco.sql(
    `update ajustes_periodo set anulado_em = now(), anulado_por = '${adm.id}', motivo_anulacao = 'Erro' where id = '${id}'`,
  );
  await esperarErroPg(
    banco.sql(
      `update ajustes_periodo set motivo_anulacao = 'Outro' where id = '${id}'`,
    ),
    "P0001",
  );
  await esperarErroPg(
    banco.sql(`delete from ajustes_periodo where id = '${id}'`),
    "P0001",
  );
  await esperarErroPg(banco.sql("truncate ajustes_periodo"), "P0001");
});

it("ajustes_periodo recusa anulação com só uma das três colunas", async () => {
  const { adm, periodo } = await periodoNovo();
  const [ajuste] = await inserirAjuste(periodo.id, adm.id);
  await esperarErroPg(
    banco.sql(
      `update ajustes_periodo set anulado_em = now() where id = '${ajuste.id}'`,
    ),
    "23514",
  );
});

it("periodos_contratados tem o mesmo livro imutável", async () => {
  const { adm, periodo } = await periodoNovo();
  await esperarErroPg(
    banco.sql(
      `update periodos_contratados set fim = '2026-02-28' where id = '${periodo.id}'`,
    ),
    "P0001",
  );
  await esperarErroPg(
    banco.sql(
      `update periodos_contratados set anulado_em = now() where id = '${periodo.id}'`,
    ),
    "23514",
  );
  await banco.sql(
    `update periodos_contratados set anulado_em = now(), anulado_por = '${adm.id}', motivo_anulacao = 'Erro' where id = '${periodo.id}'`,
  );
  await esperarErroPg(
    banco.sql(
      `update periodos_contratados set anulado_em = now(), anulado_por = '${adm.id}', motivo_anulacao = 'De novo' where id = '${periodo.id}'`,
    ),
    "P0001",
  );
  await esperarErroPg(
    banco.sql(`delete from periodos_contratados where id = '${periodo.id}'`),
    "P0001",
  );
  await esperarErroPg(
    banco.sql("truncate periodos_contratados cascade"),
    "P0001",
  );
});

it("matrícula aberta é única por aluno e turma; aberta e encerrada convivem", async () => {
  const adm = await admin();
  const aluno = await criarAluno(banco.db);
  const turma = await criarTurma(banco.db);
  const base = {
    alunoId: aluno.id,
    turmaId: turma.id,
    criadoPor: adm.id,
  };
  await criarMatricula(banco.db, { ...base, entrada: "2026-01-01" });
  await esperarErroPg(
    criarMatricula(banco.db, { ...base, entrada: "2026-02-01" }),
    "23505",
  );
  await banco.sql(
    `update matriculas set saida = '2026-03-01' where aluno_id = '${aluno.id}'`,
  );
  await criarMatricula(banco.db, { ...base, entrada: "2026-04-01" });
  await esperarErroPg(
    banco.sql(
      `update matriculas set saida = '2026-03-01' where aluno_id = '${aluno.id}' and saida is null`,
    ),
    "23514",
  );
});

it("só uma mensagem pronta ativa por finalidade", async () => {
  await esperarErroPg(
    banco.sql(
      "insert into mensagens_prontas (nome, finalidade, texto) values ('Outra', 'renovacao', 'x')",
    ),
    "23505",
  );
  await banco.sql(
    "insert into mensagens_prontas (nome, finalidade, texto, ativa) values ('Rascunho', 'renovacao', 'x', false)",
  );
});

it("só um bloqueio de contato aberto por pessoa", async () => {
  const adm = await admin();
  const pessoa = await criarAluno(banco.db);
  const inserir = () =>
    banco.sql(
      `insert into bloqueios_contato (pessoa_id, marcado_por) values ('${pessoa.id}', '${adm.id}')`,
    );
  await inserir();
  await esperarErroPg(inserir(), "23505");
  await banco.sql(
    `update bloqueios_contato set desfeito_em = now(), desfeito_por = '${adm.id}' where pessoa_id = '${pessoa.id}'`,
  );
  await inserir();
});

it("recusa instagram fora do formato", async () => {
  await esperarErroPg(
    criarAluno(banco.db, { instagram: "Ana Souza" }),
    "23514",
  );
  await criarAluno(banco.db, { instagram: "ana.souza_1" });
});
