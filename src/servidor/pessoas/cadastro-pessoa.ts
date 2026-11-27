import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { type DataIso, ehDataIso, ehMenor } from "../alunos/datas";
import type { Banco } from "../banco/cliente";
import { pessoaPapeis, pessoas, responsabilidades } from "../banco/esquema";
import { ehUuid, erroSemDadosPessoais } from "../cadastros/comum";
import { errosDeZod, type Resultado } from "../cadastros/resultado";
import {
  normalizarEmail,
  normalizarInstagram,
  normalizarWhatsapp,
} from "./normalizar";

/** O `Banco` ou a transação aberta por `db.transaction`. */
type Transacao = Parameters<Parameters<Banco["transaction"]>[0]>[0];
export type Executor = Banco | Transacao;

const MENSAGEM_WHATSAPP = "WhatsApp inválido. Use DDD e número.";
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

export const ERROS_BANCO = {
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

export type DadosPessoa = {
  nome: string;
  nascimento: string;
  whatsapp?: string;
  email?: string;
  instagram?: string;
  responsavel?: DadosResponsavel;
  confirmarWhatsappRepetido?: boolean;
};
/** Nome usado pelo cadastro de alunos. */
export type DadosAluno = DadosPessoa;

export type ContatoLimpo = {
  nome: string;
  whatsapp: string | null;
  email: string | null;
};

export type ResponsavelLimpo =
  | { tipo: "pessoa"; pessoaId: string }
  | ({ tipo: "novo"; explicito: boolean } & ContatoLimpo);

export type PessoaLimpa = {
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

export function limparEmail(
  bruto: string | undefined,
  campo: string,
  erros: Record<string, string>,
): string | null {
  const email = bruto?.trim() ? normalizarEmail(bruto) : null;
  if (email && !REGEX_EMAIL.test(email))
    erros[campo] = "Informe um e-mail válido.";
  return email;
}

export function limparWhatsapp(
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

/** Valida os dados da própria pessoa (nome, nascimento, contatos). */
export function limparPessoa(
  dados: DadosPessoa,
  hoje: DataIso,
): { erros: Record<string, string>; valor?: PessoaLimpa } {
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
export function limparResponsavel(
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

export async function pessoaPorEmail(
  db: Executor,
  email: string,
  exceto?: string,
) {
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

export async function pessoasPorWhatsapp(
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

export async function existePessoa(db: Executor, id: string) {
  const [p] = await db
    .select({ id: pessoas.id })
    .from(pessoas)
    .where(eq(pessoas.id, id));
  return Boolean(p);
}

/** Lançada dentro da transação para desfazê-la e devolver erros de formulário. */
export class ErrosDeFormulario extends Error {
  constructor(readonly erros: Record<string, string>) {
    super("Erros de formulário");
  }
}

/** Transação cujo `throw new ErrosDeFormulario(...)` vira `{ ok: false, erros }`. */
export async function transacaoComErros<T>(
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
export async function darPapelResponsavel(tx: Executor, pessoaId: string) {
  await tx
    .insert(pessoaPapeis)
    .values({ pessoaId, papel: "responsavel", ativo: true })
    .onConflictDoUpdate({
      target: [pessoaPapeis.pessoaId, pessoaPapeis.papel],
      set: { ativo: true },
    });
}

/** Grava (ou reaproveita) o responsável e o liga ao aluno, trocando a ligação anterior. */
export async function ligarResponsavel(
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

/** Trava a linha da pessoa até o fim da transação. */
export async function travar(tx: Executor, pessoaId: string) {
  await tx
    .select({ id: pessoas.id })
    .from(pessoas)
    .where(eq(pessoas.id, pessoaId))
    .for("update");
}

/** Procura a pessoa a quem um responsável "novo" provavelmente já corresponde (e-mail igual ou único WhatsApp igual). */
export async function procurarResponsavelExistente(
  tx: Executor,
  responsavel: ResponsavelLimpo | null,
): Promise<{ id: string; nome: string } | undefined> {
  if (responsavel?.tipo !== "novo" || responsavel.explicito) return undefined;
  let achada: { id: string; nome: string } | undefined;
  if (responsavel.email) achada = await pessoaPorEmail(tx, responsavel.email);
  if (!achada && responsavel.whatsapp) {
    const lista = await pessoasPorWhatsapp(tx, responsavel.whatsapp);
    if (lista.length === 1) achada = lista[0];
  }
  return achada;
}

/**
 * Grava os dados da pessoa (já validados) dentro da transação: confere e-mail e
 * WhatsApp de outra pessoa, exige responsável para menor sem ligação, atualiza
 * a pessoa e troca a ligação com o responsável só se mudou.
 */
export async function atualizarDadosPessoa(
  tx: Executor,
  pessoaId: string,
  pessoa: PessoaLimpa,
  responsavel: ResponsavelLimpo | null,
  confirmarWhatsappRepetido: boolean | undefined,
): Promise<Resultado<null>> {
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
    !confirmarWhatsappRepetido
  ) {
    const [outra] = await pessoasPorWhatsapp(tx, pessoa.whatsapp, pessoaId);
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
    .where(eq(responsabilidades.alunoId, pessoaId));
  const mudaResponsavel =
    responsavel !== null &&
    !(
      responsavel.tipo === "pessoa" &&
      ligacoes.some((l) => l.responsavelId === responsavel.pessoaId)
    );
  if (pessoa.menor && ligacoes.length === 0 && !responsavel) {
    return { ok: false, erros: { responsavel: "Informe o responsável." } };
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
  if (responsavel && mudaResponsavel) {
    await ligarResponsavel(tx, pessoaId, responsavel);
  }
  return { ok: true, valor: null };
}
