import { and, desc, eq, sql } from "drizzle-orm";
import { type DataIso, ehDataIso, formatarDia } from "../alunos/datas";
import type { Banco } from "../banco/cliente";
import {
  acordosBolsista,
  bolsistas,
  pessoaPapeis,
  pessoas,
  situacoesBolsista,
} from "../banco/esquema";
import { ehUuid, executarTraduzindo } from "../cadastros/comum";
import type { Resultado } from "../cadastros/resultado";
import {
  type DadosAluno,
  ERROS_BANCO,
  type Executor,
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
import type { Preferencia } from "./textos";

export const MENSAGEM_NAO_BOLSISTA = "Bolsista não encontrado.";
const MENSAGEM_PESSOA_NAO_ENCONTRADA = "Pessoa não encontrada.";
const MENSAGEM_DIAS = "Escolha ao menos um dia.";
const MENSAGEM_PREFERENCIA = "Escolha uma preferência.";
const MENSAGEM_DATA_INVALIDA = "Informe uma data válida.";
const MENSAGEM_DATA_FUTURA = "A data não pode ser no futuro.";
const PREFERENCIAS: readonly string[] = [
  "os_dois",
  "conduzir",
  "ser_conduzido",
] satisfies Preferencia[];

export type DadosBolsista = DadosAluno & {
  dias: number[];
  preferencia: string;
};

export type ValorCadastroBolsista =
  | { tipo: "criado"; bolsistaId: string }
  | {
      tipo: "pessoa-existente";
      pessoaId: string;
      nome: string;
      jaBolsista: boolean;
    }
  | { tipo: "responsavel-existente"; pessoaId: string; nome: string }
  | { tipo: "whatsapp-repetido"; pessoaId: string; nome: string };

/** Dias sem repetidos e em ordem, ou `null` se vazio ou fora de 0–6. */
function normalizarDias(dias: number[] | undefined): number[] | null {
  if (!Array.isArray(dias) || dias.length === 0) return null;
  if (!dias.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) return null;
  return [...new Set(dias)].sort((a, b) => a - b);
}

function ehPreferencia(valor: string): valor is Preferencia {
  return PREFERENCIAS.includes(valor);
}

/** Valida data de formulário: válida e não futura. */
function erroDeData(data: string, hoje: DataIso): string | null {
  if (!ehDataIso(data)) return MENSAGEM_DATA_INVALIDA;
  if (data > hoje) return MENSAGEM_DATA_FUTURA;
  return null;
}

async function ehBolsista(tx: Executor, pessoaId: string): Promise<boolean> {
  if (!ehUuid(pessoaId)) return false;
  const [b] = await tx
    .select({ id: bolsistas.pessoaId })
    .from(bolsistas)
    .where(eq(bolsistas.pessoaId, pessoaId));
  return Boolean(b);
}

/** Papel `bolsista` ativo (cria ou reativa). */
async function darPapelBolsista(tx: Executor, pessoaId: string) {
  await tx
    .insert(pessoaPapeis)
    .values({ pessoaId, papel: "bolsista", ativo: true })
    .onConflictDoUpdate({
      target: [pessoaPapeis.pessoaId, pessoaPapeis.papel],
      set: { ativo: true },
    });
}

/** Papel, ficha, situação de ativação e acordo de uma pessoa que ainda não é bolsista. */
async function criarFicha(
  tx: Executor,
  a: {
    pessoaId: string;
    dias: number[];
    preferencia: Preferencia;
    feitoPor: string;
    hoje: DataIso;
  },
) {
  await darPapelBolsista(tx, a.pessoaId);
  await tx
    .insert(bolsistas)
    .values({ pessoaId: a.pessoaId, preferencia: a.preferencia });
  await tx.insert(situacoesBolsista).values({
    pessoaId: a.pessoaId,
    tipo: "ativacao",
    data: a.hoje,
    criadoPor: a.feitoPor,
  });
  await tx.insert(acordosBolsista).values({
    pessoaId: a.pessoaId,
    dias: a.dias,
    vigenteDesde: a.hoje,
    criadoPor: a.feitoPor,
  });
}

/**
 * Cadastra uma pessoa nova como bolsista (e o responsável, se menor), com a
 * situação `ativacao` e o acordo de dias vigentes desde `hoje`. Como no cadastro
 * de alunos, devolve `pessoa-existente`, `responsavel-existente` ou
 * `whatsapp-repetido` quando a tela precisa perguntar algo; nada é gravado.
 */
export async function cadastrarBolsista(
  db: Banco,
  dados: DadosBolsista,
  feitoPor: string,
  hoje: DataIso,
): Promise<Resultado<ValorCadastroBolsista>> {
  const { erros, valor: pessoa } = limparPessoa(dados, hoje);
  let responsavel: ResponsavelLimpo | null = null;
  if (pessoa?.menor)
    responsavel = limparResponsavel(dados.responsavel, true, erros);
  const dias = normalizarDias(dados.dias);
  if (!dias) erros.dias = MENSAGEM_DIAS;
  if (!ehPreferencia(dados.preferencia))
    erros.preferencia = MENSAGEM_PREFERENCIA;
  if (!pessoa || !dias || !ehPreferencia(dados.preferencia))
    return { ok: false, erros };
  if (Object.keys(erros).length > 0) return { ok: false, erros };
  const preferencia = dados.preferencia;

  return executarTraduzindo<ValorCadastroBolsista>(
    () =>
      transacaoComErros<ValorCadastroBolsista>(
        db,
        async (tx): Promise<Resultado<ValorCadastroBolsista>> => {
          if (pessoa.email) {
            const dono = await pessoaPorEmail(tx, pessoa.email);
            if (dono) {
              return {
                ok: true,
                valor: {
                  tipo: "pessoa-existente",
                  pessoaId: dono.id,
                  nome: dono.nome,
                  jaBolsista: await ehBolsista(tx, dono.id),
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
          if (pessoa.whatsapp && !dados.confirmarWhatsappRepetido) {
            const [outra] = await pessoasPorWhatsapp(tx, pessoa.whatsapp);
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

          const [nova] = await tx
            .insert(pessoas)
            .values({
              nome: pessoa.nome,
              email: pessoa.email,
              whatsapp: pessoa.whatsapp,
              dataNascimento: pessoa.nascimento,
              instagram: pessoa.instagram,
            })
            .returning({ id: pessoas.id });
          if (responsavel) await ligarResponsavel(tx, nova.id, responsavel);
          await criarFicha(tx, {
            pessoaId: nova.id,
            dias,
            preferencia,
            feitoPor,
            hoje,
          });
          return { ok: true, valor: { tipo: "criado", bolsistaId: nova.id } };
        },
      ),
    ERROS_BANCO,
  );
}

/** Dá o papel `bolsista` a uma pessoa que já existe, com ficha, situação e acordo. */
export async function tornarBolsista(
  db: Banco,
  a: {
    pessoaId: string;
    dias: number[];
    preferencia: string;
    feitoPor: string;
  },
  hoje: DataIso,
): Promise<Resultado<null>> {
  const erros: Record<string, string> = {};
  const dias = normalizarDias(a.dias);
  if (!dias) erros.dias = MENSAGEM_DIAS;
  if (!ehPreferencia(a.preferencia)) erros.preferencia = MENSAGEM_PREFERENCIA;
  if (!dias || !ehPreferencia(a.preferencia)) return { ok: false, erros };
  const preferencia = a.preferencia;
  if (!ehUuid(a.pessoaId)) {
    return { ok: false, erros: { _: MENSAGEM_PESSOA_NAO_ENCONTRADA } };
  }
  return executarTraduzindo<null>(
    () =>
      transacaoComErros<null>(db, async (tx): Promise<Resultado<null>> => {
        await travar(tx, a.pessoaId);
        if (!(await existePessoa(tx, a.pessoaId))) {
          return { ok: false, erros: { _: MENSAGEM_PESSOA_NAO_ENCONTRADA } };
        }
        if (await ehBolsista(tx, a.pessoaId)) {
          return { ok: false, erros: { _: "Esta pessoa já é bolsista." } };
        }
        await criarFicha(tx, {
          pessoaId: a.pessoaId,
          dias,
          preferencia,
          feitoPor: a.feitoPor,
          hoje,
        });
        return { ok: true, valor: null };
      }),
    ERROS_BANCO,
  );
}

/** Atualiza os dados pessoais e a preferência. Os dias mudam só por `alterarDias`. */
export async function atualizarBolsista(
  db: Banco,
  pessoaId: string,
  dados: DadosAluno & { preferencia: string },
  hoje: DataIso,
): Promise<Resultado<null>> {
  const { erros, valor: pessoa } = limparPessoa(dados, hoje);
  const responsavel = pessoa?.menor
    ? limparResponsavel(dados.responsavel, false, erros)
    : null;
  if (!ehPreferencia(dados.preferencia))
    erros.preferencia = MENSAGEM_PREFERENCIA;
  if (!pessoa || !ehPreferencia(dados.preferencia)) return { ok: false, erros };
  if (Object.keys(erros).length > 0) return { ok: false, erros };
  const preferencia = dados.preferencia;

  return executarTraduzindo<null>(
    () =>
      transacaoComErros<null>(db, async (tx): Promise<Resultado<null>> => {
        if (!ehUuid(pessoaId))
          return { ok: false, erros: { _: MENSAGEM_NAO_BOLSISTA } };
        await travar(tx, pessoaId);
        if (!(await ehBolsista(tx, pessoaId))) {
          return { ok: false, erros: { _: MENSAGEM_NAO_BOLSISTA } };
        }
        const [atual] = await tx
          .select({ whatsapp: pessoas.whatsapp })
          .from(pessoas)
          .where(eq(pessoas.id, pessoaId));
        if (pessoa.email) {
          const dono = await pessoaPorEmail(tx, pessoa.email, pessoaId);
          if (dono) {
            return {
              ok: false,
              erros: { email: `Esse e-mail já pertence a ${dono.nome}.` },
            };
          }
        }
        if (
          pessoa.whatsapp &&
          pessoa.whatsapp !== atual?.whatsapp &&
          !dados.confirmarWhatsappRepetido
        ) {
          const [outra] = await pessoasPorWhatsapp(
            tx,
            pessoa.whatsapp,
            pessoaId,
          );
          if (outra) {
            return {
              ok: false,
              erros: { whatsapp: mensagemWhatsappRepetido(outra.nome) },
            };
          }
        }
        await tx
          .update(pessoas)
          .set({
            nome: pessoa.nome,
            email: pessoa.email,
            whatsapp: pessoa.whatsapp,
            dataNascimento: pessoa.nascimento,
            instagram: pessoa.instagram,
            atualizadoEm: new Date(),
          })
          .where(eq(pessoas.id, pessoaId));
        if (responsavel) await ligarResponsavel(tx, pessoaId, responsavel);
        await tx
          .update(bolsistas)
          .set({ preferencia })
          .where(eq(bolsistas.pessoaId, pessoaId));
        return { ok: true, valor: null };
      }),
    ERROS_BANCO,
  );
}

/**
 * Cria uma versão nova do acordo de dias, vigente desde `vigenteDesde`.
 * As versões antigas ficam; na mesma data, a mais recente prevalece.
 */
export async function alterarDias(
  db: Banco,
  a: {
    pessoaId: string;
    dias: number[];
    vigenteDesde: string;
    feitoPor: string;
  },
  hoje: DataIso,
): Promise<Resultado<null>> {
  const erros: Record<string, string> = {};
  const dias = normalizarDias(a.dias);
  if (!dias) erros.dias = MENSAGEM_DIAS;
  const desde = a.vigenteDesde?.trim() ?? "";
  const erroData = erroDeData(desde, hoje);
  if (erroData) erros.vigenteDesde = erroData;
  if (!dias || Object.keys(erros).length > 0) return { ok: false, erros };

  return executarTraduzindo<null>(
    () =>
      transacaoComErros<null>(db, async (tx): Promise<Resultado<null>> => {
        if (!ehUuid(a.pessoaId))
          return { ok: false, erros: { _: MENSAGEM_NAO_BOLSISTA } };
        await travar(tx, a.pessoaId);
        if (!(await ehBolsista(tx, a.pessoaId))) {
          return { ok: false, erros: { _: MENSAGEM_NAO_BOLSISTA } };
        }
        const [vigente] = await tx
          .select({ dias: acordosBolsista.dias })
          .from(acordosBolsista)
          .where(
            and(
              eq(acordosBolsista.pessoaId, a.pessoaId),
              sql`${acordosBolsista.vigenteDesde} <= ${desde}`,
            ),
          )
          .orderBy(
            desc(acordosBolsista.vigenteDesde),
            desc(acordosBolsista.criadoEm),
          )
          .limit(1);
        if (
          vigente &&
          JSON.stringify(normalizarDias(vigente.dias)) === JSON.stringify(dias)
        ) {
          return {
            ok: false,
            erros: { dias: "Os dias são os mesmos de agora." },
          };
        }
        await tx.insert(acordosBolsista).values({
          pessoaId: a.pessoaId,
          dias,
          vigenteDesde: desde,
          criadoPor: a.feitoPor,
        });
        return { ok: true, valor: null };
      }),
    ERROS_BANCO,
  );
}

/** Ativa ou inativa a bolsa: atualiza o papel `bolsista` e registra a situação. */
export async function mudarSituacao(
  db: Banco,
  a: {
    pessoaId: string;
    tipo: "ativacao" | "inativacao";
    data: string;
    motivo?: string;
    feitoPor: string;
  },
  hoje: DataIso,
): Promise<Resultado<null>> {
  const data = a.data?.trim() ?? "";
  const erroData = erroDeData(data, hoje);
  if (erroData) return { ok: false, erros: { data: erroData } };
  const motivo = a.motivo?.trim() || null;

  return executarTraduzindo<null>(
    () =>
      transacaoComErros<null>(db, async (tx): Promise<Resultado<null>> => {
        if (!ehUuid(a.pessoaId))
          return { ok: false, erros: { _: MENSAGEM_NAO_BOLSISTA } };
        await travar(tx, a.pessoaId);
        if (!(await ehBolsista(tx, a.pessoaId))) {
          return { ok: false, erros: { _: MENSAGEM_NAO_BOLSISTA } };
        }
        const [ultima] = await tx
          .select({
            tipo: situacoesBolsista.tipo,
            data: situacoesBolsista.data,
          })
          .from(situacoesBolsista)
          .where(eq(situacoesBolsista.pessoaId, a.pessoaId))
          .orderBy(
            desc(situacoesBolsista.data),
            desc(situacoesBolsista.criadoEm),
          )
          .limit(1);
        if (ultima?.tipo === a.tipo) {
          return {
            ok: false,
            erros: {
              _:
                a.tipo === "ativacao"
                  ? "O bolsista já está ativo."
                  : "O bolsista já está inativo.",
            },
          };
        }
        if (ultima && data < ultima.data) {
          return {
            ok: false,
            erros: {
              data: `A data não pode ser antes da última mudança (${formatarDia(ultima.data)}).`,
            },
          };
        }
        await tx
          .update(pessoaPapeis)
          .set({ ativo: a.tipo === "ativacao" })
          .where(
            and(
              eq(pessoaPapeis.pessoaId, a.pessoaId),
              eq(pessoaPapeis.papel, "bolsista"),
            ),
          );
        await tx.insert(situacoesBolsista).values({
          pessoaId: a.pessoaId,
          tipo: a.tipo,
          data,
          motivo,
          criadoPor: a.feitoPor,
        });
        return { ok: true, valor: null };
      }),
    ERROS_BANCO,
  );
}
