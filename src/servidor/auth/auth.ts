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
  /** IPs/CIDRs dos proxies que acrescentam ao X-Forwarded-For. Padrão: PROXIES_CONFIAVEIS. */
  proxiesConfiaveis?: string[];
};

/**
 * Monta o Better Auth ligado a um banco. Só a equipe entra: o cadastro
 * público fica desligado e as contas são criadas por `criarMembroEquipe`.
 */
export function criarAuth(db: Banco, opcoes: OpcoesAuth = {}) {
  // Com segredo e URL explícitos (testes), o ambiente nunca é lido.
  const configuracaoExplicita =
    opcoes.secret !== undefined && opcoes.baseURL !== undefined;
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
        trustedProxies:
          "proxiesConfiaveis" in opcoes || configuracaoExplicita
            ? opcoes.proxiesConfiaveis
            : ambiente.PROXIES_CONFIAVEIS,
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
