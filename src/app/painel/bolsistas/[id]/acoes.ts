"use server";

import { redirect } from "next/navigation";
import { hojeEmSaoPaulo } from "@/servidor/alunos/datas";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import {
  alterarDias,
  MENSAGEM_NAO_BOLSISTA,
  mudarSituacao,
} from "@/servidor/bolsistas/cadastro";
import { carregarBolsistas } from "@/servidor/bolsistas/carga";
import { ehUuid } from "@/servidor/cadastros/comum";
import {
  desfazerNaoQuerContato,
  marcarNaoQuerContato,
} from "@/servidor/contatos/contatos";
import type { EstadoFormulario } from "../../_formulario/estado";
import { lerTexto } from "../../_formulario/ler-texto";
import { lerDias } from "../dados";

const NAO_ENCONTRADO: EstadoFormulario = {
  erros: { _: MENSAGEM_NAO_BOLSISTA },
};

/** Id do bolsista (campo oculto `id`), em minúsculas; `null` se não for uuid. */
function bolsistaDoFormulario(form: FormData): string | null {
  const id = lerTexto(form, "id");
  return ehUuid(id) ? id.toLowerCase() : null;
}

/** Quem está fazendo (a checagem de acesso já foi feita na primeira linha). */
async function feitoPor(): Promise<string> {
  return (await exigirAdministracao()).pessoaId;
}

/** Nova versão dos dias combinados, vigente desde a data escolhida. Sucesso → ficha. */
export async function alterarDiasAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const dias = lerDias(form);
  const valores = {
    dias: dias.join(","),
    vigenteDesde: lerTexto(form, "vigenteDesde"),
  };
  const pessoaId = bolsistaDoFormulario(form);
  if (!pessoaId) return { ...NAO_ENCONTRADO, valores };
  const resultado = await alterarDias(
    obterBanco(),
    {
      pessoaId,
      dias,
      vigenteDesde: valores.vigenteDesde,
      feitoPor: await feitoPor(),
    },
    hojeEmSaoPaulo(),
  );
  if (!resultado.ok) return { erros: resultado.erros, valores };
  redirect(`/painel/bolsistas/${pessoaId}`);
}

/** Inativa ou reativa a bolsa (`tipo`), na data escolhida, com motivo opcional. Sucesso → ficha. */
export async function mudarSituacaoAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const valores = {
    data: lerTexto(form, "data"),
    motivo: lerTexto(form, "motivo"),
  };
  const tipoBruto = lerTexto(form, "tipo");
  const pessoaId = bolsistaDoFormulario(form);
  if (!pessoaId || (tipoBruto !== "ativacao" && tipoBruto !== "inativacao"))
    return { ...NAO_ENCONTRADO, valores };
  const resultado = await mudarSituacao(
    obterBanco(),
    {
      pessoaId,
      tipo: tipoBruto,
      data: valores.data,
      motivo: valores.motivo,
      feitoPor: await feitoPor(),
    },
    hojeEmSaoPaulo(),
  );
  if (!resultado.ok) return { erros: resultado.erros, valores };
  redirect(`/painel/bolsistas/${pessoaId}`);
}

/** A pessoa que recebe as mensagens do bolsista (ele, ou o responsável), ou `null`. */
async function pessoaDeContatoDo(pessoaId: string): Promise<string | null> {
  const [bolsista] = await carregarBolsistas(obterBanco(), hojeEmSaoPaulo(), {
    ids: [pessoaId],
  });
  return bolsista?.contato.pessoaId ?? null;
}

/** "Não quer contato": marca a pessoa que recebe as mensagens do bolsista. */
export async function naoQuerContatoBolsistaAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const id = bolsistaDoFormulario(form);
  const contato = id ? await pessoaDeContatoDo(id) : null;
  if (!id || !contato) return NAO_ENCONTRADO;
  const resultado = await marcarNaoQuerContato(obterBanco(), {
    pessoaId: contato,
    feitoPor: await feitoPor(),
  });
  if (!resultado.ok) return { erros: resultado.erros };
  redirect(`/painel/bolsistas/${id}`);
}

/** "Voltou a aceitar contato": desfaz a marca da pessoa de contato do bolsista. */
export async function desfazerNaoQuerContatoBolsistaAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const id = bolsistaDoFormulario(form);
  const contato = id ? await pessoaDeContatoDo(id) : null;
  if (!id || !contato) return NAO_ENCONTRADO;
  const resultado = await desfazerNaoQuerContato(obterBanco(), {
    pessoaId: contato,
    feitoPor: await feitoPor(),
  });
  if (!resultado.ok) return { erros: resultado.erros };
  redirect(`/painel/bolsistas/${id}`);
}
