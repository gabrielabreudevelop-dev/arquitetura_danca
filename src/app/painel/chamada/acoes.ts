"use server";

import { refresh } from "next/cache";
import { hojeEmSaoPaulo } from "@/servidor/alunos/datas";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import {
  desfazerNaoHouve,
  MENSAGEM_CHAMADA_MUDOU,
  MENSAGEM_CHAMADA_VAZIA,
  marcarNaoHouve,
  salvarChamada,
} from "@/servidor/bolsistas/chamada";
import type { EstadoFormulario } from "../_formulario/estado";
import { lerTexto } from "../_formulario/ler-texto";
import type { EstadoChamada } from "./estado";
import { lerPresentes, lerVersao } from "./textos";

/** Quem está fazendo (a checagem de acesso já foi feita na primeira linha). */
async function feitoPor(): Promise<string> {
  return (await exigirAdministracao()).pessoaId;
}

/** Turma e data da aula (campos ocultos `turmaId` e `data`). */
function aulaDoFormulario(form: FormData) {
  return { turmaId: lerTexto(form, "turmaId"), data: lerTexto(form, "data") };
}

/** Erros de data e turma (a aula mudou ou sumiu) viram o erro geral da tela. */
function errosDaTela(erros: Record<string, string>): Record<string, string> {
  const { data, turmaId, _: geral, ...resto } = erros;
  const primeiro = geral ?? data ?? turmaId;
  return primeiro ? { ...resto, _: primeiro } : resto;
}

/**
 * Salva os `presentes` marcados contra a `versao` que a tela mostrou. Chamada
 * vazia pede confirmação (`confirmarVazia=1`); se outra pessoa salvou antes,
 * a tela é atualizada com a chamada atual e recebe o que a pessoa marcou.
 */
export async function salvarChamadaAcao(
  _estado: EstadoChamada,
  form: FormData,
): Promise<EstadoChamada> {
  await exigirAdministracao();
  const presentes = lerPresentes(form);
  const resultado = await salvarChamada(
    obterBanco(),
    {
      ...aulaDoFormulario(form),
      presentes,
      versao: lerVersao(form),
      confirmarVazia: lerTexto(form, "confirmarVazia") === "1",
      feitoPor: await feitoPor(),
    },
    hojeEmSaoPaulo(),
  );
  if (resultado.ok) {
    refresh();
    return { salvo: true };
  }
  if (resultado.erros._ === MENSAGEM_CHAMADA_VAZIA) return { vazia: true };
  // Em qualquer outro erro a aula pode ter mudado: a tela mostra a atual.
  refresh();
  if (resultado.erros._ === MENSAGEM_CHAMADA_MUDOU)
    return { erros: resultado.erros, conflito: presentes };
  return { erros: errosDaTela(resultado.erros) };
}

/** "Não houve aula", com o motivo obrigatório. */
export async function naoHouveAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const valores = { motivo: lerTexto(form, "motivo") };
  const resultado = await marcarNaoHouve(
    obterBanco(),
    {
      ...aulaDoFormulario(form),
      motivo: valores.motivo,
      feitoPor: await feitoPor(),
    },
    hojeEmSaoPaulo(),
  );
  refresh();
  if (!resultado.ok) return { erros: errosDaTela(resultado.erros), valores };
  return {};
}

/** Desfaz o "não houve aula": a aula volta a ter chamada. */
export async function desfazerNaoHouveAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const resultado = await desfazerNaoHouve(
    obterBanco(),
    { ...aulaDoFormulario(form), feitoPor: await feitoPor() },
    hojeEmSaoPaulo(),
  );
  refresh();
  if (!resultado.ok) return { erros: errosDaTela(resultado.erros) };
  return {};
}
