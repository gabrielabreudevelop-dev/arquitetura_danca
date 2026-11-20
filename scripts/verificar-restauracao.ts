import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { Client } from "pg";

export type ResultadoVerificacao = { ok: boolean; problemas: string[] };

const TIPOS_CONSENTIMENTO = [
  "termos_uso",
  "politica_privacidade",
  "whatsapp_servico",
  "whatsapp_novidades",
  "lista_quem_vai",
  "uso_imagem",
];

const GATILHOS = [
  {
    tabela: "registros_consentimento",
    nome: "registros_consentimento_imutavel",
  },
  {
    tabela: "registros_consentimento",
    nome: "registros_consentimento_sem_truncate",
  },
  { tabela: "textos_consentimento", nome: "textos_consentimento_imutavel" },
  { tabela: "textos_consentimento", nome: "textos_consentimento_sem_truncate" },
  { tabela: "tipos_consentimento", nome: "tipos_consentimento_chave_imutavel" },
];

/** Gatilhos de TRUNCATE: dá para sondá-los sem depender de haver linhas. */
const SONDAS_TRUNCATE = ["registros_consentimento", "textos_consentimento"];

function mensagemDe(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

async function conferirMigracoes(
  cliente: Client,
  pastaMigracoes: string,
  problemas: string[],
): Promise<void> {
  const diario = JSON.parse(
    readFileSync(`${pastaMigracoes}/meta/_journal.json`, "utf8"),
  ) as { entries: unknown[] };
  const esperadas = diario.entries.length;
  try {
    const { rows } = await cliente.query(
      "select count(*)::int as n from drizzle.__drizzle_migrations",
    );
    const aplicadas = (rows[0] as { n: number }).n;
    if (aplicadas !== esperadas) {
      problemas.push(
        `Histórico de migrações não bate: o banco tem ${aplicadas} migrações aplicadas e a pasta ${pastaMigracoes}/ tem ${esperadas}.`,
      );
    }
  } catch (erro) {
    problemas.push(
      `Não foi possível ler o histórico de migrações (drizzle.__drizzle_migrations): ${mensagemDe(erro)}`,
    );
  }
}

async function conferirTipos(
  cliente: Client,
  problemas: string[],
): Promise<void> {
  try {
    const { rows } = await cliente.query(
      "select chave from tipos_consentimento",
    );
    const existentes = new Set(rows.map((r) => (r as { chave: string }).chave));
    for (const chave of TIPOS_CONSENTIMENTO) {
      if (!existentes.has(chave)) {
        problemas.push(`Tipo de consentimento ausente: ${chave}`);
      }
    }
  } catch (erro) {
    problemas.push(
      `Não foi possível ler tipos_consentimento: ${mensagemDe(erro)}`,
    );
  }
}

/** Devolve os gatilhos que existem e estão ativos (o restante vira problema). */
async function conferirGatilhos(
  cliente: Client,
  problemas: string[],
): Promise<Set<string>> {
  const { rows } = await cliente.query(
    `select c.relname as tabela, t.tgname as nome, t.tgenabled <> 'D' as ativo
       from pg_trigger t
       join pg_class c on c.oid = t.tgrelid
      where not t.tgisinternal`,
  );
  const encontrados = new Map(
    rows.map((r) => {
      const { tabela, nome, ativo } = r as {
        tabela: string;
        nome: string;
        ativo: boolean;
      };
      return [`${tabela}.${nome}`, ativo] as const;
    }),
  );
  const ativos = new Set<string>();
  for (const { tabela, nome } of GATILHOS) {
    const ativo = encontrados.get(`${tabela}.${nome}`);
    if (ativo === undefined) {
      problemas.push(
        `Falta o gatilho de imutabilidade: ${nome} (tabela ${tabela})`,
      );
    } else if (!ativo) {
      problemas.push(
        `Está desativado o gatilho de imutabilidade: ${nome} (tabela ${tabela})`,
      );
    } else {
      ativos.add(nome);
    }
  }
  return ativos;
}

/**
 * Sonda real: tenta um TRUNCATE dentro de uma transação que é sempre desfeita.
 * Se o gatilho funciona, o Postgres recusa com a mensagem de consentimento.
 */
async function sondarTruncate(
  cliente: Client,
  tabela: string,
  problemas: string[],
): Promise<void> {
  await cliente.query("begin");
  try {
    // CASCADE: textos_consentimento é referenciada por FK, e o Postgres checa
    // isso antes de disparar os gatilhos. Tudo é desfeito no rollback.
    await cliente.query(`truncate ${tabela} cascade`);
    problemas.push(
      `O gatilho de imutabilidade não bloqueou TRUNCATE em ${tabela}.`,
    );
  } catch (erro) {
    if (
      !mensagemDe(erro).includes(
        "registro de consentimento não pode ser alterado",
      )
    ) {
      problemas.push(
        `Sonda de TRUNCATE em ${tabela} falhou por outro motivo: ${mensagemDe(erro)}`,
      );
    }
  } finally {
    await cliente.query("rollback");
  }
}

/**
 * Confere um banco restaurado de backup sem alterá-lo: histórico de migrações
 * igual ao da pasta `drizzle/` (relativa ao diretório de trabalho), os seis
 * tipos de consentimento e os gatilhos de imutabilidade ativos.
 */
export async function verificarRestauracao(
  url: string,
  pastaMigracoes = "drizzle",
): Promise<ResultadoVerificacao> {
  const problemas: string[] = [];
  const cliente = new Client({ connectionString: url });
  await cliente.connect();
  try {
    await conferirMigracoes(cliente, pastaMigracoes, problemas);
    await conferirTipos(cliente, problemas);
    const ativos = await conferirGatilhos(cliente, problemas);
    for (const tabela of SONDAS_TRUNCATE) {
      if (ativos.has(`${tabela}_sem_truncate`)) {
        await sondarTruncate(cliente, tabela, problemas);
      }
    }
  } finally {
    await cliente.end();
  }
  return { ok: problemas.length === 0, problemas };
}

async function principal(): Promise<void> {
  // `pnpm backup:verificar -- <url>` pode repassar o "--" ao script.
  const url = process.argv.slice(2).find((a) => a !== "--");
  if (!url) {
    console.error("Uso: pnpm backup:verificar -- <url-do-banco-restaurado>");
    process.exit(2);
  }
  try {
    const { ok, problemas } = await verificarRestauracao(url);
    if (ok) {
      console.log("Restauração verificada: nenhum problema encontrado.");
      return;
    }
    for (const problema of problemas) console.error(problema);
    process.exit(1);
  } catch (erro) {
    console.error(`Não foi possível verificar o banco: ${mensagemDe(erro)}`);
    process.exit(1);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await principal();
}
