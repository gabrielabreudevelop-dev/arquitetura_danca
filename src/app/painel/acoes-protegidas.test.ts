import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const RAIZ_PAINEL = join(process.cwd(), "src/app/painel");
const CHAMADA = "await exigirAdministracao();";

/** Todos os `acoes.ts` sob a pasta dada, em qualquer profundidade. */
function acharAcoes(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return acharAcoes(caminho);
    return nome === "acoes.ts" ? [caminho] : [];
  });
}

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
  return (
    primeira !== undefined &&
    ts.isExpressionStatement(primeira) &&
    primeira.expression.getText() === "await exigirAdministracao()"
  );
}

/**
 * Checa o texto de um `acoes.ts` e devolve os problemas encontrados (lista
 * vazia = tudo certo): (a) começa com "use server", (b) toda função exportada
 * é `async`, (c) a primeira instrução de cada uma é a checagem de acesso.
 */
export function checarAcoes(texto: string): string[] {
  const arquivo = ts.createSourceFile(
    "acoes.ts",
    texto,
    ts.ScriptTarget.Latest,
    true,
  );
  const problemas: string[] = [];

  const primeira = arquivo.statements[0];
  if (
    !primeira ||
    !ts.isExpressionStatement(primeira) ||
    !ts.isStringLiteral(primeira.expression) ||
    primeira.expression.text !== "use server"
  ) {
    problemas.push('O arquivo não começa com "use server".');
  }

  for (const no of arquivo.statements) {
    if (ts.isExportDeclaration(no) || ts.isExportAssignment(no)) {
      if (ts.isExportDeclaration(no) && no.isTypeOnly) continue;
      problemas.push(`Reexportação não permitida: ${no.getText()}`);
      continue;
    }
    if (!ehExportado(no)) continue;
    if (ts.isInterfaceDeclaration(no) || ts.isTypeAliasDeclaration(no))
      continue;

    if (ts.isFunctionDeclaration(no)) {
      const nome = no.name?.text ?? "(anônima)";
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

describe("checarAcoes", () => {
  it("aprova um arquivo correto", () => {
    const texto = `"use server";
import { exigirAdministracao } from "@/servidor/auth/acesso";
export type Estado = { a: string };
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

  it("reprova um arquivo inválido em memória", () => {
    const texto = `import { exigirAdministracao } from "@/servidor/auth/acesso";
export function sincrona() {
  return 1;
}
export async function semChecagem() {
  const x = 1;
  await exigirAdministracao();
  return x;
}
export const valor = 3;
`;
    const problemas = checarAcoes(texto);
    expect(problemas).toContain('O arquivo não começa com "use server".');
    expect(problemas.some((p) => p.startsWith("sincrona não é async"))).toBe(
      true,
    );
    expect(problemas.some((p) => p.startsWith("sincrona não começa"))).toBe(
      true,
    );
    expect(problemas.some((p) => p.startsWith("semChecagem não começa"))).toBe(
      true,
    );
    expect(problemas.some((p) => p.startsWith("valor"))).toBe(true);
  });
});

describe("actions do painel", () => {
  const arquivos = acharAcoes(RAIZ_PAINEL);
  it.each(
    arquivos.length ? arquivos : [null],
  )("todas as funções exportadas de %s exigem administração", (caminho) => {
    if (caminho === null) return; // ainda não há `acoes.ts`
    expect(checarAcoes(readFileSync(caminho, "utf8"))).toEqual([]);
  });
});
