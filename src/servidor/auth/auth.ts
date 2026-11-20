import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { ambiente } from "../ambiente";
import { type Banco, obterBanco } from "../banco/cliente";
import * as esquema from "../banco/esquema";

type OpcoesAuth = {
  secret?: string;
  baseURL?: string;
  /** IPs/CIDRs dos proxies que acrescentam ao X-Forwarded-For. */
  proxiesConfiaveis?: string[];
};

/**
 * Monta o Better Auth ligado a um banco. Só a equipe entra: o cadastro
 * público fica desligado e as contas são criadas por `criarMembroEquipe`.
 *
 * Sem opções, tudo vem do ambiente (BETTER_AUTH_SECRET, BETTER_AUTH_URL,
 * PROXIES_CONFIAVEIS). Se qualquer opção for informada, tudo vem só das
 * opções (o ambiente não é lido) e `secret` e `baseURL` são obrigatórios.
 */
export function criarAuth(db: Banco, opcoes: OpcoesAuth = {}) {
  const explicito =
    opcoes.secret !== undefined ||
    opcoes.baseURL !== undefined ||
    opcoes.proxiesConfiaveis !== undefined;
  if (explicito && (!opcoes.secret || !opcoes.baseURL)) {
    throw new Error("criarAuth: informe secret e baseURL juntos");
  }
  const secret = explicito ? opcoes.secret : ambiente.BETTER_AUTH_SECRET;
  const baseURL = explicito ? opcoes.baseURL : ambiente.BETTER_AUTH_URL;
  const trustedProxies = explicito
    ? opcoes.proxiesConfiaveis
    : ambiente.PROXIES_CONFIAVEIS;
  return betterAuth({
    secret,
    baseURL,
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
    // O limite de tentativas é por IP. Em produção, se o IP não puder ser
    // determinado (cabeçalho ausente ou com mais de um valor), todos caem no
    // mesmo balde e uma pessoa trava o login de toda a equipe. No deploy
    // suportado (Coolify), o Traefik substitui o X-Forwarded-For recebido por
    // um único IP de cliente (entrypoint sem forwardedHeaders.trustedIPs), e
    // nada mais é preciso. PROXIES_CONFIAVEIS serve para um hop extra (CDN,
    // outro proxy) que acrescenta ao cabeçalho: com os IPs/CIDRs desses
    // proxies, o Better Auth descarta os hops confiáveis e usa o do cliente.
    advanced: {
      ipAddress: {
        ipAddressHeaders: ["x-forwarded-for"],
        trustedProxies,
      },
    },
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
