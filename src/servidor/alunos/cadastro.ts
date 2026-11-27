import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Banco } from "../banco/cliente";
import {
  bolsistas,
  contatos,
  encerramentosAluno,
  matriculas,
  periodosContratados,
  pessoaPapeis,
  pessoas,
  responsabilidades,
  turmas,
} from "../banco/esquema";
import { ehUuid, executarTraduzindo } from "../cadastros/comum";
import { MENSAGEM_EM_USO, type Resultado } from "../cadastros/resultado";
import {
  atualizarDadosPessoa,
  type DadosAluno,
  type DadosResponsavel,
  ERROS_BANCO,
  type Executor,
  ehMensagemWhatsappRepetido,
  existePessoa,
  ligarResponsavel,
  limparPessoa,
  limparResponsavel,
  mensagemWhatsappRepetido,
  pessoaPorEmail,
  pessoasPorWhatsapp,
  procurarResponsavelExistente,
  type ResponsavelLimpo,
  transacaoComErros,
  travar,
} from "../pessoas/cadastro-pessoa";
import { type DataIso, ehDataIso, formatarDia } from "./datas";

// Reexportações: outros módulos importam estes nomes daqui.
export {
  type DadosAluno,
  type DadosResponsavel,
  type Executor,
  ehMensagemWhatsappRepetido,
  mensagemWhatsappRepetido,
  travar,
};

export const MENSAGEM_ENCERRADO =
  "Este aluno está encerrado. Reabra o cadastro antes.";
const MENSAGEM_NAO_ENCONTRADO = "Aluno não encontrado.";
const MENSAGEM_TURMAS = "Escolha turmas ativas.";

export type ValorCadastroAluno =
  | { tipo: "criado"; alunoId: string }
  | {
      tipo: "pessoa-existente";
      pessoaId: string;
      nome: string;
      jaAluno: boolean;
    }
  | { tipo: "responsavel-existente"; pessoaId: string; nome: string }
  | { tipo: "whatsapp-repetido"; pessoaId: string; nome: string };

/**
 * Cadastra uma pessoa nova como aluno (e o responsável, se menor), com as
 * turmas marcadas como matrículas de entrada `hoje`. Antes de gravar, devolve
 * `pessoa-existente`, `responsavel-existente` ou `whatsapp-repetido` quando a
 * tela precisa perguntar algo; nesses casos nada é gravado.
 */
export async function cadastrarAluno(
  db: Banco,
  dados: DadosAluno & { turmaIds?: string[] },
  feitoPor: string,
  hoje: DataIso,
): Promise<Resultado<ValorCadastroAluno>> {
  const { erros, valor: aluno } = limparPessoa(dados, hoje);
  let responsavel: ResponsavelLimpo | null = null;
  // Responsável de adulto é ignorado no cadastro.
  if (aluno?.menor)
    responsavel = limparResponsavel(dados.responsavel, true, erros);
  const turmaIds = [...new Set(dados.turmaIds ?? [])];
  if (turmaIds.some((id) => !ehUuid(id))) erros.turmaIds = MENSAGEM_TURMAS;
  if (!aluno || Object.keys(erros).length > 0) return { ok: false, erros };

  return executarTraduzindo<ValorCadastroAluno>(
    () =>
      transacaoComErros<ValorCadastroAluno>(
        db,
        async (tx): Promise<Resultado<ValorCadastroAluno>> => {
          if (turmaIds.length > 0) {
            const ativas = await tx
              .select({ id: turmas.id })
              .from(turmas)
              .where(and(inArray(turmas.id, turmaIds), eq(turmas.ativa, true)));
            if (ativas.length !== turmaIds.length) {
              return { ok: false, erros: { turmaIds: MENSAGEM_TURMAS } };
            }
          }
          if (aluno.email) {
            const dono = await pessoaPorEmail(tx, aluno.email);
            if (dono) {
              const [papel] = await tx
                .select({ pessoaId: pessoaPapeis.pessoaId })
                .from(pessoaPapeis)
                .where(
                  and(
                    eq(pessoaPapeis.pessoaId, dono.id),
                    eq(pessoaPapeis.papel, "aluno"),
                  ),
                );
              return {
                ok: true,
                valor: {
                  tipo: "pessoa-existente",
                  pessoaId: dono.id,
                  nome: dono.nome,
                  jaAluno: Boolean(papel),
                },
              };
            }
          }
          const achada = await procurarResponsavelExistente(tx, responsavel);
          if (achada) {
            return {
              ok: true,
              valor: {
                tipo: "responsavel-existente",
                pessoaId: achada.id,
                nome: achada.nome,
              },
            };
          }
          if (aluno.whatsapp && !dados.confirmarWhatsappRepetido) {
            const [outra] = await pessoasPorWhatsapp(tx, aluno.whatsapp);
            if (outra) {
              return {
                ok: true,
                valor: {
                  tipo: "whatsapp-repetido",
                  pessoaId: outra.id,
                  nome: outra.nome,
                },
              };
            }
          }

          const [pessoa] = await tx
            .insert(pessoas)
            .values({
              nome: aluno.nome,
              email: aluno.email,
              whatsapp: aluno.whatsapp,
              dataNascimento: aluno.nascimento,
              instagram: aluno.instagram,
            })
            .returning({ id: pessoas.id });
          await tx
            .insert(pessoaPapeis)
            .values({ pessoaId: pessoa.id, papel: "aluno", ativo: true });
          if (responsavel) {
            await ligarResponsavel(tx, pessoa.id, responsavel);
          }
          if (turmaIds.length > 0) {
            await tx.insert(matriculas).values(
              turmaIds.map((turmaId) => ({
                alunoId: pessoa.id,
                turmaId,
                entrada: hoje,
                criadoPor: feitoPor,
              })),
            );
          }
          return { ok: true, valor: { tipo: "criado", alunoId: pessoa.id } };
        },
      ),
    ERROS_BANCO,
  );
}

/** Dá o papel `aluno` a uma pessoa que já existe. Aluno encerrado não volta por aqui: use `reabrirAluno`. */
export async function tornarAluno(
  db: Banco,
  pessoaId: string,
): Promise<Resultado<null>> {
  if (!ehUuid(pessoaId)) {
    return { ok: false, erros: { _: "Pessoa não encontrada." } };
  }
  return executarTraduzindo<null>(async () => {
    if (!(await existePessoa(db, pessoaId))) {
      return { ok: false, erros: { _: "Pessoa não encontrada." } };
    }
    const [papel] = await db
      .select({ ativo: pessoaPapeis.ativo })
      .from(pessoaPapeis)
      .where(
        and(
          eq(pessoaPapeis.pessoaId, pessoaId),
          eq(pessoaPapeis.papel, "aluno"),
        ),
      );
    if (papel && !papel.ativo) {
      return { ok: false, erros: { _: MENSAGEM_ENCERRADO } };
    }
    await db
      .insert(pessoaPapeis)
      .values({ pessoaId, papel: "aluno", ativo: true })
      .onConflictDoNothing();
    return { ok: true, valor: null };
  }, {});
}

/** O papel `aluno` da pessoa: `undefined` se não tem. */
async function papelAluno(tx: Executor, alunoId: string) {
  if (!ehUuid(alunoId)) return undefined;
  const [papel] = await tx
    .select({ ativo: pessoaPapeis.ativo })
    .from(pessoaPapeis)
    .where(
      and(eq(pessoaPapeis.pessoaId, alunoId), eq(pessoaPapeis.papel, "aluno")),
    );
  return papel;
}

/**
 * Confere que a pessoa é aluno com cadastro ativo. Serve a quem muda período,
 * matrícula etc.; aceita o `Banco` ou a transação em andamento.
 */
export async function alunoAtivoOuErro(
  tx: Executor,
  alunoId: string,
): Promise<Resultado<null>> {
  const papel = await papelAluno(tx, alunoId);
  if (!papel) return { ok: false, erros: { _: MENSAGEM_NAO_ENCONTRADO } };
  if (!papel.ativo) return { ok: false, erros: { _: MENSAGEM_ENCERRADO } };
  return { ok: true, valor: null };
}

/**
 * Atualiza os dados do aluno (ativo ou encerrado). Sem `responsavel`, mantém a
 * ligação atual; com outro responsável, substitui. Menor sem responsável é erro.
 */
export async function atualizarAluno(
  db: Banco,
  alunoId: string,
  dados: DadosAluno,
  hoje: DataIso,
): Promise<Resultado<null>> {
  const { erros, valor: aluno } = limparPessoa(dados, hoje);
  // Como no cadastro, responsável de adulto é ignorado: a ligação fica como está.
  const responsavel = aluno?.menor
    ? limparResponsavel(dados.responsavel, false, erros)
    : null;
  if (!aluno || Object.keys(erros).length > 0) return { ok: false, erros };

  return executarTraduzindo<null>(
    () =>
      transacaoComErros<null>(db, async (tx): Promise<Resultado<null>> => {
        if (!ehUuid(alunoId))
          return { ok: false, erros: { _: MENSAGEM_NAO_ENCONTRADO } };
        await travar(tx, alunoId);
        if (!(await papelAluno(tx, alunoId))) {
          return { ok: false, erros: { _: MENSAGEM_NAO_ENCONTRADO } };
        }
        return atualizarDadosPessoa(
          tx,
          alunoId,
          aluno,
          responsavel,
          dados.confirmarWhatsappRepetido,
        );
      }),
    ERROS_BANCO,
  );
}

/**
 * Encerra o cadastro: fecha as matrículas abertas com saída em `data`,
 * desativa o papel `aluno` e registra o encerramento.
 */
export async function encerrarAluno(
  db: Banco,
  a: { alunoId: string; data: string; motivo?: string; feitoPor: string },
): Promise<Resultado<null>> {
  const data = a.data?.trim() ?? "";
  if (!ehDataIso(data)) {
    return { ok: false, erros: { data: "Informe a data do encerramento." } };
  }
  const motivo = a.motivo?.trim() || null;
  return executarTraduzindo<null>(
    () =>
      db.transaction(async (tx): Promise<Resultado<null>> => {
        if (!ehUuid(a.alunoId))
          return { ok: false, erros: { _: MENSAGEM_NAO_ENCONTRADO } };
        await travar(tx, a.alunoId);
        const ativo = await alunoAtivoOuErro(tx, a.alunoId);
        if (!ativo.ok) return ativo;
        const abertas = await tx
          .select({ entrada: matriculas.entrada })
          .from(matriculas)
          .where(
            and(eq(matriculas.alunoId, a.alunoId), isNull(matriculas.saida)),
          );
        const posterior = abertas
          .map((m) => m.entrada)
          .filter((e) => e > data)
          .sort()[0];
        if (posterior) {
          return {
            ok: false,
            erros: {
              data: `A data não pode ser antes da entrada numa turma (${formatarDia(posterior)}).`,
            },
          };
        }
        await tx
          .update(matriculas)
          .set({ saida: data, saidaPor: a.feitoPor })
          .where(
            and(eq(matriculas.alunoId, a.alunoId), isNull(matriculas.saida)),
          );
        await tx
          .update(pessoaPapeis)
          .set({ ativo: false })
          .where(
            and(
              eq(pessoaPapeis.pessoaId, a.alunoId),
              eq(pessoaPapeis.papel, "aluno"),
            ),
          );
        await tx.insert(encerramentosAluno).values({
          alunoId: a.alunoId,
          tipo: "encerramento",
          data,
          motivo,
          criadoPor: a.feitoPor,
        });
        return { ok: true, valor: null };
      }),
    {},
  );
}

/** Reativa o papel `aluno` e registra a reabertura. As matrículas encerradas não voltam. */
export async function reabrirAluno(
  db: Banco,
  a: { alunoId: string; feitoPor: string; hoje: DataIso },
): Promise<Resultado<null>> {
  return executarTraduzindo<null>(
    () =>
      db.transaction(async (tx): Promise<Resultado<null>> => {
        if (!ehUuid(a.alunoId))
          return { ok: false, erros: { _: MENSAGEM_NAO_ENCONTRADO } };
        await travar(tx, a.alunoId);
        const papel = await papelAluno(tx, a.alunoId);
        if (!papel) return { ok: false, erros: { _: MENSAGEM_NAO_ENCONTRADO } };
        if (papel.ativo) {
          return { ok: false, erros: { _: "Este aluno não está encerrado." } };
        }
        await tx
          .update(pessoaPapeis)
          .set({ ativo: true })
          .where(
            and(
              eq(pessoaPapeis.pessoaId, a.alunoId),
              eq(pessoaPapeis.papel, "aluno"),
            ),
          );
        await tx.insert(encerramentosAluno).values({
          alunoId: a.alunoId,
          tipo: "reabertura",
          data: a.hoje,
          criadoPor: a.feitoPor,
        });
        return { ok: true, valor: null };
      }),
    {},
  );
}

/**
 * Sem período (e, portanto, sem ajuste), matrícula, contato, encerramento nem
 * dependentes (pessoas de quem ele é o responsável).
 */
export async function podeExcluirAluno(
  db: Executor,
  alunoId: string,
): Promise<boolean> {
  if (!ehUuid(alunoId)) return false;
  const tem = async (consulta: PromiseLike<unknown[]>) =>
    (await consulta).length > 0;
  const buscas = [
    db
      .select({ id: periodosContratados.id })
      .from(periodosContratados)
      .where(eq(periodosContratados.alunoId, alunoId))
      .limit(1),
    db
      .select({ id: matriculas.id })
      .from(matriculas)
      .where(eq(matriculas.alunoId, alunoId))
      .limit(1),
    db
      .select({ id: contatos.id })
      .from(contatos)
      .where(eq(contatos.alunoId, alunoId))
      .limit(1),
    db
      .select({ id: encerramentosAluno.id })
      .from(encerramentosAluno)
      .where(eq(encerramentosAluno.alunoId, alunoId))
      .limit(1),
    db
      .select({ id: responsabilidades.alunoId })
      .from(responsabilidades)
      .where(eq(responsabilidades.responsavelId, alunoId))
      .limit(1),
  ];
  for (const busca of buscas) {
    if (await tem(busca)) return false;
  }
  return true;
}

/**
 * Remove o papel `aluno` e a ligação com o responsável. Quem também é bolsista
 * continua com o responsável (é a pessoa de contato do bolsista menor). Se a
 * pessoa ficar sem nenhum papel e sem login, apaga a pessoa também.
 */
export async function excluirAluno(
  db: Banco,
  alunoId: string,
): Promise<Resultado<null>> {
  return executarTraduzindo<null>(
    () =>
      db.transaction(async (tx): Promise<Resultado<null>> => {
        if (!ehUuid(alunoId))
          return { ok: false, erros: { _: MENSAGEM_NAO_ENCONTRADO } };
        await travar(tx, alunoId);
        if (!(await papelAluno(tx, alunoId))) {
          return { ok: false, erros: { _: MENSAGEM_NAO_ENCONTRADO } };
        }
        if (!(await podeExcluirAluno(tx, alunoId))) {
          return { ok: false, erros: { _: MENSAGEM_EM_USO } };
        }
        const [bolsista] = await tx
          .select({ id: bolsistas.pessoaId })
          .from(bolsistas)
          .where(eq(bolsistas.pessoaId, alunoId))
          .limit(1);
        if (!bolsista) {
          await tx
            .delete(responsabilidades)
            .where(eq(responsabilidades.alunoId, alunoId));
        }
        await tx
          .delete(pessoaPapeis)
          .where(
            and(
              eq(pessoaPapeis.pessoaId, alunoId),
              eq(pessoaPapeis.papel, "aluno"),
            ),
          );
        const [outro] = await tx
          .select({ papel: pessoaPapeis.papel })
          .from(pessoaPapeis)
          .where(eq(pessoaPapeis.pessoaId, alunoId))
          .limit(1);
        if (!outro) {
          // Pessoa com login (usuarioId) nunca é apagada.
          await tx
            .delete(pessoas)
            .where(
              and(eq(pessoas.id, alunoId), sql`${pessoas.usuarioId} is null`),
            );
        }
        return { ok: true, valor: null };
      }),
    {},
  );
}
