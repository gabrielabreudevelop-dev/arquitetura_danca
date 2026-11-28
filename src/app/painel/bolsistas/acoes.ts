"use server";

import { redirect } from "next/navigation";
import { hojeEmSaoPaulo } from "@/servidor/alunos/datas";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import {
  atualizarBolsista,
  cadastrarBolsista,
  MENSAGEM_NAO_BOLSISTA,
  tornarBolsista,
} from "@/servidor/bolsistas/cadastro";
import { ehUuid } from "@/servidor/cadastros/comum";
import { ehMensagemWhatsappRepetido } from "@/servidor/pessoas/cadastro-pessoa";
import { lerTexto } from "../_formulario/ler-texto";
import { faltaResponsavelEscolhido } from "../alunos/dados";
import { lerDadosBolsista } from "./dados";
import type { EstadoBolsista } from "./estado";

/**
 * Cadastra o bolsista; com uma pergunta pendente, devolve-a sem gravar nada.
 * Com `tornar` (o botão "Tornar bolsista" da pergunta de e-mail repetido),
 * dá o papel à pessoa que já existe. Sucesso → ficha.
 */
export async function cadastrarBolsistaAcao(
  estado: EstadoBolsista,
  form: FormData,
): Promise<EstadoBolsista> {
  await exigirAdministracao();
  if (lerTexto(form, "tornar")) return tornarBolsistaAcao(estado, form);
  // O teste estático exige a linha acima exatamente assim; esta só pega quem faz.
  const { pessoaId: feitoPor } = await exigirAdministracao();
  const hoje = hojeEmSaoPaulo();
  const { dados, valores } = lerDadosBolsista(form);
  const falta = faltaResponsavelEscolhido(form, hoje);
  if (falta) return { erros: falta, valores };
  const resultado = await cadastrarBolsista(
    obterBanco(),
    dados,
    feitoPor,
    hoje,
  );
  if (!resultado.ok) return { erros: resultado.erros, valores };
  const v = resultado.valor;
  switch (v.tipo) {
    case "pessoa-existente":
      return {
        valores,
        existente: {
          pessoaId: v.pessoaId,
          nome: v.nome,
          jaBolsista: v.jaBolsista,
        },
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
  redirect(`/painel/bolsistas/${v.bolsistaId}`);
}

/**
 * Dá o papel de bolsista a quem já está cadastrado (e-mail repetido), com os
 * dias e a preferência do formulário. Com erro, a pergunta continua na tela.
 */
export async function tornarBolsistaAcao(
  _estado: EstadoBolsista,
  form: FormData,
): Promise<EstadoBolsista> {
  await exigirAdministracao();
  const { pessoaId: feitoPor } = await exigirAdministracao();
  const pessoaId = lerTexto(form, "tornar").trim();
  const { dados, valores } = lerDadosBolsista(form);
  const existente = {
    pessoaId,
    nome: lerTexto(form, "existenteNome") || "Esta pessoa",
    jaBolsista: false,
  };
  if (!ehUuid(pessoaId))
    return { erros: { _: "Pessoa não encontrada." }, valores };
  const resultado = await tornarBolsista(
    obterBanco(),
    {
      pessoaId,
      dias: dados.dias,
      preferencia: dados.preferencia,
      feitoPor,
    },
    hojeEmSaoPaulo(),
  );
  if (!resultado.ok) return { erros: resultado.erros, valores, existente };
  redirect(`/painel/bolsistas/${pessoaId.toLowerCase()}`);
}

/** Atualiza os dados pessoais e a preferência (os dias mudam por "Alterar dias"). Sucesso → ficha. */
export async function atualizarBolsistaAcao(
  _estado: EstadoBolsista,
  form: FormData,
): Promise<EstadoBolsista> {
  await exigirAdministracao();
  const id = lerTexto(form, "id");
  const hoje = hojeEmSaoPaulo();
  const { dados, valores } = lerDadosBolsista(form);
  if (!ehUuid(id)) return { erros: { _: MENSAGEM_NAO_BOLSISTA }, valores };
  const falta = faltaResponsavelEscolhido(form, hoje);
  if (falta) return { erros: falta, valores };
  const resultado = await atualizarBolsista(obterBanco(), id, dados, hoje);
  if (!resultado.ok) {
    // Como no aluno: WhatsApp de outra pessoa não bloqueia, só pede "Salvar mesmo assim".
    const repetido = ehMensagemWhatsappRepetido(resultado.erros.whatsapp);
    return {
      erros: resultado.erros,
      valores: repetido ? { ...valores, whatsappRepetido: "1" } : valores,
    };
  }
  redirect(`/painel/bolsistas/${id.toLowerCase()}`);
}
