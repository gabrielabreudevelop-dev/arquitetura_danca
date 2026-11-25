/**
 * Contatos pelo WhatsApp: prepara o link `wa.me` com a mensagem pronta,
 * registra o contato (uma linha por aluno, com o mesmo grupo), marca o
 * resultado e a marca "não quer contato" da pessoa que recebe as mensagens.
 */
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { type Executor, MENSAGEM_ENCERRADO } from "../alunos/cadastro";
import {
  type AlunoCarregado,
  carregarAlunos,
  type PessoaDeContato,
} from "../alunos/carga";
import { type DataIso, formatarDia } from "../alunos/datas";
import type { Banco } from "../banco/cliente";
import { bloqueiosContato, contatos, pessoas } from "../banco/esquema";
import { ehUuid, executarTraduzindo } from "../cadastros/comum";
import type { Resultado } from "../cadastros/resultado";
import {
  type Finalidade,
  mensagemAtiva,
} from "../configuracoes/mensagens-prontas";
import {
  juntarLista,
  linkConversa,
  preencherMensagem,
  primeiroNome,
} from "./mensagens";
import { type ListaContato, RESULTADOS } from "./valores";

export const MENSAGEM_ALUNO_NAO_ENCONTRADO = "Aluno não encontrado.";
export const MENSAGEM_CONTATOS_DIFERENTES =
  "Esses alunos não têm o mesmo contato.";
export const MENSAGEM_BLOQUEADO = "Esta pessoa pediu para não ser contatada.";
export const MENSAGEM_SEM_WHATSAPP = "Cadastre um WhatsApp antes de chamar.";
const MENSAGEM_RESULTADO = "Escolha um resultado da lista.";
const MENSAGEM_CONTATO_NAO_ENCONTRADO = "Contato não encontrado.";
const MENSAGEM_PESSOA_NAO_ENCONTRADA = "Pessoa não encontrada.";

function falha<T>(mensagem: string, campo = "_"): Resultado<T> {
  return { ok: false, erros: { [campo]: mensagem } };
}

/** Vence em breve: renovação; vencido: retorno; ficha: pelo estado de hoje. */
function finalidadeDa(
  lista: ListaContato,
  alunos: AlunoCarregado[],
): Finalidade {
  if (lista === "vence_em_breve") return "renovacao";
  if (lista === "vencido") return "retorno";
  const emCurso = alunos.every(
    (a) => a.resumo.estado === "vigente" || a.resumo.estado === "trancado",
  );
  return emCurso ? "renovacao" : "retorno";
}

/** Valores distintos, na ordem em que aparecem. */
function distintos(itens: string[]): string[] {
  return [...new Set(itens)];
}

/**
 * Monta o contato de um ou mais alunos que têm a mesma pessoa de contato:
 * quem recebe, o texto da mensagem pronta ativa da finalidade (ou `null`, sem
 * mensagem ativa) e o link `wa.me`. Não grava nada.
 */
export async function prepararContato(
  db: Banco,
  a: { alunoIds: string[]; lista: ListaContato },
  hoje: DataIso,
): Promise<
  Resultado<{
    pessoa: PessoaDeContato;
    texto: string | null;
    mensagemId: string | null;
    url: string;
  }>
> {
  const ids = distintos(a.alunoIds.map((id) => id.toLowerCase()));
  if (ids.length === 0 || !ids.every(ehUuid)) {
    return falha(MENSAGEM_ALUNO_NAO_ENCONTRADO);
  }
  const carregados = await carregarAlunos(db, hoje, { ids });
  const porId = new Map(carregados.map((al) => [al.id, al]));
  // Na ordem pedida (a da linha da lista), não na de nome.
  const alunos = ids.flatMap((id) => porId.get(id) ?? []);
  if (alunos.length !== ids.length) {
    return falha(MENSAGEM_ALUNO_NAO_ENCONTRADO);
  }
  if (alunos.some((al) => al.encerrado)) return falha(MENSAGEM_ENCERRADO);

  const pessoa = alunos[0].contato;
  if (alunos.some((al) => al.contato.pessoaId !== pessoa.pessoaId)) {
    return falha(MENSAGEM_CONTATOS_DIFERENTES);
  }
  if (pessoa.naoQuerContato) return falha(MENSAGEM_BLOQUEADO);
  if (!pessoa.whatsapp) return falha(MENSAGEM_SEM_WHATSAPP);

  const mensagem = await mensagemAtiva(db, finalidadeDa(a.lista, alunos));
  const texto = mensagem
    ? preencherMensagem(mensagem.texto, {
        nome: primeiroNome(pessoa.nome),
        aluno: juntarLista(alunos.map((al) => primeiroNome(al.nome))),
        turma: juntarLista(
          distintos(
            alunos.flatMap((al) =>
              al.matriculas.map((m) => `${m.ritmo} ${m.modulo}`),
            ),
          ),
        ),
        fim: juntarLista(
          distintos(
            alunos.flatMap((al) =>
              al.resumo.ultimo
                ? [formatarDia(al.resumo.ultimo.fimEfetivo)]
                : [],
            ),
          ),
        ),
      })
    : null;

  return {
    ok: true,
    valor: {
      pessoa,
      texto,
      mensagemId: mensagem?.id ?? null,
      url: linkConversa(pessoa.whatsapp.replace(/\D/g, ""), texto ?? undefined),
    },
  };
}

/**
 * Prepara o contato e grava uma linha por aluno, todas com o mesmo grupo,
 * número, mensagem e texto (e o mesmo horário). Devolve o link para abrir.
 */
export async function registrarContato(
  db: Banco,
  a: { alunoIds: string[]; lista: ListaContato; feitoPor: string },
  hoje: DataIso,
): Promise<Resultado<{ url: string; grupoId: string }>> {
  return executarTraduzindo(() => registrarContatoSemTraducao(db, a, hoje), {});
}

async function registrarContatoSemTraducao(
  db: Banco,
  a: { alunoIds: string[]; lista: ListaContato; feitoPor: string },
  hoje: DataIso,
): Promise<Resultado<{ url: string; grupoId: string }>> {
  const preparo = await prepararContato(db, a, hoje);
  if (!preparo.ok) return preparo;
  const { pessoa, texto, mensagemId, url } = preparo.valor;
  const grupoId = randomUUID();
  const ids = distintos(a.alunoIds.map((id) => id.toLowerCase()));
  return db.transaction(
    async (tx): Promise<Resultado<{ url: string; grupoId: string }>> => {
      // Com a pessoa travada, uma marca "não quer contato" feita ao mesmo
      // tempo ou já entrou (e é vista aqui) ou espera este registro terminar.
      await travarPessoas(tx, [pessoa.pessoaId]);
      if (await temBloqueioAberto(tx, pessoa.pessoaId)) {
        return falha(MENSAGEM_BLOQUEADO);
      }
      // Um único INSERT: todas as linhas recebem o mesmo `now()` da transação.
      await tx.insert(contatos).values(
        ids.map((alunoId) => ({
          grupoId,
          alunoId,
          pessoaContatoId: pessoa.pessoaId,
          whatsapp: pessoa.whatsapp ?? "",
          lista: a.lista,
          mensagemId,
          texto,
          criadoPor: a.feitoPor,
        })),
      );
      return { ok: true, valor: { url, grupoId } };
    },
  );
}

/**
 * Trava as linhas de `pessoas` (em ordem de id) e devolve as que existem.
 * Registrar contato e marcar "não quer contato" travam a pessoa de contato.
 */
async function travarPessoas(tx: Executor, ids: string[]): Promise<string[]> {
  const existentes: string[] = [];
  for (const id of distintos(ids).sort()) {
    const [linha] = await tx
      .select({ id: pessoas.id })
      .from(pessoas)
      .where(eq(pessoas.id, id))
      .for("update");
    if (linha) existentes.push(linha.id);
  }
  return existentes;
}

async function temBloqueioAberto(
  tx: Executor,
  pessoaId: string,
): Promise<boolean> {
  const [linha] = await tx
    .select({ id: bloqueiosContato.id })
    .from(bloqueiosContato)
    .where(
      and(
        eq(bloqueiosContato.pessoaId, pessoaId),
        isNull(bloqueiosContato.desfeitoEm),
      ),
    );
  return linha !== undefined;
}

/**
 * Grupo do contato mais recente de cada aluno com a pessoa de contato dele
 * (contatos com quem era o contato antes não contam). Uma linha da lista pode
 * juntar irmãos cujos últimos contatos são de grupos diferentes (um deles
 * chamado sozinho pela ficha): o resultado da linha vale para todos esses grupos.
 */
export async function ultimosGruposDosAlunos(
  db: Executor,
  alunos: { alunoId: string; pessoaId: string }[],
): Promise<Map<string, string>> {
  const pessoaDe = new Map(
    alunos
      .filter((a) => ehUuid(a.alunoId) && ehUuid(a.pessoaId))
      .map((a) => [a.alunoId.toLowerCase(), a.pessoaId.toLowerCase()]),
  );
  if (pessoaDe.size === 0) return new Map();
  const linhas = await db
    .selectDistinctOn([contatos.alunoId, contatos.pessoaContatoId], {
      alunoId: contatos.alunoId,
      pessoaId: contatos.pessoaContatoId,
      grupoId: contatos.grupoId,
    })
    .from(contatos)
    .where(inArray(contatos.alunoId, [...pessoaDe.keys()]))
    .orderBy(
      asc(contatos.alunoId),
      asc(contatos.pessoaContatoId),
      desc(contatos.criadoEm),
      desc(contatos.id),
    );
  return new Map(
    linhas
      .filter((l) => pessoaDe.get(l.alunoId) === l.pessoaId)
      .map((l) => [l.alunoId, l.grupoId]),
  );
}

/** Abre o bloqueio da pessoa, se ainda não houver um aberto. */
async function abrirBloqueio(
  db: Executor,
  pessoaId: string,
  feitoPor: string,
): Promise<void> {
  // O índice único parcial (um bloqueio aberto por pessoa) evita o segundo.
  await db
    .insert(bloqueiosContato)
    .values({ pessoaId, marcadoPor: feitoPor })
    .onConflictDoNothing();
}

/**
 * Marca (ou troca) o resultado de todas as linhas dos grupos (os últimos
 * contatos dos alunos de uma linha da lista, todos com a mesma pessoa de
 * contato). "Não quer contato" também marca essa pessoa. Grupo inexistente ou
 * de outra pessoa: nada muda.
 */
export async function marcarResultado(
  db: Banco,
  a: {
    pessoaId: string;
    grupoIds: string[];
    resultado: string;
    feitoPor: string;
  },
): Promise<Resultado<null>> {
  const resultado = RESULTADOS.find((r) => r === a.resultado);
  if (!resultado) return falha(MENSAGEM_RESULTADO, "resultado");
  const grupos = distintos(a.grupoIds.map((g) => g.toLowerCase()));
  if (!ehUuid(a.pessoaId) || grupos.length === 0 || !grupos.every(ehUuid)) {
    return falha(MENSAGEM_CONTATO_NAO_ENCONTRADO);
  }
  const pessoaId = a.pessoaId.toLowerCase();
  return executarTraduzindo(
    () =>
      db.transaction(async (tx): Promise<Resultado<null>> => {
        const existentes = await tx
          .select({
            grupoId: contatos.grupoId,
            pessoaContatoId: contatos.pessoaContatoId,
          })
          .from(contatos)
          .where(inArray(contatos.grupoId, grupos));
        const todosDaPessoa = existentes.every(
          (e) => e.pessoaContatoId === pessoaId,
        );
        if (
          !todosDaPessoa ||
          new Set(existentes.map((e) => e.grupoId)).size !== grupos.length
        ) {
          return falha(MENSAGEM_CONTATO_NAO_ENCONTRADO);
        }
        if (resultado === "nao_quer_contato") {
          await travarPessoas(tx, [pessoaId]);
        }
        await tx
          .update(contatos)
          .set({
            resultado,
            resultadoPor: a.feitoPor,
            resultadoEm: sql`now()`,
          })
          .where(inArray(contatos.grupoId, grupos));
        if (resultado === "nao_quer_contato") {
          await abrirBloqueio(tx, pessoaId, a.feitoPor);
        }
        return { ok: true, valor: null };
      }),
    {},
  );
}

async function pessoaExiste(db: Banco, pessoaId: string): Promise<boolean> {
  if (!ehUuid(pessoaId)) return false;
  const [linha] = await db
    .select({ id: pessoas.id })
    .from(pessoas)
    .where(eq(pessoas.id, pessoaId));
  return linha !== undefined;
}

/** Marca "não quer contato" na pessoa (nada muda se já estiver marcada). */
export async function marcarNaoQuerContato(
  db: Banco,
  a: { pessoaId: string; feitoPor: string },
): Promise<Resultado<null>> {
  if (!ehUuid(a.pessoaId)) return falha(MENSAGEM_PESSOA_NAO_ENCONTRADA);
  const pessoaId = a.pessoaId.toLowerCase();
  return executarTraduzindo(
    () =>
      db.transaction(async (tx): Promise<Resultado<null>> => {
        const [existe] = await travarPessoas(tx, [pessoaId]);
        if (!existe) return falha(MENSAGEM_PESSOA_NAO_ENCONTRADA);
        await abrirBloqueio(tx, pessoaId, a.feitoPor);
        return { ok: true, valor: null };
      }),
    {},
  );
}

/** "Voltou a aceitar contato": fecha o bloqueio aberto, com quem e quando. */
export async function desfazerNaoQuerContato(
  db: Banco,
  a: { pessoaId: string; feitoPor: string },
): Promise<Resultado<null>> {
  return executarTraduzindo(async () => {
    if (!(await pessoaExiste(db, a.pessoaId))) {
      return falha(MENSAGEM_PESSOA_NAO_ENCONTRADA);
    }
    await db
      .update(bloqueiosContato)
      .set({ desfeitoEm: sql`now()`, desfeitoPor: a.feitoPor })
      .where(
        and(
          eq(bloqueiosContato.pessoaId, a.pessoaId.toLowerCase()),
          isNull(bloqueiosContato.desfeitoEm),
        ),
      );
    return { ok: true as const, valor: null };
  }, {});
}
