"use server";

import { redirect } from "next/navigation";
import {
  atualizarAluno,
  cadastrarAluno,
  ehMensagemWhatsappRepetido,
  MENSAGEM_ENCERRADO,
  tornarAluno,
} from "@/servidor/alunos/cadastro";
import { hojeEmSaoPaulo } from "@/servidor/alunos/datas";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { ehUuid } from "@/servidor/cadastros/comum";
import { lerTexto } from "../_formulario/ler-texto";
import { faltaResponsavelEscolhido, lerDadosAluno } from "./dados";
import type { EstadoAluno } from "./estado";

const NAO_ENCONTRADO = { _: "Aluno não encontrado." };

/** Cadastra o aluno; com uma pergunta pendente, devolve-a sem gravar nada. Sucesso → ficha. */
export async function cadastrarAlunoAcao(
  _estado: EstadoAluno,
  form: FormData,
): Promise<EstadoAluno> {
  await exigirAdministracao();
  // O teste estático exige a linha acima exatamente assim; esta só pega quem faz.
  const { pessoaId: feitoPor } = await exigirAdministracao();
  const hoje = hojeEmSaoPaulo();
  const { dados, valores } = lerDadosAluno(form);
  const falta = faltaResponsavelEscolhido(form, hoje);
  if (falta) return { erros: falta, valores };
  const resultado = await cadastrarAluno(obterBanco(), dados, feitoPor, hoje);
  if (!resultado.ok) return { erros: resultado.erros, valores };
  const v = resultado.valor;
  switch (v.tipo) {
    case "pessoa-existente":
      return {
        valores,
        existente: { pessoaId: v.pessoaId, nome: v.nome, jaAluno: v.jaAluno },
      };
    case "responsavel-existente":
      return {
        valores,
        responsavelExistente: { pessoaId: v.pessoaId, nome: v.nome },
      };
    case "whatsapp-repetido":
      return {
        valores,
        whatsappRepetido: { pessoaId: v.pessoaId, nome: v.nome },
      };
  }
  redirect(`/painel/alunos/${v.alunoId}`);
}

/** Dá o papel de aluno a quem já está cadastrado (e-mail repetido) e abre a ficha. */
export async function tornarAlunoAcao(form: FormData): Promise<void> {
  await exigirAdministracao();
  const id = lerTexto(form, "pessoaId");
  if (!ehUuid(id)) redirect("/painel/alunos/novo?erro=nao-encontrada");
  const resultado = await tornarAluno(obterBanco(), id);
  if (!resultado.ok) {
    const encerrado = resultado.erros._ === MENSAGEM_ENCERRADO;
    redirect(
      `/painel/alunos/novo?erro=${encerrado ? "encerrado" : "nao-encontrada"}`,
    );
  }
  redirect(`/painel/alunos/${id}`);
}

/** Atualiza os dados do aluno. Sucesso → ficha. */
export async function atualizarAlunoAcao(
  _estado: EstadoAluno,
  form: FormData,
): Promise<EstadoAluno> {
  await exigirAdministracao();
  const id = lerTexto(form, "id");
  const hoje = hojeEmSaoPaulo();
  const { dados, valores } = lerDadosAluno(form);
  if (!ehUuid(id)) return { erros: NAO_ENCONTRADO, valores };
  const falta = faltaResponsavelEscolhido(form, hoje);
  if (falta) return { erros: falta, valores };
  const resultado = await atualizarAluno(obterBanco(), id, dados, hoje);
  if (!resultado.ok) {
    // WhatsApp de outra pessoa não bloqueia (irmãos usam o da mãe): o
    // formulário mostra o erro ao lado do campo e oferece "Salvar mesmo assim".
    const repetido = ehMensagemWhatsappRepetido(resultado.erros.whatsapp);
    return {
      erros: resultado.erros,
      valores: repetido ? { ...valores, whatsappRepetido: "1" } : valores,
    };
  }
  redirect(`/painel/alunos/${id}`);
}
