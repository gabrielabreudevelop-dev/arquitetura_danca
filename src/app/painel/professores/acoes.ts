"use server";

import { redirect } from "next/navigation";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import {
  atualizarProfessor,
  cadastrarProfessor,
  excluirProfessor,
  tornarProfessor,
} from "@/servidor/cadastros/professores";
import type { EstadoFormulario } from "../_formulario/estado";
import { lerTexto } from "../_formulario/ler-texto";
import type { EstadoProfessor } from "./estado";

export async function cadastrarProfessorAcao(
  _estado: EstadoProfessor,
  form: FormData,
): Promise<EstadoProfessor> {
  await exigirAdministracao();
  const dados = {
    nome: lerTexto(form, "nome"),
    email: lerTexto(form, "email"),
    whatsapp: lerTexto(form, "whatsapp"),
  };
  const resultado = await cadastrarProfessor(obterBanco(), dados);
  if (!resultado.ok) return { erros: resultado.erros, valores: dados };
  if (resultado.valor.tipo === "pessoa-existente") {
    const { pessoaId, nome, jaProfessor } = resultado.valor;
    return { valores: dados, existente: { pessoaId, nome, jaProfessor } };
  }
  redirect("/painel/professores");
}

export async function tornarProfessorAcao(form: FormData): Promise<void> {
  await exigirAdministracao();
  const id = lerTexto(form, "id");
  const resultado = await tornarProfessor(obterBanco(), id);
  if (!resultado.ok) redirect("/painel/professores/novo");
  redirect(`/painel/professores/${id}`);
}

export async function atualizarProfessorAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const id = lerTexto(form, "id");
  const dados = {
    nome: lerTexto(form, "nome"),
    email: lerTexto(form, "email"),
    whatsapp: lerTexto(form, "whatsapp"),
    ativo: form.get("ativo") === "on",
  };
  const resultado = await atualizarProfessor(obterBanco(), id, dados);
  if (!resultado.ok) {
    return {
      erros: resultado.erros,
      valores: { ...dados, ativo: dados.ativo ? "on" : "" },
    };
  }
  redirect("/painel/professores");
}

/** Sem erro, volta para a lista; "em uso" volta para a edição com o aviso. */
export async function excluirProfessorAcao(form: FormData): Promise<void> {
  await exigirAdministracao();
  const id = lerTexto(form, "id");
  const resultado = await excluirProfessor(obterBanco(), id);
  if (!resultado.ok) redirect(`/painel/professores/${id}?erro=em-uso`);
  redirect("/painel/professores");
}
