import {
  Children,
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { describe, expect, it } from "vitest";
import { Campo } from "./campo";

/** Acha o primeiro elemento do tipo dado na árvore devolvida pelo componente. */
function acharElemento(no: ReactNode, tipo: string): ReactElement | null {
  let achado: ReactElement | null = null;
  Children.forEach(no, (filho) => {
    if (achado || !isValidElement(filho)) return;
    if (filho.type === tipo) achado = filho;
    else {
      achado = acharElemento(
        (filho.props as { children?: ReactNode }).children,
        tipo,
      );
    }
  });
  return achado;
}

function selectDe(valor: string) {
  const arvore = Campo({
    nome: "unidade",
    rotulo: "Em",
    tipo: "selecao",
    valor,
    children: [
      createElement("option", { key: "m", value: "meses" }, "Meses"),
      createElement("option", { key: "d", value: "dias" }, "Dias"),
    ],
  });
  return acharElemento(arvore, "select");
}

describe("Campo de seleção", () => {
  it("remonta quando o valor devolvido muda (R18): a chave segue o valor", () => {
    // O React só aplica `defaultValue` de <select> na montagem; depois de um
    // erro, o formulário é reposto e voltaria à opção inicial.
    const meses = selectDe("meses");
    const dias = selectDe("dias");
    expect(meses?.props).toMatchObject({ defaultValue: "meses" });
    expect(dias?.props).toMatchObject({ defaultValue: "dias" });
    expect(meses?.key).not.toBe(dias?.key);
    expect(dias?.key).toBe(selectDe("dias")?.key);
  });
});
