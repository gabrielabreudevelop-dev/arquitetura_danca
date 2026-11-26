"use server";

import { redirect } from "next/navigation";
import { hojeEmSaoPaulo } from "@/servidor/alunos/datas";
import { anularLote, confirmarLote, previaLote } from "@/servidor/alunos/lotes";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import type { EstadoFormulario } from "../../_formulario/estado";
import { lerTexto } from "../../_formulario/ler-texto";
import { type EstadoLote, lerEscopo } from "./entrada";

/** Quem faz (a checagem de acesso já foi feita na primeira linha). */
async function feitoPor(): Promise<string> {
  return (await exigirAdministracao()).pessoaId;
}

/** O que foi digitado, para o formulário não esvaziar (turmas vão como "id,id"). */
function valoresDe(form: FormData): Record<string, string> {
  return {
    quantidade: lerTexto(form, "quantidade"),
    unidade: lerTexto(form, "unidade"),
    motivo: lerTexto(form, "motivo"),
    estudio: lerTexto(form, "estudio"),
    turmaIds: form.getAll("turmaIds").map(String).join(","),
  };
}

/** Mostra quem receberia a extensão; não grava nada. */
export async function previaLoteAcao(
  _estado: EstadoLote,
  form: FormData,
): Promise<EstadoLote> {
  await exigirAdministracao();
  const valores = valoresDe(form);
  const em = Date.now();
  const escopo = lerEscopo(form);
  if (!escopo.ok) return { erros: escopo.erros, valores, em };
  const resultado = await previaLote(
    obterBanco(),
    {
      escopo: escopo.escopo,
      quantidade: valores.quantidade,
      unidade: valores.unidade,
    },
    hojeEmSaoPaulo(),
  );
  if (!resultado.ok) return { erros: resultado.erros, valores, em };
  return { valores, previa: { linhas: resultado.valor.linhas }, em };
}

/**
 * Grava a extensão (o servidor recalcula quem recebe) e vai para a lista de
 * lotes com o número de alunos realmente estendidos.
 */
export async function confirmarLoteAcao(
  _estado: EstadoLote,
  form: FormData,
): Promise<EstadoLote> {
  await exigirAdministracao();
  const valores = valoresDe(form);
  const em = Date.now();
  const escopo = lerEscopo(form);
  if (!escopo.ok) return { erros: escopo.erros, valores, em };
  const resultado = await confirmarLote(
    obterBanco(),
    {
      escopo: escopo.escopo,
      quantidade: valores.quantidade,
      unidade: valores.unidade,
      motivo: valores.motivo,
      feitoPor: await feitoPor(),
    },
    hojeEmSaoPaulo(),
  );
  if (!resultado.ok) return { erros: resultado.erros, valores, em };
  redirect(
    `/painel/alunos/estender-turma/lotes?aplicado=${resultado.valor.alunos}`,
  );
}

/** Anula o lote (campos `loteId` e `motivo`) e volta para a lista de lotes. */
export async function anularLoteAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const valores = {
    loteId: lerTexto(form, "loteId"),
    motivo: lerTexto(form, "motivo"),
  };
  const resultado = await anularLote(obterBanco(), {
    ...valores,
    feitoPor: await feitoPor(),
  });
  if (!resultado.ok) return { erros: resultado.erros, valores };
  redirect(
    `/painel/alunos/estender-turma/lotes?anulado=${resultado.valor.anulados}`,
  );
}
