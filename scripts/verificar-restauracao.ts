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

const MSG_REGISTRO = "registro de consentimento não pode ser alterado";
const MSG_CHAVE = "chave do tipo de consentimento não pode ser alterada";

// tgtype: 1 = por linha, 2 = BEFORE, 8 = DELETE, 16 = UPDATE, 32 = TRUNCATE.
const POR_LINHA_ANTES_UPDATE_DELETE = 1 | 2 | 8 | 16;
const POR_LINHA_ANTES_UPDATE = 1 | 2 | 16;
const POR_COMANDO_ANTES_TRUNCATE = 2 | 32;

const GATILHOS = [
  {
    tabela: "registros_consentimento",
    nome: "registros_consentimento_imutavel",
    funcao: "bloquear_alteracao",
    tipo: POR_LINHA_ANTES_UPDATE_DELETE,
  },
  {
    tabela: "registros_consentimento",
    nome: "registros_consentimento_sem_truncate",
    funcao: "bloquear_alteracao",
    tipo: POR_COMANDO_ANTES_TRUNCATE,
  },
  {
    tabela: "textos_consentimento",
    nome: "textos_consentimento_imutavel",
    funcao: "bloquear_alteracao",
    tipo: POR_LINHA_ANTES_UPDATE_DELETE,
  },
  {
    tabela: "textos_consentimento",
    nome: "textos_consentimento_sem_truncate",
    funcao: "bloquear_alteracao",
    tipo: POR_COMANDO_ANTES_TRUNCATE,
  },
  {
    tabela: "tipos_consentimento",
    nome: "tipos_consentimento_chave_imutavel",
    funcao: "bloquear_troca_chave_consentimento",
    tipo: POR_LINHA_ANTES_UPDATE,
  },
];

// Ordem importa: se um gatilho falhar em bloquear, o efeito fica só dentro do
// savepoint desfeito; TRUNCATE por último para não esvaziar as linhas das outras.
// CASCADE: textos_consentimento é referenciada por FK, e o Postgres checa isso
// antes de disparar os gatilhos.
const SONDAS = [
  {
    gatilho: "registros_consentimento_imutavel",
    descricao: "UPDATE em registros_consentimento",
    sql: "update registros_consentimento set contato = 'sonda'",
    mensagem: MSG_REGISTRO,
  },
  {
    gatilho: "textos_consentimento_imutavel",
    descricao: "UPDATE em textos_consentimento",
    sql: "update textos_consentimento set texto = texto || ' sonda' where id = $1",
    mensagem: MSG_REGISTRO,
    textoSonda: true,
  },
  {
    gatilho: "tipos_consentimento_chave_imutavel",
    descricao: "UPDATE da chave em tipos_consentimento",
    sql: "update tipos_consentimento set chave = chave || '_sonda' where id = $1",
    mensagem: MSG_CHAVE,
    tipoSonda: true,
  },
  {
    gatilho: "registros_consentimento_imutavel",
    descricao: "DELETE em registros_consentimento",
    sql: "delete from registros_consentimento",
    mensagem: MSG_REGISTRO,
  },
  {
    gatilho: "textos_consentimento_imutavel",
    descricao: "DELETE em textos_consentimento",
    sql: "delete from textos_consentimento where id = $1",
    mensagem: MSG_REGISTRO,
    textoSonda: true,
  },
  {
    gatilho: "registros_consentimento_sem_truncate",
    descricao: "TRUNCATE em registros_consentimento",
    sql: "truncate registros_consentimento cascade",
    mensagem: MSG_REGISTRO,
  },
  {
    gatilho: "textos_consentimento_sem_truncate",
    descricao: "TRUNCATE em textos_consentimento",
    sql: "truncate textos_consentimento cascade",
    mensagem: MSG_REGISTRO,
  },
] as {
  gatilho: string;
  descricao: string;
  sql: string;
  mensagem: string;
  textoSonda?: boolean;
  tipoSonda?: boolean;
}[];

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

/** Devolve os gatilhos corretos e ativos (o restante vira problema). */
async function conferirGatilhos(
  cliente: Client,
  problemas: string[],
): Promise<Set<string>> {
  const { rows } = await cliente.query(
    `select c.relname as tabela, t.tgname as nome, t.tgenabled as estado,
            t.tgtype::int as tipo, p.proname as funcao
       from pg_trigger t
       join pg_class c on c.oid = t.tgrelid
       join pg_namespace n on n.oid = c.relnamespace
       join pg_proc p on p.oid = t.tgfoid
       join pg_namespace np on np.oid = p.pronamespace
      where not t.tgisinternal and n.nspname = 'public' and np.nspname = 'public'`,
  );
  const encontrados = new Map(
    rows.map((r) => {
      const linha = r as {
        tabela: string;
        nome: string;
        estado: string;
        tipo: number;
        funcao: string;
      };
      return [`${linha.tabela}.${linha.nome}`, linha] as const;
    }),
  );
  const corretos = new Set<string>();
  for (const { tabela, nome, funcao, tipo } of GATILHOS) {
    const real = encontrados.get(`${tabela}.${nome}`);
    if (!real) {
      problemas.push(
        `Falta o gatilho de imutabilidade: ${nome} (tabela ${tabela})`,
      );
    } else if (real.estado !== "O" && real.estado !== "A") {
      problemas.push(
        `O gatilho de imutabilidade ${nome} (tabela ${tabela}) está desativado ou só dispara em modo de réplica.`,
      );
    } else if (real.funcao !== funcao || real.tipo !== tipo) {
      problemas.push(
        `O gatilho de imutabilidade ${nome} (tabela ${tabela}) está diferente do esperado (função ${real.funcao}, tgtype ${real.tipo}; esperado ${funcao}, tgtype ${tipo}).`,
      );
    } else {
      corretos.add(nome);
    }
  }
  return corretos;
}

async function tentar(
  cliente: Client,
  sql: string,
  parametros: unknown[],
): Promise<string | null> {
  await cliente.query("savepoint sonda");
  try {
    await cliente.query(sql, parametros);
    return null;
  } catch (erro) {
    return mensagemDe(erro);
  } finally {
    await cliente.query("rollback to savepoint sonda");
  }
}

/**
 * Sondas reais dentro de uma transação que é sempre desfeita: cria uma pessoa,
 * um texto e um registro descartáveis e tenta UPDATE, DELETE e TRUNCATE. Cada
 * tentativa deve ser recusada com a mensagem do gatilho. Só sonda os gatilhos
 * que passaram na conferência estática (os outros já viraram problema).
 */
async function sondarBloqueios(
  cliente: Client,
  corretos: Set<string>,
  problemas: string[],
): Promise<void> {
  const sondas = SONDAS.filter((s) => corretos.has(s.gatilho));
  if (sondas.length === 0) return;

  await cliente.query("begin");
  try {
    await cliente.query("set local lock_timeout = '5s'");
    let textoId: string;
    let tipoId: string;
    try {
      const tipo = await cliente.query(
        "select id from tipos_consentimento order by chave limit 1",
      );
      if (tipo.rows.length === 0) {
        problemas.push(
          "Sondas de imutabilidade não rodaram: tipos_consentimento está vazia.",
        );
        return;
      }
      tipoId = (tipo.rows[0] as { id: string }).id;
      const pessoa = await cliente.query(
        "insert into pessoas (nome) values ('sonda de restauração') returning id",
      );
      const pessoaId = (pessoa.rows[0] as { id: string }).id;
      const texto = await cliente.query(
        `insert into textos_consentimento (tipo_id, versao, texto, vigente_desde)
         values ($1, (select coalesce(max(versao), 0) + 1 from textos_consentimento where tipo_id = $1), 'sonda', now())
         returning id`,
        [tipoId],
      );
      textoId = (texto.rows[0] as { id: string }).id;
      await cliente.query(
        `insert into registros_consentimento
           (tipo_id, texto_id, titular_id, concedente_id, acao, canal, origem)
         values ($1, $2, $3, $3, 'aceite', 'plataforma', 'pagina_preferencias')`,
        [tipoId, textoId, pessoaId],
      );
    } catch (erro) {
      problemas.push(
        `Sondas de imutabilidade não rodaram: falha ao preparar os dados de teste (${mensagemDe(erro)}).`,
      );
      return;
    }

    for (const sonda of sondas) {
      const parametros = sonda.textoSonda
        ? [textoId]
        : sonda.tipoSonda
          ? [tipoId]
          : [];
      const mensagem = await tentar(cliente, sonda.sql, parametros);
      if (mensagem === null) {
        problemas.push(
          `O gatilho ${sonda.gatilho} não bloqueou: ${sonda.descricao}.`,
        );
      } else if (!mensagem.includes(sonda.mensagem)) {
        problemas.push(
          `Sonda (${sonda.descricao}) falhou por outro motivo: ${mensagem}`,
        );
      }
    }
  } finally {
    try {
      await cliente.query("rollback");
    } catch {
      // A conexão já caiu; o que importa é não esconder o problema original.
    }
  }
}

/**
 * Confere um banco restaurado de backup sem alterá-lo: histórico de migrações
 * igual ao da pasta `drizzle/` (relativa ao diretório de trabalho), os seis
 * tipos de consentimento, os gatilhos de imutabilidade corretos e ativos e
 * sondas reais (desfeitas) de UPDATE, DELETE e TRUNCATE.
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
    const corretos = await conferirGatilhos(cliente, problemas);
    await sondarBloqueios(cliente, corretos, problemas);
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
