"use server";

import { refresh } from "next/cache";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { marcarResultado } from "@/servidor/contatos/contatos";
import type { EstadoFormulario } from "../_formulario/estado";
import { lerTexto } from "../_formulario/ler-texto";

/**
 * Resultado do último contato de uma linha (campos `grupo` e `resultado`).
 * Vale para todos os alunos do grupo; "não quer contato" tira a linha da lista.
 */
export async function marcarResultadoAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const valores = { resultado: lerTexto(form, "resultado") };
  const { pessoaId } = await exigirAdministracao();
  const resultado = await marcarResultado(obterBanco(), {
    grupoId: lerTexto(form, "grupo"),
    resultado: valores.resultado,
    feitoPor: pessoaId,
  });
  if (!resultado.ok) return { erros: resultado.erros, valores };
  refresh();
  return { valores };
}
