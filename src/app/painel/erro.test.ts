import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import ErroPainel from "./error";

it("estado de erro do painel: título, Tentar de novo e nada do erro na tela (R16)", () => {
  const erro = Object.assign(
    new Error("Failed query: insert … params: Ana Souza,+5527999990000"),
    { digest: "123abc" },
  );
  const html = renderToStaticMarkup(
    createElement(ErroPainel, { error: erro, retry: () => {} }),
  );
  expect(html).toContain("Não foi possível carregar esta tela.");
  expect(html).toContain("Tentar de novo");
  expect(html).not.toContain("Ana Souza");
  expect(html).not.toContain("Failed query");
  expect(html).not.toContain("123abc");
});
