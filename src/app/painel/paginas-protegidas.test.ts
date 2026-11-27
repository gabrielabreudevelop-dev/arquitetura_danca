import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/** Pastas do M2 e de bolsistas: toda página delas é só da administração. */
const PASTAS = [
  "alunos",
  "contatos",
  "configuracoes",
  "vitrine",
  "bolsistas",
  "chamada",
].map((p) => join(process.cwd(), "src/app/painel", p));
const CHAMADA = "await exigirAdministracao();";
const MODULO_ACESSO = "@/servidor/auth/acesso";

/** Todos os page.tsx sob a pasta dada, em qualquer profundidade. */
function acharPaginas(pasta: string): string[] {
  if (!existsSync(pasta)) return [];
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return acharPaginas(caminho);
    return nome === "page.tsx" ? [caminho] : [];
  });
}

function lerFonte(texto: string): ts.SourceFile {
  return ts.createSourceFile(
    "page.tsx",
    texto,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

function temModificador(no: ts.Node, tipo: ts.SyntaxKind): boolean {
  return (
    ts.canHaveModifiers(no) &&
    (ts.getModifiers(no) ?? []).some((m) => m.kind === tipo)
  );
}

/** Mesma regra do teste das actions: a primeira instrução é `await exigirAdministracao();`. */
function comecaPelaChecagem(corpo: ts.ConciseBody | undefined): boolean {
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

/** Corpo do componente exportado por padrão (`export default function` ou `export default Nome`). */
function corpoDoPadrao(arquivo: ts.SourceFile): ts.ConciseBody | undefined {
  for (const no of arquivo.statements) {
    if (
      ts.isFunctionDeclaration(no) &&
      temModificador(no, ts.SyntaxKind.ExportKeyword) &&
      temModificador(no, ts.SyntaxKind.DefaultKeyword)
    )
      return no.body;
    if (ts.isExportAssignment(no) && !no.isExportEquals) {
      const e = no.expression;
      if (ts.isArrowFunction(e) || ts.isFunctionExpression(e)) return e.body;
      if (ts.isIdentifier(e)) {
        for (const outro of arquivo.statements) {
          if (ts.isFunctionDeclaration(outro) && outro.name?.text === e.text)
            return outro.body;
          if (ts.isVariableStatement(outro)) {
            for (const d of outro.declarationList.declarations) {
              const f = d.initializer;
              if (
                d.name.getText() === e.text &&
                f &&
                (ts.isArrowFunction(f) || ts.isFunctionExpression(f))
              )
                return f.body;
            }
          }
        }
      }
    }
  }
  return undefined;
}

/** Problemas de uma página do M2 (lista vazia = tudo certo). */
export function checarPagina(texto: string): string[] {
  const arquivo = lerFonte(texto);
  const problemas: string[] = [];
  if (!importaExigirAdministracao(arquivo))
    problemas.push(`Falta importar exigirAdministracao de ${MODULO_ACESSO}.`);
  const corpo = corpoDoPadrao(arquivo);
  if (!corpo) problemas.push("Não há componente exportado por padrão.");
  else if (!comecaPelaChecagem(corpo))
    problemas.push(`O componente não começa por ${CHAMADA}`);
  return problemas;
}

const IMPORTA = `import { exigirAdministracao } from "${MODULO_ACESSO}";\n`;

describe("checarPagina", () => {
  it("aprova página que começa pela checagem", () => {
    const texto = `${IMPORTA}export default async function Pagina() {
  await exigirAdministracao();
  return <main />;
}`;
    expect(checarPagina(texto)).toEqual([]);
  });

  it("aprova export default de função declarada antes", () => {
    const texto = `${IMPORTA}async function Pagina() {
  await exigirAdministracao();
  return <main />;
}
export default Pagina;`;
    expect(checarPagina(texto)).toEqual([]);
  });

  const reprovados: Record<string, string> = {
    "sem a chamada": `${IMPORTA}export default async function Pagina() {\n  return <main />;\n}`,
    "chamada depois de outra instrução": `${IMPORTA}export default async function Pagina({ params }) {\n  const { id } = await params;\n  await exigirAdministracao();\n  return <main>{id}</main>;\n}`,
    "chamada sem await": `${IMPORTA}export default async function Pagina() {\n  exigirAdministracao();\n  return <main />;\n}`,
    "exigirPapel no lugar": `import { exigirPapel } from "${MODULO_ACESSO}";\nexport default async function Pagina() {\n  await exigirPapel(["atendente"]);\n  return <main />;\n}`,
    "importada de outro módulo": `import { exigirAdministracao } from "./falsa";\nexport default async function Pagina() {\n  await exigirAdministracao();\n  return <main />;\n}`,
    "sem export default": `${IMPORTA}export async function Pagina() {\n  await exigirAdministracao();\n  return <main />;\n}`,
  };
  it.each(Object.entries(reprovados))("reprova: %s", (_nome, texto) => {
    expect(checarPagina(texto).length).toBeGreaterThan(0);
  });
});

describe("páginas do M2", () => {
  const paginas = PASTAS.flatMap(acharPaginas);

  it("existem páginas em alunos, configuracoes, vitrine, bolsistas e chamada", () => {
    for (const pasta of [
      "alunos",
      "configuracoes",
      "vitrine",
      "bolsistas",
      "chamada",
    ]) {
      expect(paginas.some((p) => p.includes(`/painel/${pasta}/`))).toBe(true);
    }
  });

  it.each(paginas)("%s começa por await exigirAdministracao()", (caminho) => {
    expect(checarPagina(readFileSync(caminho, "utf8"))).toEqual([]);
  });
});
