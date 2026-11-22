"use server";

import { redirect } from "next/navigation";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import {
  excluirMensagem,
  salvarMensagem,
} from "@/servidor/configuracoes/mensagens-prontas";
import { excluirPlano, salvarPlano } from "@/servidor/configuracoes/planos";
import { salvarUnidadeAjustes } from "@/servidor/configuracoes/unidade";
import {
  EXEMPLO_MENSAGEM,
  preencherMensagem,
} from "@/servidor/contatos/mensagens";
import type { EstadoFormulario } from "../_formulario/estado";
import { lerTexto } from "../_formulario/ler-texto";

export async function salvarUnidadeAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const unidade = lerTexto(form, "unidade");
  const resultado = await salvarUnidadeAjustes(obterBanco(), unidade);
  if (!resultado.ok) {
    return { erros: resultado.erros, valores: { unidade } };
  }
  return { valores: { unidade, salvo: "sim" } };
}

export async function salvarPlanoAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const id = lerTexto(form, "id") || undefined;
  const dados = {
    id,
    nome: lerTexto(form, "nome"),
    quantidade: lerTexto(form, "quantidade"),
    unidade: lerTexto(form, "unidade"),
    ordem: lerTexto(form, "ordem"),
    ativo: form.get("ativo") === "on",
  };
  const resultado = await salvarPlano(obterBanco(), dados);
  if (!resultado.ok) {
    return {
      erros: resultado.erros,
      valores: { ...dados, id: id ?? "", ativo: dados.ativo ? "on" : "" },
    };
  }
  redirect("/painel/configuracoes");
}

/** Sem erro, volta para as configurações; "em uso" volta para a edição com o aviso. */
export async function excluirPlanoAcao(form: FormData): Promise<void> {
  await exigirAdministracao();
  const id = lerTexto(form, "id");
  const resultado = await excluirPlano(obterBanco(), id);
  if (!resultado.ok) redirect(`/painel/configuracoes/planos/${id}?erro=em-uso`);
  redirect("/painel/configuracoes");
}

export async function salvarMensagemAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const id = lerTexto(form, "id") || undefined;
  const dados = {
    id,
    nome: lerTexto(form, "nome"),
    finalidade: lerTexto(form, "finalidade"),
    texto: lerTexto(form, "texto"),
    ativa: form.get("ativa") === "on",
  };
  const resultado = await salvarMensagem(obterBanco(), dados);
  if (!resultado.ok) {
    return {
      erros: resultado.erros,
      valores: {
        ...dados,
        id: id ?? "",
        ativa: dados.ativa ? "on" : "",
        previa: preencherMensagem(dados.texto, EXEMPLO_MENSAGEM),
      },
    };
  }
  redirect("/painel/configuracoes");
}

export async function excluirMensagemAcao(form: FormData): Promise<void> {
  await exigirAdministracao();
  const id = lerTexto(form, "id");
  const resultado = await excluirMensagem(obterBanco(), id);
  if (!resultado.ok) {
    redirect(`/painel/configuracoes/mensagens/${id}?erro=em-uso`);
  }
  redirect("/painel/configuracoes");
}
