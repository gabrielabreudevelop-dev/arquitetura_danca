"use server";

import { redirect } from "next/navigation";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { excluirModulo, salvarModulo } from "@/servidor/cadastros/modulos";
import type { EstadoFormulario } from "../_formulario/estado";
import { lerTexto } from "../_formulario/ler-texto";

export async function salvarModuloAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const id = lerTexto(form, "id") || undefined;
  const dados = {
    id,
    nome: lerTexto(form, "nome"),
    ordem: lerTexto(form, "ordem"),
    ativo: form.get("ativo") === "on",
  };
  const resultado = await salvarModulo(obterBanco(), dados);
  if (!resultado.ok) {
    return {
      erros: resultado.erros,
      valores: { ...dados, id: id ?? "", ativo: dados.ativo ? "on" : "" },
    };
  }
  redirect("/painel/modulos");
}

/** Sem erro, volta para a lista; "em uso" volta para a edição com o aviso. */
export async function excluirModuloAcao(form: FormData): Promise<void> {
  await exigirAdministracao();
  const id = lerTexto(form, "id");
  const resultado = await excluirModulo(obterBanco(), id);
  if (!resultado.ok) redirect(`/painel/modulos/${id}?erro=em-uso`);
  redirect("/painel/modulos");
}
