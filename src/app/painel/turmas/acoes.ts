"use server";

import { redirect } from "next/navigation";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { excluirTurma, salvarTurma } from "@/servidor/cadastros/turmas";
import type { EstadoFormulario } from "../_formulario/estado";
import { lerTexto } from "../_formulario/ler-texto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function salvarTurmaAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const id = lerTexto(form, "id");
  const diasMarcados = form.getAll("dias").map(String);
  const dados = {
    ritmoId: lerTexto(form, "ritmoId"),
    moduloId: lerTexto(form, "moduloId"),
    professorId: lerTexto(form, "professorId"),
    dias: diasMarcados.map(Number),
    horarioInicio: lerTexto(form, "horarioInicio"),
    horarioFim: lerTexto(form, "horarioFim"),
    linkGrupoWhatsapp: lerTexto(form, "linkGrupoWhatsapp"),
    ativa: form.get("ativa") === "on",
  };
  // O formulário devolve o que foi digitado; `dias` vai como "2,4".
  const valores = {
    ...dados,
    id,
    dias: diasMarcados.join(","),
    ativa: dados.ativa ? "on" : "",
  };
  if (id && !UUID.test(id)) {
    return { erros: { _: "Turma não encontrada." }, valores };
  }
  const resultado = await salvarTurma(obterBanco(), {
    ...dados,
    id: id || undefined,
  });
  if (!resultado.ok) return { erros: resultado.erros, valores };
  redirect("/painel/turmas");
}

/** Sem erro, volta para a lista; "em uso" volta para a edição com o aviso. */
export async function excluirTurmaAcao(form: FormData): Promise<void> {
  await exigirAdministracao();
  const id = lerTexto(form, "id");
  if (!UUID.test(id)) redirect("/painel/turmas");
  const resultado = await excluirTurma(obterBanco(), id);
  if (!resultado.ok) redirect(`/painel/turmas/${id}?erro=em-uso`);
  redirect("/painel/turmas");
}
