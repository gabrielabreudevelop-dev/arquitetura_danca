/**
 * Endereços da chamada: `/painel/chamada?data=AAAA-MM-DD` (escolha do dia) e
 * `/painel/chamada/<turmaId>?data=AAAA-MM-DD`. Um endereço inválido volta à
 * escolha com `?erro=<código>`: só códigos curtos, nunca texto livre.
 */

import { type DataIso, ehDataIso, somarDias } from "@/servidor/alunos/datas";
import {
  MENSAGEM_DATA_FUTURA,
  MENSAGEM_DATA_INVALIDA,
  MENSAGEM_SEM_AULA_NO_DIA,
  MENSAGEM_TURMA_INATIVA,
  MENSAGEM_TURMA_INEXISTENTE,
} from "@/servidor/bolsistas/chamada";

const MENSAGENS = {
  data: MENSAGEM_DATA_INVALIDA,
  futura: MENSAGEM_DATA_FUTURA,
  "sem-aula": MENSAGEM_SEM_AULA_NO_DIA,
  turma: MENSAGEM_TURMA_INEXISTENTE,
  "turma-inativa": MENSAGEM_TURMA_INATIVA,
} as const;

export type CodigoErro = keyof typeof MENSAGENS;

function primeiro(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

function ehCodigo(texto: string | undefined): texto is CodigoErro {
  return texto !== undefined && Object.hasOwn(MENSAGENS, texto);
}

/** `?data=` do endereço: ausente é hoje; inválida ou futura é erro. */
export function lerData(
  valor: string | string[] | undefined,
  hoje: DataIso,
): { ok: true; data: DataIso } | { ok: false; codigo: CodigoErro } {
  const texto = primeiro(valor) ?? "";
  if (texto === "") return { ok: true, data: hoje };
  if (!ehDataIso(texto)) return { ok: false, codigo: "data" };
  if (texto > hoje) return { ok: false, codigo: "futura" };
  return { ok: true, data: texto };
}

/** Código do erro devolvido pelo serviço da chamada (`data` ou `turmaId`). */
export function codigoDoErro(erros: Record<string, string>): CodigoErro {
  const mensagem = erros.data ?? erros.turmaId;
  const achado = (Object.keys(MENSAGENS) as CodigoErro[]).find(
    (c) => MENSAGENS[c] === mensagem,
  );
  return achado ?? "turma";
}

/**
 * Mensagem do `?erro=` do endereço, com o que a tela fez ou o que fazer, ou
 * `null` se não houver código conhecido.
 */
export function mensagemDoErro(
  valor: string | string[] | undefined,
): string | null {
  const texto = primeiro(valor);
  if (!ehCodigo(texto)) return null;
  const dica =
    texto === "data" || texto === "futura"
      ? "Mostrando hoje."
      : "Escolha a turma na lista do dia.";
  return `${MENSAGENS[texto]} ${dica}`;
}

/** Escolha do dia; hoje fica fora do endereço. */
export function urlEscolha(
  { data, erro }: { data?: DataIso; erro?: CodigoErro },
  hoje: DataIso,
): string {
  const busca = new URLSearchParams();
  if (data && data !== hoje) busca.set("data", data);
  if (erro) busca.set("erro", erro);
  const consulta = busca.toString();
  return `/painel/chamada${consulta ? `?${consulta}` : ""}`;
}

/** Chamada de uma turma num dia. */
export function urlChamada(turmaId: string, data: DataIso): string {
  return `/painel/chamada/${turmaId}?${new URLSearchParams({ data })}`;
}

/** Para onde vai quem abriu uma chamada inválida: o mesmo dia se ele for válido, senão hoje. */
export function destinoDoErro(
  dataBruta: string | string[] | undefined,
  erros: Record<string, string>,
  hoje: DataIso,
): string {
  const lida = lerData(dataBruta, hoje);
  return urlEscolha(
    { data: lida.ok ? lida.data : undefined, erro: codigoDoErro(erros) },
    hoje,
  );
}

/** Dia anterior e seguinte; o seguinte é `null` quando seria futuro. */
export function diasVizinhos(
  data: DataIso,
  hoje: DataIso,
): { anterior: DataIso; seguinte: DataIso | null } {
  const seguinte = somarDias(data, 1);
  return {
    anterior: somarDias(data, -1),
    seguinte: seguinte > hoje ? null : seguinte,
  };
}
