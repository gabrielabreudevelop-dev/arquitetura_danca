import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Banco } from "../banco/cliente";
import {
  contatos,
  encerramentosAluno,
  matriculas,
  periodosContratados,
  pessoaPapeis,
  pessoas,
  responsabilidades,
  turmas,
} from "../banco/esquema";
import {
  ehUuid,
  erroSemDadosPessoais,
  executarTraduzindo,
} from "../cadastros/comum";
import {
  errosDeZod,
  MENSAGEM_EM_USO,
  type Resultado,
} from "../cadastros/resultado";
import {
  normalizarEmail,
  normalizarInstagram,
  normalizarWhatsapp,
} from "../pessoas/normalizar";
import { type DataIso, ehDataIso, ehMenor, formatarDia } from "./datas";

/** O `Banco` ou a transação aberta por `db.transaction`. */
type Transacao = Parameters<Parameters<Banco["transaction"]>[0]>[0];
export type Executor = Banco | Transacao;

export const MENSAGEM_ENCERRADO =
  "Este aluno está encerrado. Reabra o cadastro antes.";
const MENSAGEM_NAO_ENCONTRADO = "Aluno não encontrado.";
const MENSAGEM_WHATSAPP = "WhatsApp inválido. Use DDD e número.";
const MENSAGEM_TURMAS = "Escolha turmas ativas.";
const MENSAGEM_RESPONSAVEL_NAO_ENCONTRADO = "Responsável não encontrado.";

const INICIO_WHATSAPP_REPETIDO = "Já existe ";
const FIM_WHATSAPP_REPETIDO = " com esse WhatsApp.";

/** Erro do campo `whatsapp` na edição quando outra pessoa já usa o número (não bloqueia de vez: a tela oferece confirmar). */
export function mensagemWhatsappRepetido(nome: string): string {
  return `${INICIO_WHATSAPP_REPETIDO}${nome}${FIM_WHATSAPP_REPETIDO}`;
}

/** A mensagem é a de `mensagemWhatsappRepetido`? */
export function ehMensagemWhatsappRepetido(
  mensagem: string | undefined,
): boolean {
  if (!mensagem) return false;
  return (
    mensagem.startsWith(INICIO_WHATSAPP_REPETIDO) &&
    mensagem.endsWith(FIM_WHATSAPP_REPETIDO)
  );
}

const ERROS_BANCO = {
  pessoas_email_unico: {
    campo: "email",
    mensagem: "Já existe uma pessoa com esse e-mail.",
  },
};

export type DadosResponsavel = {
  pessoaId?: string;
  novo?: boolean;
  nome?: string;
  whatsapp?: string;
  email?: string;
};

export type DadosAluno = {
  nome: string;
  nascimento: string;
  whatsapp?: string;
  email?: string;
  instagram?: string;
  responsavel?: DadosResponsavel;
  confirmarWhatsappRepetido?: boolean;
};

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

type ContatoLimpo = {
  nome: string;
  whatsapp: string | null;
  email: string | null;
};

type ResponsavelLimpo =
  | { tipo: "pessoa"; pessoaId: string }
  | ({ tipo: "novo"; explicito: boolean } & ContatoLimpo);

type AlunoLimpo = {
  nome: string;
  nascimento: DataIso;
  menor: boolean;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
};

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const esquemaBasico = z.object({
  nome: z.string().trim().min(1, "Informe o nome."),
  nascimento: z.string().trim().min(1, "Informe a data de nascimento."),
});

function limparEmail(
  bruto: string | undefined,
  campo: string,
  erros: Record<string, string>,
): string | null {
  const email = bruto?.trim() ? normalizarEmail(bruto) : null;
  if (email && !REGEX_EMAIL.test(email))
    erros[campo] = "Informe um e-mail válido.";
  return email;
}

function limparWhatsapp(
  bruto: string | undefined,
  campo: string,
  obrigatorio: string | null,
  erros: Record<string, string>,
): string | null {
  if (!bruto?.trim()) {
    if (obrigatorio) erros[campo] = obrigatorio;
    return null;
  }
  try {
    return normalizarWhatsapp(bruto);
  } catch {
    erros[campo] = MENSAGEM_WHATSAPP;
    return null;
  }
}

/** Valida os dados do próprio aluno. */
function limparAluno(
  dados: DadosAluno,
  hoje: DataIso,
): { erros: Record<string, string>; valor?: AlunoLimpo } {
  const analise = esquemaBasico.safeParse(dados);
  const erros = analise.success ? {} : errosDeZod(analise.error);
  const nascimento = dados.nascimento?.trim() ?? "";
  if (!erros.nascimento) {
    if (!ehDataIso(nascimento))
      erros.nascimento = "Informe a data de nascimento.";
    else if (nascimento > hoje) {
      erros.nascimento = "A data de nascimento não pode ser no futuro.";
    }
  }
  const menor = !erros.nascimento && ehMenor(nascimento, hoje);
  const adulto = !erros.nascimento && !menor;
  const whatsapp = limparWhatsapp(
    dados.whatsapp,
    "whatsapp",
    adulto ? "Informe o WhatsApp." : null,
    erros,
  );
  const email = limparEmail(dados.email, "email", erros);
  let instagram: string | null = null;
  if (dados.instagram?.trim()) {
    try {
      instagram = normalizarInstagram(dados.instagram);
    } catch {
      erros.instagram = "Instagram inválido.";
    }
  }
  if (Object.keys(erros).length > 0 || !analise.success) return { erros };
  return {
    erros,
    valor: {
      nome: analise.data.nome,
      nascimento,
      menor,
      whatsapp,
      email,
      instagram,
    },
  };
}

/**
 * Valida o responsável. `obrigatorio` (menor sem ligação): sem dados, é erro.
 * Devolve `null` quando não há responsável a tratar.
 */
function limparResponsavel(
  r: DadosResponsavel | undefined,
  obrigatorio: boolean,
  erros: Record<string, string>,
): ResponsavelLimpo | null {
  if (r?.pessoaId?.trim()) {
    const pessoaId = r.pessoaId.trim();
    if (!ehUuid(pessoaId)) {
      erros["responsavel.pessoaId"] = MENSAGEM_RESPONSAVEL_NAO_ENCONTRADO;
      return null;
    }
    return { tipo: "pessoa", pessoaId };
  }
  const nome = r?.nome?.trim() ?? "";
  const temAlgo = Boolean(nome || r?.whatsapp?.trim() || r?.email?.trim());
  if (!temAlgo && !r?.novo) {
    if (obrigatorio) erros.responsavel = "Informe o responsável.";
    return null;
  }
  if (!nome) erros.responsavel = "Informe o responsável.";
  const whatsapp = limparWhatsapp(
    r?.whatsapp,
    "responsavel.whatsapp",
    "Informe o WhatsApp do responsável.",
    erros,
  );
  const email = limparEmail(r?.email, "responsavel.email", erros);
  return { tipo: "novo", explicito: Boolean(r?.novo), nome, whatsapp, email };
}

async function pessoaPorEmail(db: Executor, email: string, exceto?: string) {
  const [p] = await db
    .select({ id: pessoas.id, nome: pessoas.nome })
    .from(pessoas)
    .where(
      and(
        sql`lower(${pessoas.email}) = ${email}`,
        exceto ? sql`${pessoas.id} <> ${exceto}` : undefined,
      ),
    );
  return p;
}

async function pessoasPorWhatsapp(
  db: Executor,
  whatsapp: string,
  exceto?: string,
) {
  return db
    .select({ id: pessoas.id, nome: pessoas.nome })
    .from(pessoas)
    .where(
      and(
        eq(pessoas.whatsapp, whatsapp),
        exceto ? sql`${pessoas.id} <> ${exceto}` : undefined,
      ),
    )
    .orderBy(pessoas.nome, pessoas.id);
}

async function existePessoa(db: Executor, id: string) {
  const [p] = await db
    .select({ id: pessoas.id })
    .from(pessoas)
    .where(eq(pessoas.id, id));
  return Boolean(p);
}

/** Lançada dentro da transação para desfazê-la e devolver erros de formulário. */
class ErrosDeFormulario extends Error {
  constructor(readonly erros: Record<string, string>) {
    super("Erros de formulário");
  }
}

/** Transação cujo `throw new ErrosDeFormulario(...)` vira `{ ok: false, erros }`. */
async function transacaoComErros<T>(
  db: Banco,
  corpo: (tx: Transacao) => Promise<Resultado<T>>,
): Promise<Resultado<T>> {
  try {
    return await db.transaction(corpo);
  } catch (erro) {
    if (erro instanceof ErrosDeFormulario)
      return { ok: false, erros: erro.erros };
    throw erroSemDadosPessoais(erro);
  }
}

/** Papel `responsavel` ativo (cria ou reativa). */
async function darPapelResponsavel(tx: Executor, pessoaId: string) {
  await tx
    .insert(pessoaPapeis)
    .values({ pessoaId, papel: "responsavel", ativo: true })
    .onConflictDoUpdate({
      target: [pessoaPapeis.pessoaId, pessoaPapeis.papel],
      set: { ativo: true },
    });
}

/** Grava (ou reaproveita) o responsável e o liga ao aluno, trocando a ligação anterior. */
async function ligarResponsavel(
  tx: Executor,
  alunoId: string,
  r: ResponsavelLimpo,
): Promise<void> {
  let responsavelId: string;
  if (r.tipo === "pessoa") {
    if (r.pessoaId === alunoId || !(await existePessoa(tx, r.pessoaId))) {
      throw new ErrosDeFormulario({
        "responsavel.pessoaId": MENSAGEM_RESPONSAVEL_NAO_ENCONTRADO,
      });
    }
    responsavelId = r.pessoaId;
  } else {
    if (r.email) {
      const dono = await pessoaPorEmail(tx, r.email);
      if (dono) {
        throw new ErrosDeFormulario({
          "responsavel.email": `Esse e-mail já pertence a ${dono.nome}.`,
        });
      }
    }
    const [nova] = await tx
      .insert(pessoas)
      .values({ nome: r.nome, whatsapp: r.whatsapp, email: r.email })
      .returning({ id: pessoas.id });
    responsavelId = nova.id;
  }
  await darPapelResponsavel(tx, responsavelId);
  await tx
    .delete(responsabilidades)
    .where(
      and(
        eq(responsabilidades.alunoId, alunoId),
        sql`${responsabilidades.responsavelId} <> ${responsavelId}`,
      ),
    );
  await tx
    .insert(responsabilidades)
    .values({ responsavelId, alunoId })
    .onConflictDoNothing();
}

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
  const { erros, valor: aluno } = limparAluno(dados, hoje);
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
          if (responsavel?.tipo === "novo" && !responsavel.explicito) {
            let achada: { id: string; nome: string } | undefined;
            if (responsavel.email)
              achada = await pessoaPorEmail(tx, responsavel.email);
            if (!achada && responsavel.whatsapp) {
              const lista = await pessoasPorWhatsapp(tx, responsavel.whatsapp);
              if (lista.length === 1) achada = lista[0];
            }
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

/** Trava a linha da pessoa até o fim da transação. */
export async function travar(tx: Executor, pessoaId: string) {
  await tx
    .select({ id: pessoas.id })
    .from(pessoas)
    .where(eq(pessoas.id, pessoaId))
    .for("update");
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
  const { erros, valor: aluno } = limparAluno(dados, hoje);
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
        const [atual] = await tx
          .select({ whatsapp: pessoas.whatsapp })
          .from(pessoas)
          .where(eq(pessoas.id, alunoId));
        if (aluno.email) {
          const dono = await pessoaPorEmail(tx, aluno.email, alunoId);
          if (dono) {
            return {
              ok: false,
              erros: { email: `Esse e-mail já pertence a ${dono.nome}.` },
            };
          }
        }
        if (
          aluno.whatsapp &&
          aluno.whatsapp !== atual?.whatsapp &&
          !dados.confirmarWhatsappRepetido
        ) {
          const [outra] = await pessoasPorWhatsapp(tx, aluno.whatsapp, alunoId);
          if (outra) {
            return {
              ok: false,
              erros: { whatsapp: mensagemWhatsappRepetido(outra.nome) },
            };
          }
        }
        const ligacoes = await tx
          .select({ responsavelId: responsabilidades.responsavelId })
          .from(responsabilidades)
          .where(eq(responsabilidades.alunoId, alunoId));
        const mudaResponsavel =
          responsavel !== null &&
          !(
            responsavel.tipo === "pessoa" &&
            ligacoes.some((l) => l.responsavelId === responsavel.pessoaId)
          );
        if (aluno.menor && ligacoes.length === 0 && !responsavel) {
          return {
            ok: false,
            erros: { responsavel: "Informe o responsável." },
          };
        }
        await tx
          .update(pessoas)
          .set({
            nome: aluno.nome,
            email: aluno.email,
            whatsapp: aluno.whatsapp,
            dataNascimento: aluno.nascimento,
            instagram: aluno.instagram,
            atualizadoEm: new Date(),
          })
          .where(eq(pessoas.id, alunoId));
        if (responsavel && mudaResponsavel) {
          await ligarResponsavel(tx, alunoId, responsavel);
        }
        return { ok: true, valor: null };
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
 * Remove o papel `aluno` e a ligação com o responsável. Se a pessoa ficar sem
 * nenhum papel e sem login, apaga a pessoa também.
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
        await tx
          .delete(responsabilidades)
          .where(eq(responsabilidades.alunoId, alunoId));
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
