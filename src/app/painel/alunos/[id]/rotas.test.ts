import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PASTA = join(process.cwd(), "src/app/painel/alunos/[id]");

/** Primeiros segmentos dos links `${base}/<segmento>` da ficha. */
function segmentosDaFicha(texto: string): string[] {
  return [
    ...new Set([...texto.matchAll(/\$\{base\}\/([a-z-]+)/g)].map((m) => m[1])),
  ].sort();
}

/** Há um `page.tsx` na pasta ou em alguma subpasta? */
function temPagina(pasta: string): boolean {
  if (!existsSync(pasta)) return false;
  return readdirSync(pasta).some((nome) => {
    const caminho = join(pasta, nome);
    return statSync(caminho).isDirectory()
      ? temPagina(caminho)
      : nome === "page.tsx";
  });
}

describe("links da ficha", () => {
  it("acha os segmentos dos links", () => {
    expect(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: é o texto do código da ficha
      segmentosDaFicha("href={`${base}/editar`} `${base}/anular?tipo=a`"),
    ).toEqual(["anular", "editar"]);
  });

  it("toda ação da ficha tem página (sem 404 nem prefetch pendurado)", () => {
    const segmentos = segmentosDaFicha(
      readFileSync(join(PASTA, "page.tsx"), "utf8"),
    );
    expect(segmentos).toEqual(
      expect.arrayContaining([
        "anular",
        "destrancar",
        "editar",
        "encerrar",
        "estender",
        "periodo",
        "trancar",
        "transferir",
        "turmas",
      ]),
    );
    expect(segmentos.filter((s) => !temPagina(join(PASTA, s)))).toEqual([]);
  });
});
