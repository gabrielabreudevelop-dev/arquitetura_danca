"use server";

import { redirect } from "next/navigation";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { excluirRitmo, salvarRitmo } from "@/servidor/cadastros/ritmos";
import type { EstadoFormulario } from "../_formulario/estado";

const texto = (form: FormData, campo: string) => String(form.get(campo) ?? "");

export async function salvarRitmoAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const id = texto(form, "id") || undefined;
  const dados = {
    id,
    nome: texto(form, "nome"),
    slug: texto(form, "slug"),
    ordem: texto(form, "ordem"),
    ativo: form.get("ativo") === "on",
  };
  const resultado = await salvarRitmo(obterBanco(), dados);
  if (!resultado.ok) {
    return {
      erros: resultado.erros,
      valores: { ...dados, id: id ?? "", ativo: dados.ativo ? "on" : "" },
    };
  }
  redirect("/painel/ritmos");
}

/** Sem erro, volta para a lista; "em uso" volta para a edição com o aviso. */
export async function excluirRitmoAcao(form: FormData): Promise<void> {
  await exigirAdministracao();
  const id = texto(form, "id");
  const resultado = await excluirRitmo(obterBanco(), id);
  if (!resultado.ok) redirect(`/painel/ritmos/${id}?erro=em-uso`);
  redirect("/painel/ritmos");
}
