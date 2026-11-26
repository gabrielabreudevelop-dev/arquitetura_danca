"use server";

import { refresh } from "next/cache";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { marcarResultado } from "@/servidor/contatos/contatos";
import type { EstadoFormulario } from "../_formulario/estado";
import { lerTexto } from "../_formulario/ler-texto";

/**
 * Resultado de uma linha (campos `pessoa`, `grupo`, repetido, e `resultado`): vale para
 * o último contato de cada aluno da linha; "não quer contato" a tira da lista.
 */
export async function marcarResultadoAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const valores = { resultado: lerTexto(form, "resultado") };
  // A primeira instrução precisa ser a checagem sozinha (teste estático das
  // actions); esta segunda chamada só busca quem está fazendo.
  const { pessoaId } = await exigirAdministracao();
  const resultado = await marcarResultado(obterBanco(), {
    pessoaId: lerTexto(form, "pessoa"),
    grupoIds: form.getAll("grupo").map(String),
    resultado: valores.resultado,
    feitoPor: pessoaId,
  });
  if (!resultado.ok) return { erros: resultado.erros, valores };
  refresh();
  return { valores };
}
