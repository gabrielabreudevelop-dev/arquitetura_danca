import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { ambiente } from "../ambiente";
import { type Banco, obterBanco } from "../banco/cliente";
import * as esquema from "../banco/esquema";

type OpcoesAuth = {
  /** Padrão: BETTER_AUTH_SECRET do ambiente. */
  secret?: string;
  /** Padrão: BETTER_AUTH_URL do ambiente. */
  baseURL?: string;
};

/**
 * Monta o Better Auth ligado a um banco. Só a equipe entra: o cadastro
 * público fica desligado e as contas são criadas por `criarMembroEquipe`.
 */
export function criarAuth(db: Banco, opcoes: OpcoesAuth = {}) {
  return betterAuth({
    secret: opcoes.secret ?? ambiente.BETTER_AUTH_SECRET,
    baseURL: opcoes.baseURL ?? ambiente.BETTER_AUTH_URL,
    database: drizzleAdapter(db, { provider: "pg", schema: esquema }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
    },
    rateLimit: {
      enabled: true,
      storage: "memory",
      customRules: { "/sign-in/email": { window: 60, max: 5 } },
    },
    advanced: { ipAddress: { ipAddressHeaders: ["x-forwarded-for"] } },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof criarAuth>;

const globalComAuth = globalThis as typeof globalThis & {
  __authCompartilhado?: Auth;
};

/** Instância usada pelas rotas, criada no primeiro uso. */
export function obterAuth(): Auth {
  globalComAuth.__authCompartilhado ??= criarAuth(obterBanco());
  return globalComAuth.__authCompartilhado;
}
