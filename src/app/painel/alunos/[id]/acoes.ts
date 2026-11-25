"use server";

import { redirect } from "next/navigation";
import {
  encerrarAluno,
  excluirAluno,
  reabrirAluno,
} from "@/servidor/alunos/cadastro";
import { carregarAlunos } from "@/servidor/alunos/carga";
import { hojeEmSaoPaulo } from "@/servidor/alunos/datas";
import { obterFicha } from "@/servidor/alunos/ficha";
import {
  matricular,
  tirarDaTurma,
  trocarDeTurma,
} from "@/servidor/alunos/matriculas";
import {
  anularAjuste,
  anularPeriodo,
  corrigirPeriodo,
  estender,
  registrarPeriodo,
} from "@/servidor/alunos/periodos";
import {
  anularTrancamento,
  destrancar,
  trancar,
} from "@/servidor/alunos/trancamentos";
import {
  anularTransferencia,
  transferir,
} from "@/servidor/alunos/transferencias";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { ehUuid } from "@/servidor/cadastros/comum";
import {
  desfazerNaoQuerContato,
  marcarNaoQuerContato,
} from "@/servidor/contatos/contatos";
import type { EstadoFormulario } from "../../_formulario/estado";
import { lerTexto } from "../../_formulario/ler-texto";
import { lerAlvoAnular } from "./calculos";

const ALUNO_NAO_ENCONTRADO = "Aluno não encontrado.";
const MATRICULA_NAO_ENCONTRADA = "Matrícula não encontrada.";
const LANCAMENTO_NAO_ENCONTRADO = "Lançamento não encontrado.";

/** Os campos pedidos, como texto, para o formulário não esvaziar com erro. */
function ler(form: FormData, campos: string[]): Record<string, string> {
  return Object.fromEntries(campos.map((c) => [c, lerTexto(form, c)]));
}

/** Id do aluno (campo oculto `id`), em minúsculas; `null` se não for uuid. */
function alunoDoFormulario(form: FormData): string | null {
  const id = lerTexto(form, "id");
  return ehUuid(id) ? id.toLowerCase() : null;
}

function erro(
  mensagem: string,
  valores?: Record<string, string>,
): EstadoFormulario {
  return { erros: { _: mensagem }, valores };
}

/** Quem está fazendo (a checagem de acesso já foi feita na primeira linha). */
async function feitoPor(): Promise<string> {
  return (await exigirAdministracao()).pessoaId;
}

/** A matrícula aberta é deste aluno? */
async function matriculaDoAluno(
  alunoId: string,
  matriculaId: string,
): Promise<boolean> {
  if (!ehUuid(matriculaId)) return false;
  const [aluno] = await carregarAlunos(obterBanco(), hojeEmSaoPaulo(), {
    ids: [alunoId],
  });
  const id = matriculaId.toLowerCase();
  return aluno?.matriculas.some((m) => m.matriculaId === id) ?? false;
}

/**
 * Registra (ou renova) o período. Com `corrigir` (id do período errado),
 * anula o antigo com o motivo "Correção" e registra o novo, tudo ou nada.
 */
export async function registrarPeriodoAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const valores = ler(form, ["planoId", "inicio", "fim"]);
  const alunoId = alunoDoFormulario(form);
  if (!alunoId) return erro(ALUNO_NAO_ENCONTRADO, valores);
  const corrigir = lerTexto(form, "corrigir");
  const dados = {
    alunoId,
    planoId: valores.planoId,
    inicio: valores.inicio,
    fim: valores.fim,
    feitoPor: await feitoPor(),
  };
  const resultado = corrigir
    ? await corrigirPeriodo(obterBanco(), { ...dados, periodoId: corrigir })
    : await registrarPeriodo(obterBanco(), dados);
  if (!resultado.ok) return { erros: resultado.erros, valores };
  redirect(`/painel/alunos/${alunoId}`);
}

/** Extensão individual no último período. */
export async function estenderAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const valores = ler(form, ["quantidade", "unidade", "turmaId", "motivo"]);
  const alunoId = alunoDoFormulario(form);
  if (!alunoId) return erro(ALUNO_NAO_ENCONTRADO, valores);
  const resultado = await estender(
    obterBanco(),
    {
      alunoId,
      quantidade: valores.quantidade,
      unidade: valores.unidade,
      turmaId: valores.turmaId || undefined,
      motivo: valores.motivo,
      feitoPor: await feitoPor(),
    },
    hojeEmSaoPaulo(),
  );
  if (!resultado.ok) return { erros: resultado.erros, valores };
  redirect(`/painel/alunos/${alunoId}`);
}

/** Tranca o último período; a volta só vale com "Sei a data de volta". */
export async function trancarAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const valores = ler(form, ["inicio", "sabeVolta", "volta", "motivo"]);
  const alunoId = alunoDoFormulario(form);
  if (!alunoId) return erro(ALUNO_NAO_ENCONTRADO, valores);
  const sabeVolta = valores.sabeVolta === "on";
  if (sabeVolta && !valores.volta.trim()) {
    return { erros: { volta: "Informe a data de volta." }, valores };
  }
  const resultado = await trancar(
    obterBanco(),
    {
      alunoId,
      inicio: valores.inicio,
      volta: sabeVolta ? valores.volta : undefined,
      motivo: valores.motivo,
      feitoPor: await feitoPor(),
    },
    hojeEmSaoPaulo(),
  );
  if (!resultado.ok) return { erros: resultado.erros, valores };
  redirect(`/painel/alunos/${alunoId}`);
}

/** Fecha um trancamento aberto deste aluno com a data de volta. */
export async function destrancarAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const valores = ler(form, ["volta"]);
  const alunoId = alunoDoFormulario(form);
  if (!alunoId) return erro(ALUNO_NAO_ENCONTRADO, valores);
  const trancamentoId = lerTexto(form, "trancamentoId").toLowerCase();
  const [aluno] = await carregarAlunos(obterBanco(), hojeEmSaoPaulo(), {
    ids: [alunoId],
  });
  if (!aluno?.trancamentos.some((t) => t.id === trancamentoId)) {
    return erro("Trancamento não encontrado.", valores);
  }
  const resultado = await destrancar(obterBanco(), {
    trancamentoId,
    volta: valores.volta,
    feitoPor: await feitoPor(),
  });
  if (!resultado.ok) return { erros: resultado.erros, valores };
  redirect(`/painel/alunos/${alunoId}`);
}

/** Cede dias do último período deste aluno a outro. */
export async function transferirAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const valores = ler(form, [
    "paraAlunoId",
    "quantidade",
    "unidade",
    "turmaId",
    "inicioRecebedor",
    "motivo",
  ]);
  const alunoId = alunoDoFormulario(form);
  if (!alunoId) return erro(ALUNO_NAO_ENCONTRADO, valores);
  const resultado = await transferir(
    obterBanco(),
    {
      deAlunoId: alunoId,
      paraAlunoId: valores.paraAlunoId,
      quantidade: valores.quantidade,
      unidade: valores.unidade,
      turmaId: valores.turmaId || undefined,
      inicioRecebedor: valores.inicioRecebedor || undefined,
      motivo: valores.motivo,
      feitoPor: await feitoPor(),
    },
    hojeEmSaoPaulo(),
  );
  if (!resultado.ok) return { erros: resultado.erros, valores };
  redirect(`/painel/alunos/${alunoId}`);
}

/** Matricula o aluno numa turma ativa. */
export async function matricularAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const valores = ler(form, ["turmaId", "entrada"]);
  const alunoId = alunoDoFormulario(form);
  if (!alunoId) return erro(ALUNO_NAO_ENCONTRADO, valores);
  if (!valores.turmaId) {
    return { erros: { turmaId: "Escolha a turma." }, valores };
  }
  const resultado = await matricular(obterBanco(), {
    alunoId,
    turmaId: valores.turmaId,
    entrada: valores.entrada,
    feitoPor: await feitoPor(),
  });
  if (!resultado.ok) return { erros: resultado.erros, valores };
  redirect(`/painel/alunos/${alunoId}`);
}

/** Fecha uma matrícula aberta deste aluno com a data de saída. */
export async function tirarDaTurmaAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const valores = ler(form, ["saida"]);
  const alunoId = alunoDoFormulario(form);
  if (!alunoId) return erro(ALUNO_NAO_ENCONTRADO, valores);
  const matriculaId = lerTexto(form, "matriculaId");
  if (!(await matriculaDoAluno(alunoId, matriculaId))) {
    return erro(MATRICULA_NAO_ENCONTRADA, valores);
  }
  const resultado = await tirarDaTurma(obterBanco(), {
    matriculaId,
    saida: valores.saida,
    feitoPor: await feitoPor(),
  });
  if (!resultado.ok) return { erros: resultado.erros, valores };
  redirect(`/painel/alunos/${alunoId}`);
}

/** Troca uma matrícula aberta deste aluno por outra turma, na mesma data. */
export async function trocarDeTurmaAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const valores = ler(form, ["novaTurmaId", "data"]);
  const alunoId = alunoDoFormulario(form);
  if (!alunoId) return erro(ALUNO_NAO_ENCONTRADO, valores);
  const matriculaId = lerTexto(form, "matriculaId");
  if (!(await matriculaDoAluno(alunoId, matriculaId))) {
    return erro(MATRICULA_NAO_ENCONTRADA, valores);
  }
  if (!valores.novaTurmaId) {
    return { erros: { novaTurmaId: "Escolha a nova turma." }, valores };
  }
  const resultado = await trocarDeTurma(obterBanco(), {
    matriculaId,
    novaTurmaId: valores.novaTurmaId,
    data: valores.data,
    feitoPor: await feitoPor(),
  });
  if (!resultado.ok) return { erros: resultado.erros, valores };
  redirect(`/painel/alunos/${alunoId}`);
}

/** Encerra o cadastro (fecha as matrículas na data e desativa o papel). */
export async function encerrarAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const valores = ler(form, ["data", "motivo"]);
  const alunoId = alunoDoFormulario(form);
  if (!alunoId) return erro(ALUNO_NAO_ENCONTRADO, valores);
  const resultado = await encerrarAluno(obterBanco(), {
    alunoId,
    data: valores.data,
    motivo: valores.motivo,
    feitoPor: await feitoPor(),
  });
  if (!resultado.ok) return { erros: resultado.erros, valores };
  redirect(`/painel/alunos/${alunoId}`);
}

/** Reabre o cadastro encerrado (as matrículas não voltam). */
export async function reabrirAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const alunoId = alunoDoFormulario(form);
  if (!alunoId) return erro(ALUNO_NAO_ENCONTRADO);
  const resultado = await reabrirAluno(obterBanco(), {
    alunoId,
    feitoPor: await feitoPor(),
    hoje: hojeEmSaoPaulo(),
  });
  if (!resultado.ok) return { erros: resultado.erros };
  redirect(`/painel/alunos/${alunoId}`);
}

/**
 * Exclui o cadastro. Sem `confirmar=1`, só pede a confirmação (devolve
 * `valores.confirmar = "1"`); com ela, exclui e volta para a lista.
 */
export async function excluirAlunoAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const alunoId = alunoDoFormulario(form);
  if (!alunoId) return erro(ALUNO_NAO_ENCONTRADO);
  if (lerTexto(form, "confirmar") !== "1") {
    return { valores: { confirmar: "1" } };
  }
  const resultado = await excluirAluno(obterBanco(), alunoId);
  if (!resultado.ok) return { erros: resultado.erros };
  redirect("/painel/alunos");
}

/**
 * Anula um item do histórico deste aluno (`tipo` e `alvo`): ajuste, período,
 * trancamento ou transferência. Lotes são anulados na tela de lotes.
 */
export async function anularAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const valores = ler(form, ["motivo"]);
  const alunoId = alunoDoFormulario(form);
  if (!alunoId) return erro(ALUNO_NAO_ENCONTRADO, valores);
  const alvo = lerAlvoAnular(lerTexto(form, "tipo"), lerTexto(form, "alvo"));
  if (!alvo) return erro(LANCAMENTO_NAO_ENCONTRADO, valores);
  const ficha = await obterFicha(obterBanco(), alunoId, hojeEmSaoPaulo());
  const doAluno = ficha?.historico.some(
    (h) => h.anular?.tipo === alvo.tipo && h.anular.id === alvo.id,
  );
  if (!doAluno) return erro(LANCAMENTO_NAO_ENCONTRADO, valores);

  const db = obterBanco();
  const comum = { motivo: valores.motivo, feitoPor: await feitoPor() };
  let resultado: Awaited<ReturnType<typeof anularAjuste>>;
  switch (alvo.tipo) {
    case "ajuste":
      resultado = await anularAjuste(db, { ...comum, ajusteId: alvo.id });
      break;
    case "periodo":
      resultado = await anularPeriodo(db, { ...comum, periodoId: alvo.id });
      break;
    case "trancamento":
      resultado = await anularTrancamento(db, {
        ...comum,
        trancamentoId: alvo.id,
      });
      break;
    case "transferencia":
      resultado = await anularTransferencia(db, {
        ...comum,
        transferenciaId: alvo.id,
      });
      break;
  }
  if (!resultado.ok) return { erros: resultado.erros, valores };
  redirect(`/painel/alunos/${alunoId}`);
}

/** A pessoa que recebe as mensagens do aluno do formulário, ou `null`. */
async function pessoaDeContatoDo(alunoId: string): Promise<string | null> {
  const [aluno] = await carregarAlunos(obterBanco(), hojeEmSaoPaulo(), {
    ids: [alunoId],
  });
  return aluno?.contato.pessoaId ?? null;
}

/**
 * "Não quer contato": marca a pessoa que recebe as mensagens do aluno (ele,
 * ou o responsável), o que vale para todos os alunos dela.
 */
export async function naoQuerContatoAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const alunoId = alunoDoFormulario(form);
  const pessoaId = alunoId ? await pessoaDeContatoDo(alunoId) : null;
  if (!alunoId || !pessoaId) return erro(ALUNO_NAO_ENCONTRADO);
  const resultado = await marcarNaoQuerContato(obterBanco(), {
    pessoaId,
    feitoPor: await feitoPor(),
  });
  if (!resultado.ok) return { erros: resultado.erros };
  redirect(`/painel/alunos/${alunoId}`);
}

/** "Voltou a aceitar contato": desfaz a marca da pessoa de contato do aluno. */
export async function desfazerNaoQuerContatoAcao(
  _estado: EstadoFormulario,
  form: FormData,
): Promise<EstadoFormulario> {
  await exigirAdministracao();
  const alunoId = alunoDoFormulario(form);
  const pessoaId = alunoId ? await pessoaDeContatoDo(alunoId) : null;
  if (!alunoId || !pessoaId) return erro(ALUNO_NAO_ENCONTRADO);
  const resultado = await desfazerNaoQuerContato(obterBanco(), {
    pessoaId,
    feitoPor: await feitoPor(),
  });
  if (!resultado.ok) return { erros: resultado.erros };
  redirect(`/painel/alunos/${alunoId}`);
}
