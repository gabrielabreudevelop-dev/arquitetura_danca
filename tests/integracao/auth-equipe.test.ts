import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { criarAuth } from "@/servidor/auth/auth";
import { pessoaPapeis, pessoas } from "@/servidor/banco/esquema";
import { criarMembroEquipe } from "@/servidor/equipe/criar-membro";
import { criarBancoDeTeste } from "../apoio/banco";

const opcoes = {
  secret: "segredo-de-teste-com-mais-de-trinta-e-dois-caracteres",
  baseURL: "http://localhost:3000",
};

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>;
let auth: ReturnType<typeof criarAuth>;
beforeAll(async () => {
  banco = await criarBancoDeTeste();
  auth = criarAuth(banco.db, opcoes);
});
afterAll(async () => {
  await banco.encerrar();
});

function emailUnico(prefixo = "equipe") {
  return `${prefixo}-${randomUUID()}@estudio.com`;
}

function postar(
  auth: ReturnType<typeof criarAuth>,
  caminho: string,
  corpo: unknown,
  ip = "203.0.113.1",
) {
  return auth.handler(
    new Request(`${opcoes.baseURL}/api/auth${caminho}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: opcoes.baseURL,
        "x-forwarded-for": ip,
      },
      body: JSON.stringify(corpo),
    }),
  );
}

it("cria membro da equipe e entra com e-mail em maiúsculas", async () => {
  const email = emailUnico("ana");
  const emailDigitado = `Ana${email.slice(3)}`.replace("@estudio", "@Estudio");
  const { pessoaId, usuarioId } = await criarMembroEquipe(
    banco.db,
    {
      nome: "Ana",
      email: emailDigitado,
      senha: "senha-bem-longa-123",
      papel: "administracao",
    },
    opcoes,
  );

  const [pessoa] = await banco.db
    .select()
    .from(pessoas)
    .where(eq(pessoas.id, pessoaId));
  expect(pessoa.usuarioId).toBe(usuarioId);
  expect(pessoa.email).toBe(email);
  const papeis = await banco.db
    .select()
    .from(pessoaPapeis)
    .where(eq(pessoaPapeis.pessoaId, pessoaId));
  expect(papeis.map((p) => p.papel)).toEqual(["administracao"]);

  const resposta = await postar(auth, "/sign-in/email", {
    email,
    password: "senha-bem-longa-123",
  });
  expect(resposta.status).toBe(200);
});

it("recusa senha com menos de 12 caracteres", async () => {
  const email = emailUnico();
  await expect(
    criarMembroEquipe(
      banco.db,
      { nome: "Curta", email, senha: "onze-chars!", papel: "atendente" },
      opcoes,
    ),
  ).rejects.toThrow(/12 caracteres/);
  const achadas = await banco.db
    .select()
    .from(pessoas)
    .where(eq(pessoas.email, email));
  expect(achadas).toHaveLength(0);
  expect(
    await banco.sql(`select 1 from "user" where email = '${email}'`),
  ).toHaveLength(0);
});

it("cadastro público está desligado", async () => {
  const resposta = await postar(auth, "/sign-up/email", {
    name: "Intrusa",
    email: emailUnico("intrusa"),
    password: "senha-bem-longa-123",
  });
  expect(resposta.status).toBeGreaterThanOrEqual(400);
  expect(resposta.status).toBeLessThan(500);
});

it("barra a 6ª tentativa errada em 60 s do mesmo IP", async () => {
  // Instância nova: o contador de tentativas fica na memória de cada uma.
  const authLimite = criarAuth(banco.db, opcoes);
  const email = emailUnico("limite");
  await criarMembroEquipe(
    banco.db,
    { nome: "Limite", email, senha: "senha-bem-longa-123", papel: "atendente" },
    opcoes,
  );
  const ip = "198.51.100.7";
  for (let i = 0; i < 5; i++) {
    const r = await postar(
      authLimite,
      "/sign-in/email",
      { email, password: "senha-errada-123" },
      ip,
    );
    expect(r.status).toBe(401);
  }
  const sexta = await postar(
    authLimite,
    "/sign-in/email",
    { email, password: "senha-errada-123" },
    ip,
  );
  expect(sexta.status).toBe(429);

  // Outro IP tem balde próprio: não pode herdar o bloqueio (nem em produção).
  const outroIp = await postar(
    authLimite,
    "/sign-in/email",
    { email, password: "senha-errada-123" },
    "198.51.100.8",
  );
  expect(outroIp.status).toBe(401);
});

it("com proxy confiável, o X-Forwarded-For com vários IPs usa o do cliente", async () => {
  const authProxy = criarAuth(banco.db, {
    ...opcoes,
    proxiesConfiaveis: ["192.0.2.10"],
  });
  const email = emailUnico("proxy");
  await criarMembroEquipe(
    banco.db,
    { nome: "Proxy", email, senha: "senha-bem-longa-123", papel: "atendente" },
    opcoes,
  );
  const errada = { email, password: "senha-errada-123" };
  // Cliente A passa pelo proxy confiável 192.0.2.10.
  for (let i = 0; i < 5; i++) {
    const r = await postar(
      authProxy,
      "/sign-in/email",
      errada,
      "198.51.100.20, 192.0.2.10",
    );
    expect(r.status).toBe(401);
  }
  expect(
    (
      await postar(
        authProxy,
        "/sign-in/email",
        errada,
        "198.51.100.20, 192.0.2.10",
      )
    ).status,
  ).toBe(429);
  // Cliente B, pelo mesmo proxy, tem outro balde.
  expect(
    (
      await postar(
        authProxy,
        "/sign-in/email",
        errada,
        "198.51.100.21, 192.0.2.10",
      )
    ).status,
  ).toBe(401);
});

it("e-mail já usado por outra pessoa é recusado", async () => {
  const email = emailUnico("repetido");
  await criarMembroEquipe(
    banco.db,
    {
      nome: "Primeira",
      email,
      senha: "senha-bem-longa-123",
      papel: "atendente",
    },
    opcoes,
  );
  await expect(
    criarMembroEquipe(
      banco.db,
      {
        nome: "Segunda",
        email: email.toUpperCase(),
        senha: "senha-bem-longa-123",
        papel: "atendente",
      },
      opcoes,
    ),
  ).rejects.toThrow();
});
