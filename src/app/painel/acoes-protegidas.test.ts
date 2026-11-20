import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const RAIZ_PAINEL = join(process.cwd(), "src/app/painel");
const CHAMADA = "await exigirAdministracao();";

/** Todos os .ts/.tsx sob a pasta dada (menos testes), em qualquer profundidade. */
function acharFontes(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return acharFontes(caminho);
    return /\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

const MODULO_ACESSO = "@/servidor/auth/acesso";

function ehExportado(no: ts.Node): boolean {
  return (
    ts.canHaveModifiers(no) &&
    (ts.getModifiers(no) ?? []).some(
      (m) => m.kind === ts.SyntaxKind.ExportKeyword,
    )
  );
}

function ehAsync(no: ts.Node): boolean {
  return (
    ts.canHaveModifiers(no) &&
    (ts.getModifiers(no) ?? []).some(
      (m) => m.kind === ts.SyntaxKind.AsyncKeyword,
    )
  );
}

/** Confere se a primeira instrução do corpo é `await exigirAdministracao();`. */
function comecaPelaChecagem(corpo: ts.Block | ts.ConciseBody | undefined) {
  if (!corpo || !ts.isBlock(corpo)) return false;
  const primeira = corpo.statements[0];
  if (!primeira || !ts.isExpressionStatement(primeira)) return false;
  const e = primeira.expression;
  return (
    ts.isAwaitExpression(e) &&
    ts.isCallExpression(e.expression) &&
    e.expression.arguments.length === 0 &&
    ts.isIdentifier(e.expression.expression) &&
    e.expression.expression.text === "exigirAdministracao"
  );
}

/** O arquivo importa a função real, sem apelido, de `@/servidor/auth/acesso`? */
function importaExigirAdministracao(arquivo: ts.SourceFile): boolean {
  return arquivo.statements.some(
    (no) =>
      ts.isImportDeclaration(no) &&
      ts.isStringLiteral(no.moduleSpecifier) &&
      no.moduleSpecifier.text === MODULO_ACESSO &&
      !no.importClause?.isTypeOnly &&
      no.importClause?.namedBindings !== undefined &&
      ts.isNamedImports(no.importClause.namedBindings) &&
      no.importClause.namedBindings.elements.some(
        (el) =>
          !el.isTypeOnly &&
          el.name.text === "exigirAdministracao" &&
          el.propertyName === undefined,
      ),
  );
}

/** Há, no nível do arquivo, uma declaração própria chamada `exigirAdministracao`? */
function declaraExigirAdministracao(arquivo: ts.SourceFile): boolean {
  return arquivo.statements.some((no) => {
    if (
      (ts.isFunctionDeclaration(no) || ts.isClassDeclaration(no)) &&
      no.name?.text === "exigirAdministracao"
    )
      return true;
    return (
      ts.isVariableStatement(no) &&
      no.declarationList.declarations.some(
        (d) => d.name.getText() === "exigirAdministracao",
      )
    );
  });
}

function ehDiretivaUseServer(no: ts.Statement): boolean {
  return (
    ts.isExpressionStatement(no) &&
    ts.isStringLiteral(no.expression) &&
    no.expression.text === "use server"
  );
}

function lerFonte(nome: string, texto: string): ts.SourceFile {
  return ts.createSourceFile(
    nome,
    texto,
    ts.ScriptTarget.Latest,
    true,
    nome.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

/** Tem "use server" no topo do arquivo (como primeira instrução)? */
export function temUseServerNoTopo(texto: string): boolean {
  const primeira = lerFonte("f.ts", texto).statements[0];
  return primeira !== undefined && ehDiretivaUseServer(primeira);
}

/** Tem "use server" dentro do corpo de alguma função (action inline)? */
export function temUseServerInline(texto: string): boolean {
  let achou = false;
  const visitar = (no: ts.Node) => {
    if (
      (ts.isFunctionLike(no) || ts.isClassStaticBlockDeclaration(no)) &&
      "body" in no &&
      no.body &&
      ts.isBlock(no.body) &&
      no.body.statements.some(ehDiretivaUseServer)
    )
      achou = true;
    ts.forEachChild(no, visitar);
  };
  visitar(lerFonte("f.tsx", texto));
  return achou;
}

/**
 * Checa o texto de um arquivo de actions e devolve os problemas encontrados
 * (lista vazia = tudo certo): (a) começa com "use server", (b) importa
 * `exigirAdministracao` de `@/servidor/auth/acesso` e não declara outra com o
 * mesmo nome, (c) só exporta funções `async` (declaração ou `const` com
 * arrow/function; sem `export default` nem `export { x }`), (d) a primeira
 * instrução de cada uma é `await exigirAdministracao();`.
 */
export function checarAcoes(texto: string): string[] {
  const arquivo = lerFonte("acoes.ts", texto);
  const problemas: string[] = [];

  if (!temUseServerNoTopo(texto)) {
    problemas.push('O arquivo não começa com "use server".');
  }
  if (!importaExigirAdministracao(arquivo)) {
    problemas.push(`Falta importar exigirAdministracao de ${MODULO_ACESSO}.`);
  }
  if (declaraExigirAdministracao(arquivo)) {
    problemas.push("exigirAdministracao não pode ser declarada no arquivo.");
  }

  for (const no of arquivo.statements) {
    if (ts.isExportDeclaration(no) || ts.isExportAssignment(no)) {
      if (ts.isExportDeclaration(no) && no.isTypeOnly) continue;
      problemas.push(`Exportação indireta não permitida: ${no.getText()}`);
      continue;
    }
    if (!ehExportado(no)) continue;
    if (ts.isInterfaceDeclaration(no) || ts.isTypeAliasDeclaration(no))
      continue;

    if (ts.isFunctionDeclaration(no)) {
      const nome = no.name?.text ?? "(anônima)";
      if (
        (ts.getModifiers(no) ?? []).some(
          (m) => m.kind === ts.SyntaxKind.DefaultKeyword,
        )
      )
        problemas.push(`export default não permitido (${nome}).`);
      if (!ehAsync(no)) problemas.push(`${nome} não é async.`);
      if (!comecaPelaChecagem(no.body))
        problemas.push(`${nome} não começa por ${CHAMADA}`);
    } else if (ts.isVariableStatement(no)) {
      for (const d of no.declarationList.declarations) {
        const nome = d.name.getText();
        const f = d.initializer;
        if (f && (ts.isArrowFunction(f) || ts.isFunctionExpression(f))) {
          if (!ehAsync(f)) problemas.push(`${nome} não é async.`);
          if (!comecaPelaChecagem(f.body))
            problemas.push(`${nome} não começa por ${CHAMADA}`);
        } else {
          problemas.push(`${nome} é exportado e não é uma função async.`);
        }
      }
    } else {
      problemas.push(`Exportação não permitida: ${no.getText().slice(0, 40)}`);
    }
  }
  return problemas;
}

/** Problemas de um arquivo qualquer do painel (nome + texto). */
export function checarFontePainel(nome: string, texto: string): string[] {
  const problemas: string[] = [];
  if (temUseServerNoTopo(texto)) {
    if (!/(^|[\\/])acoes\.ts$/.test(nome))
      problemas.push('"use server" só é permitido em arquivos acoes.ts.');
    problemas.push(...checarAcoes(texto));
  }
  if (temUseServerInline(texto))
    problemas.push('"use server" dentro de função não é permitido no painel.');
  return problemas;
}

const IMPORTA =
  'import { exigirAdministracao } from "@/servidor/auth/acesso";\n';

describe("checarAcoes", () => {
  it("aprova um arquivo correto", () => {
    const texto = `"use server";
${IMPORTA}export type Estado = { a: string };
export async function salvar(estado: Estado) {
  await exigirAdministracao();
  return estado;
}
export const apagar = async () => {
  await exigirAdministracao();
};
function auxiliar() { return 1; }
`;
    expect(checarAcoes(texto)).toEqual([]);
  });

  const reprovados: Record<string, string> = {
    "sem use server": `${IMPORTA}export async function a() {\n await exigirAdministracao();\n}`,
    "função síncrona": `"use server";\n${IMPORTA}export function a() {\n await exigirAdministracao();\n}`,
    "arrow exportada sem async": `"use server";\n${IMPORTA}export const a = () => {\n await exigirAdministracao();\n};`,
    "arrow async sem checagem": `"use server";\n${IMPORTA}export const a = async () => {\n return 1;\n};`,
    "checagem sem await": `"use server";\n${IMPORTA}export async function a() {\n exigirAdministracao();\n}`,
    "checagem não é a primeira": `"use server";\n${IMPORTA}export async function a() {\n const x = 1;\n await exigirAdministracao();\n return x;\n}`,
    "export { x }": `"use server";\n${IMPORTA}async function a() {\n await exigirAdministracao();\n}\nexport { a };`,
    "export default": `"use server";\n${IMPORTA}export default async function a() {\n await exigirAdministracao();\n}`,
    "valor exportado": `"use server";\n${IMPORTA}export const valor = 3;`,
    "exigirAdministracao falsa e local": `"use server";\nasync function exigirAdministracao() {}\nexport async function a() {\n await exigirAdministracao();\n}`,
    "sem importar exigirAdministracao": `"use server";\nexport async function a() {\n await exigirAdministracao();\n}`,
    "importada de outro módulo": `"use server";\nimport { exigirAdministracao } from "./falsa";\nexport async function a() {\n await exigirAdministracao();\n}`,
    "importada com apelido": `"use server";\nimport { exigirPapel as exigirAdministracao } from "@/servidor/auth/acesso";\nexport async function a() {\n await exigirAdministracao();\n}`,
  };
  it.each(Object.entries(reprovados))("reprova: %s", (_nome, texto) => {
    expect(checarAcoes(texto).length).toBeGreaterThan(0);
  });
});

describe("checarFontePainel", () => {
  it("reprova use server no topo de arquivo que não é acoes.ts", () => {
    const texto = `"use server";\n${IMPORTA}export async function a() {\n await exigirAdministracao();\n}`;
    expect(checarFontePainel("x/actions.ts", texto)).not.toEqual([]);
    expect(checarFontePainel("x/acoes.tsx", texto)).not.toEqual([]);
    expect(checarFontePainel("x/acoes.ts", texto)).toEqual([]);
  });

  it("reprova use server inline em página ou componente", () => {
    const texto = `export default function Pagina() {
  async function enviar() {
    "use server";
    return 1;
  }
  return <form action={enviar} />;
}`;
    expect(checarFontePainel("x/page.tsx", texto)).not.toEqual([]);
  });

  it("aceita arquivo comum sem use server", () => {
    expect(checarFontePainel("x/page.tsx", "export const a = 1;")).toEqual([]);
  });
});

describe("arquivos do painel", () => {
  const arquivos = acharFontes(RAIZ_PAINEL);
  it.each(arquivos)("%s respeita as regras de actions", (caminho) => {
    expect(checarFontePainel(caminho, readFileSync(caminho, "utf8"))).toEqual(
      [],
    );
  });
});
