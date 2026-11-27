import type { DadosBolsista } from "@/servidor/bolsistas/cadastro";
import { lerTexto } from "../_formulario/ler-texto";
import { lerDadosAluno } from "../alunos/dados";

/** Caixas `dias` marcadas, como números de 0 (domingo) a 6 (sábado); o resto é ignorado. */
export function lerDias(form: FormData): number[] {
  return form
    .getAll("dias")
    .map((v) => Number(String(v)))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
}

/** Dias guardados em `valores.dias` ("2,4"), para remarcar as caixas depois de um erro. */
export function diasMarcados(texto: string | undefined): Set<number> {
  if (!texto) return new Set();
  return new Set(
    texto
      .split(",")
      .filter(Boolean)
      .map(Number)
      .filter((d) => Number.isInteger(d)),
  );
}

/**
 * Traduz o formulário de bolsista para os dados do serviço: os mesmos campos
 * de pessoa do aluno (responsável, WhatsApp repetido), sem turmas, mais os
 * dias combinados e a preferência. `valores` devolve o que foi digitado.
 */
export function lerDadosBolsista(form: FormData): {
  dados: DadosBolsista;
  valores: Record<string, string>;
} {
  const { dados: pessoa, valores } = lerDadosAluno(form);
  const { turmaIds: _turmas, ...dadosPessoa } = pessoa;
  delete valores.turmaIds;
  const dias = lerDias(form);
  const preferencia = lerTexto(form, "preferencia");
  valores.dias = dias.join(",");
  valores.preferencia = preferencia;
  return { dados: { ...dadosPessoa, dias, preferencia }, valores };
}
