/**
 * Pessoa de contato (quem recebe as mensagens do aluno ou do bolsista) e a
 * carga do último contato e dos bloqueios, compartilhadas pelas cargas de
 * alunos e de bolsistas.
 */
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Executor } from "../alunos/cadastro";
import { bloqueiosContato, contatos, pessoas } from "../banco/esquema";

/** Quem recebe as mensagens do aluno. */
export type PessoaDeContato = {
  pessoaId: string;
  nome: string;
  whatsapp: string | null;
  ehResponsavel: boolean;
  /** Adulto sem WhatsApp próprio, contatado pelo número do responsável. */
  usandoNumeroDoResponsavel: boolean;
  naoQuerContato: boolean;
};

/** Contato mais recente feito à pessoa de contato (por qualquer aluno dela). */
export type UltimoContato = {
  grupoId: string;
  em: Date;
  /** Nome de quem fez o contato. */
  por: string;
  resultado: string | null;
};

export type ResponsavelDeContato = {
  id: string;
  nome: string;
  whatsapp: string | null;
  email: string | null;
};

/** Listas de contato de cada tipo (valores do enum `lista_contato`). */
export const LISTAS_DE_ALUNO = ["vence_em_breve", "vencido", "ficha"] as const;
export const LISTAS_DE_BOLSISTA = [
  "bolsista_ausente",
  "ficha_bolsista",
] as const;
export type TipoDeLista = "aluno" | "bolsista";

/**
 * Adulto com WhatsApp: ele. Menor: o responsável. Adulto sem WhatsApp, com
 * responsável que tem: o responsável. Sem nenhum desses: ele, sem número
 * (um menor nunca é contatado pelo próprio número).
 */
export function pessoaDeContato(
  aluno: { id: string; nome: string; whatsapp: string | null; menor: boolean },
  responsavel: ResponsavelDeContato | null,
): Omit<PessoaDeContato, "naoQuerContato"> {
  if (!aluno.menor && aluno.whatsapp) {
    return {
      pessoaId: aluno.id,
      nome: aluno.nome,
      whatsapp: aluno.whatsapp,
      ehResponsavel: false,
      usandoNumeroDoResponsavel: false,
    };
  }
  if (responsavel && (aluno.menor || responsavel.whatsapp)) {
    return {
      pessoaId: responsavel.id,
      nome: responsavel.nome,
      whatsapp: responsavel.whatsapp,
      ehResponsavel: true,
      usandoNumeroDoResponsavel: !aluno.menor,
    };
  }
  return {
    pessoaId: aluno.id,
    nome: aluno.nome,
    whatsapp: null,
    ehResponsavel: false,
    usandoNumeroDoResponsavel: false,
  };
}

export type ContatosCarregados = {
  /** Pessoas de contato com bloqueio aberto ("não quer contato"). */
  bloqueados: Set<string>;
  /** Último contato de listas do mesmo tipo pedido, por pessoa de contato. */
  ultimoPorPessoa: Map<string, UltimoContato>;
  /** Último contato de qualquer tipo de lista, por pessoa de contato. */
  recentePorPessoa: Map<string, UltimoContato>;
};

/**
 * Bloqueios abertos e últimos contatos das pessoas de contato (todas se
 * `pessoaIds` for nulo), com uma consulta em cada tabela.
 */
export async function carregarContatos(
  db: Executor,
  pessoaIds: string[] | null,
  tipo: TipoDeLista,
): Promise<ContatosCarregados> {
  const daPessoa = (coluna: Parameters<typeof inArray>[0]) =>
    pessoaIds ? inArray(coluna, pessoaIds) : undefined;

  const bloqueados = new Set(
    (
      await db
        .select({ pessoaId: bloqueiosContato.pessoaId })
        .from(bloqueiosContato)
        .where(
          and(
            isNull(bloqueiosContato.desfeitoEm),
            daPessoa(bloqueiosContato.pessoaId),
          ),
        )
    ).map((b) => b.pessoaId),
  );

  // Um último contato por pessoa e por tipo de lista, numa consulta só.
  // Valores literais (não parâmetros) para o DISTINCT ON casar com o ORDER BY.
  const literais = LISTAS_DE_BOLSISTA.map((l) => `'${l}'`).join(", ");
  const ehDeBolsista = sql<boolean>`(${contatos.lista}::text in (${sql.raw(literais)}))`;
  const autor = alias(pessoas, "autor");
  const linhas = await db
    .selectDistinctOn([contatos.pessoaContatoId, ehDeBolsista], {
      pessoaId: contatos.pessoaContatoId,
      deBolsista: ehDeBolsista.as("de_bolsista"),
      grupoId: contatos.grupoId,
      em: contatos.criadoEm,
      por: autor.nome,
      resultado: contatos.resultado,
    })
    .from(contatos)
    .innerJoin(autor, eq(autor.id, contatos.criadoPor))
    .where(daPessoa(contatos.pessoaContatoId))
    .orderBy(
      asc(contatos.pessoaContatoId),
      asc(ehDeBolsista),
      desc(contatos.criadoEm),
      desc(contatos.id),
    );

  const ultimoPorPessoa = new Map<string, UltimoContato>();
  const recentePorPessoa = new Map<string, UltimoContato>();
  for (const l of linhas) {
    const contato: UltimoContato = {
      grupoId: l.grupoId,
      em: l.em,
      por: l.por,
      resultado: l.resultado,
    };
    if (l.deBolsista === (tipo === "bolsista")) {
      ultimoPorPessoa.set(l.pessoaId, contato);
    }
    const atual = recentePorPessoa.get(l.pessoaId);
    if (!atual || contato.em.getTime() > atual.em.getTime()) {
      recentePorPessoa.set(l.pessoaId, contato);
    }
  }
  return { bloqueados, ultimoPorPessoa, recentePorPessoa };
}
