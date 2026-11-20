import { afterAll, beforeAll, expect, it } from "vitest";
import { encerrarBancoCompartilhado } from "@/servidor/banco/cliente";
import { criarBancoDeTeste } from "../apoio/banco";

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
const nomes = ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"];
const guardado = nomes.map((nome) => process.env[nome]);

beforeAll(async () => {
  banco = await criarBancoDeTeste();
  process.env.DATABASE_URL = banco.url;
  // O ambiente é validado por inteiro; valores fictícios bastam aqui.
  process.env.BETTER_AUTH_SECRET = "x".repeat(32);
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
});

afterAll(async () => {
  await encerrarBancoCompartilhado();
  nomes.forEach((nome, i) => {
    const valor = guardado[i];
    if (valor === undefined) delete process.env[nome];
    else process.env[nome] = valor;
  });
  await banco.encerrar();
});

it("GET /api/saude responde 200 com select 1 real no banco de teste", async () => {
  const { GET } = await import("@/app/api/saude/route");
  const resposta = await GET();
  expect(resposta.status).toBe(200);
  expect(resposta.headers.get("cache-control")).toBe("no-store");
  expect(await resposta.json()).toEqual({ status: "ok", banco: "ok" });
});
