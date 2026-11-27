import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/** Componentes que enviam o formulário (o primeiro em ordem é o padrão do Enter). */
const ENVIOS = new Set([
  "BotaoPadrao",
  "BotaoEnviar",
  "BotaoPergunta",
  "BotaoTornarAluno",
]);

/**
 * Nome do primeiro elemento que envia o `<form>` devolvido pelo componente
 * (`FormularioAluno`, salvo outro nome), em ordem de código: um dos `ENVIOS`
 * ou um `<button type="submit">` (devolvido como "button").
 */
export function primeiroEnvio(
  texto: string,
  nomeDoComponente = "FormularioAluno",
): string | undefined {
  const arquivo = ts.createSourceFile(
    "formulario.tsx",
    texto,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const componente = arquivo.statements.find(
    (no): no is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(no) && no.name?.text === nomeDoComponente,
  );
  let formulario: ts.JsxElement | undefined;
  const acharForm = (no: ts.Node) => {
    if (
      !formulario &&
      ts.isJsxElement(no) &&
      no.openingElement.tagName.getText() === "form"
    )
      formulario = no;
    ts.forEachChild(no, acharForm);
  };
  if (componente) acharForm(componente);
  if (!formulario) return undefined;

  let primeiro: string | undefined;
  const visitar = (no: ts.Node) => {
    if (primeiro) return;
    if (ts.isJsxOpeningElement(no) || ts.isJsxSelfClosingElement(no)) {
      const nome = no.tagName.getText();
      if (ENVIOS.has(nome)) primeiro = nome;
      else if (
        nome === "button" &&
        no.attributes.properties.some(
          (a) =>
            ts.isJsxAttribute(a) &&
            a.name.getText() === "type" &&
            a.initializer?.getText() === '"submit"',
        )
      )
        primeiro = "button";
    }
    ts.forEachChild(no, visitar);
  };
  ts.forEachChild(formulario, visitar);
  return primeiro;
}

describe("primeiroEnvio", () => {
  it("acha o primeiro botão de envio do formulário", () => {
    const texto = `export function FormularioAluno() {
  return (
    <form>
      <input />
      {x && <BotaoPergunta nome="a" valor="1">Sim</BotaoPergunta>}
      <BotaoEnviar carregando="…">Salvar</BotaoEnviar>
    </form>
  );
}`;
    expect(primeiroEnvio(texto)).toBe("BotaoPergunta");
  });
});

describe("formulário de aluno", () => {
  it("Enter num campo envia o botão padrão, nunca uma resposta de pergunta", () => {
    const texto = readFileSync(
      join(process.cwd(), "src/app/painel/alunos/formulario.tsx"),
      "utf8",
    );
    expect(primeiroEnvio(texto)).toBe("BotaoPadrao");
  });
});

describe("formulário de bolsista", () => {
  it("Enter num campo envia o botão padrão, nunca uma resposta de pergunta", () => {
    const texto = readFileSync(
      join(process.cwd(), "src/app/painel/bolsistas/formulario.tsx"),
      "utf8",
    );
    expect(primeiroEnvio(texto, "FormularioBolsista")).toBe("BotaoPadrao");
  });
});
