import { expect, it } from "vitest";
import { verificarSaude } from "./saude";

it("responde 200 quando o banco responde", async () => {
  expect(await verificarSaude(async () => {})).toEqual({
    http: 200,
    corpo: { status: "ok", banco: "ok" },
  });
});

it("responde 503 sem detalhes quando o banco falha", async () => {
  const r = await verificarSaude(async () => {
    throw new Error("connect ECONNREFUSED postgres://u:senha@db:5432");
  });
  expect(r).toEqual({
    http: 503,
    corpo: { status: "erro", banco: "indisponivel" },
  });
  expect(JSON.stringify(r)).not.toMatch(/senha|ECONNREFUSED|postgres:\/\//);
});

it("responde 503 quando o banco demora mais de 2 s", async () => {
  const r = await verificarSaude(() => new Promise(() => {}));
  expect(r.http).toBe(503);
}, 5000);
