"use client";

import Link from "next/link";
import {
  type FormEvent,
  type ReactNode,
  useState,
  useSyncExternalStore,
} from "react";
import { useFormStatus } from "react-dom";
import { type DataIso, ehDataIso, ehMenor } from "@/servidor/alunos/datas";
import { Campo } from "../_formulario/campo";
import type { EstadoFormulario } from "../_formulario/estado";

/**
 * Partes comuns dos formulários de pessoa (aluno e bolsista): os campos da
 * pessoa com o bloco do responsável e as perguntas do serviço (responsável já
 * cadastrado, WhatsApp repetido). Cada formulário põe o `<form>`, o
 * `BotaoPadrao` como primeiro envio, os campos próprios e a pergunta de
 * "pessoa já cadastrada com esse e-mail".
 */

export type PessoaParaEditar = {
  id: string;
  nome: string;
  nascimento: DataIso;
  /** Já formatado para o campo. */
  whatsapp: string;
  email: string;
  instagram: string;
  responsavel: { id: string; nome: string; contato: string } | null;
};

/** Perguntas que o cadastro de qualquer pessoa pode fazer. */
export type EstadoPessoa = EstadoFormulario & {
  responsavelExistente?: { pessoaId: string; nome: string };
  whatsappRepetido?: { pessoaId: string; nome: string };
};

export const LINK_PERGUNTA =
  "-mx-2 flex min-h-12 items-center self-start px-2 font-semibold text-link underline decoration-link underline-offset-4";
export const SECUNDARIO =
  "min-h-12 w-full rounded-sm border border-acao px-6 font-semibold text-link hover:bg-acao hover:text-fundo disabled:cursor-wait disabled:border-texto-suave disabled:text-texto-suave md:w-auto";
export const OPCAO = "-mx-2 flex min-h-12 items-center gap-3 px-2";
export const CAIXA = "size-6 shrink-0 accent-acao";

/** `false` no servidor e na hidratação; `true` depois, já com JavaScript. */
export function useComJavascript(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/** Botão de uma pergunta (envia o formulário com `nome=valor`); desativado durante o envio. */
export function BotaoPergunta({
  nome,
  valor,
  children,
  principal,
}: {
  nome: string;
  valor: string;
  children: ReactNode;
  principal?: boolean;
}) {
  const { pending, data } = useFormStatus();
  const clicado = pending && data?.get(nome) === valor;
  return (
    <button
      type="submit"
      name={nome}
      value={valor}
      disabled={pending}
      className={
        principal
          ? "min-h-12 w-full rounded-sm bg-acao px-6 font-semibold text-fundo hover:bg-acao-escura disabled:cursor-wait disabled:bg-texto-suave md:w-auto"
          : SECUNDARIO
      }
    >
      {clicado ? "Salvando…" : children}
    </button>
  );
}

/**
 * Primeiro botão de envio do formulário, invisível: é ele que o Enter (ou o
 * "Ir" do teclado do celular) aciona. Envia sem nenhuma confirmação, então
 * uma pergunta pendente é feita de novo em vez de respondida por engano.
 */
export function BotaoPadrao() {
  return (
    <button type="submit" tabIndex={-1} aria-hidden className="sr-only">
      Salvar
    </button>
  );
}

/**
 * Nome, nascimento, WhatsApp, e-mail, Instagram e o bloco "Responsável", que
 * aparece quando a data de nascimento indica menor; sem JavaScript, fica
 * sempre visível. Na edição, `pessoa` traz os valores atuais.
 */
export function CamposPessoa({
  estado,
  pessoa,
  hoje,
  ajudaEmail,
}: {
  estado: EstadoPessoa;
  pessoa?: PessoaParaEditar;
  hoje: DataIso;
  ajudaEmail: string;
}) {
  const comJs = useComJavascript();
  const erros = estado.erros ?? {};
  const v = estado.valores;

  // Responsável já ligado: o escolhido numa pergunta ou, na edição, o atual.
  const ligado = v?.responsavelId
    ? {
        id: v.responsavelId,
        nome: v.responsavelExistenteNome ?? "Responsável já cadastrado",
        contato: "",
      }
    : (pessoa?.responsavel ?? null);
  const escolhaInicial = ligado && (!v || v.responsavelId) ? ligado.id : "";
  const nascimentoInicial = v?.nascimento ?? pessoa?.nascimento ?? "";

  // Os campos voltam aos valores do estado a cada resposta da action.
  const [visto, setVisto] = useState(estado);
  const [nascimento, setNascimento] = useState(nascimentoInicial);
  const [escolha, setEscolha] = useState(escolhaInicial);
  if (visto !== estado) {
    setVisto(estado);
    setNascimento(nascimentoInicial);
    setEscolha(escolhaInicial);
  }

  function aoMudar(e: FormEvent<HTMLDivElement>) {
    const alvo = e.target as HTMLInputElement;
    if (alvo.name === "nascimento") setNascimento(alvo.value);
    if (alvo.name === "responsavelId") setEscolha(alvo.value);
  }

  const menor =
    ehDataIso(nascimento) && nascimento <= hoje && ehMenor(nascimento, hoje);
  const mostrarResponsavel = !comJs || menor;
  const mostrarCamposResponsavel = !comJs || !ligado || escolha === "";
  const erroNomeResponsavel = erros["responsavel.nome"] ?? erros.responsavel;

  return (
    <div onChange={aoMudar} className="flex flex-col gap-6">
      {v?.responsavelNovo === "1" && (
        <input type="hidden" name="responsavelNovo" value="1" />
      )}
      <Campo
        nome="nome"
        rotulo="Nome"
        valor={v?.nome ?? pessoa?.nome}
        erro={erros.nome}
        atributos={{ autoComplete: "off" }}
        obrigatorio
      />
      <Campo
        nome="nascimento"
        rotulo="Nascimento"
        tipo="data"
        valor={nascimentoInicial}
        erro={erros.nascimento}
        atributos={{ max: hoje }}
        obrigatorio
      />
      <Campo
        nome="whatsapp"
        rotulo="WhatsApp"
        valor={v?.whatsapp ?? pessoa?.whatsapp ?? ""}
        erro={erros.whatsapp}
        ajuda="Com DDD, por exemplo (27) 99999-0000. Para menores de 18 anos é opcional."
        atributos={{ inputMode: "tel", autoComplete: "off" }}
      />
      <Campo
        nome="email"
        rotulo="E-mail"
        tipo="email"
        valor={v?.email ?? pessoa?.email ?? ""}
        erro={erros.email}
        ajuda={ajudaEmail}
        atributos={{ autoCapitalize: "none", spellCheck: false }}
      />
      <Campo
        nome="instagram"
        rotulo="Instagram"
        valor={v?.instagram ?? pessoa?.instagram ?? ""}
        erro={erros.instagram}
        ajuda="Opcional. O usuário, com ou sem @."
        atributos={{ autoCapitalize: "none", spellCheck: false }}
      />

      {mostrarResponsavel && (
        <fieldset className="flex flex-col gap-6 border-linha border-t pt-6">
          <legend className="float-left flex w-full flex-col gap-1">
            <span className="font-semibold">Responsável</span>
            <span className="text-pequeno text-texto-suave">
              {comJs
                ? "É quem recebe as mensagens enquanto for menor de idade."
                : "Só para menores de 18 anos. É quem recebe as mensagens."}
            </span>
          </legend>
          {ligado && (
            <div className="flex flex-col">
              <input
                type="hidden"
                name="responsavelExistenteNome"
                value={ligado.nome}
              />
              <label className={OPCAO}>
                <input
                  type="radio"
                  name="responsavelId"
                  value={ligado.id}
                  defaultChecked={escolhaInicial === ligado.id}
                  className={CAIXA}
                />
                <span className="flex flex-col">
                  <span className="font-semibold">{ligado.nome}</span>
                  {ligado.contato && (
                    <span className="text-pequeno text-texto-suave">
                      {ligado.contato}
                    </span>
                  )}
                </span>
              </label>
              <label className={OPCAO}>
                <input
                  type="radio"
                  name="responsavelId"
                  value=""
                  defaultChecked={escolhaInicial === ""}
                  className={CAIXA}
                />
                <span>Cadastrar outro responsável</span>
              </label>
            </div>
          )}
          {erros["responsavel.pessoaId"] && (
            <p className="text-erro">{erros["responsavel.pessoaId"]}</p>
          )}
          {mostrarCamposResponsavel && (
            <>
              <Campo
                nome="responsavel.nome"
                rotulo="Nome do responsável"
                valor={v?.["responsavel.nome"] ?? ""}
                erro={erroNomeResponsavel}
                atributos={{ autoComplete: "off" }}
              />
              <Campo
                nome="responsavel.whatsapp"
                rotulo="WhatsApp do responsável"
                valor={v?.["responsavel.whatsapp"] ?? ""}
                erro={erros["responsavel.whatsapp"]}
                ajuda="Com DDD. Se já estiver cadastrado, oferecemos usar o cadastro."
                atributos={{ inputMode: "tel", autoComplete: "off" }}
              />
              <Campo
                nome="responsavel.email"
                rotulo="E-mail do responsável"
                tipo="email"
                valor={v?.["responsavel.email"] ?? ""}
                erro={erros["responsavel.email"]}
                ajuda="Opcional."
                atributos={{ autoCapitalize: "none", spellCheck: false }}
              />
            </>
          )}
        </fieldset>
      )}
    </div>
  );
}

/**
 * As perguntas pendentes, acima do botão: a de pessoa já cadastrada com esse
 * e-mail (`existente`, própria de cada formulário), a de responsável já
 * cadastrado e a de WhatsApp repetido ("Salvar mesmo assim"). Sem pergunta,
 * não mostra nada.
 */
export function PerguntasPessoa({
  estado,
  existente,
  verMesmoNumero,
}: {
  estado: EstadoPessoa;
  existente?: ReactNode;
  /** Link para ver quem já usa o número, com o rótulo. */
  verMesmoNumero?: { href: string; rotulo: string };
}) {
  const v = estado.valores;
  const responsavelExistente = estado.responsavelExistente;
  const whatsappRepetido = estado.whatsappRepetido;
  const confirmarRepetido = whatsappRepetido || v?.whatsappRepetido === "1";
  if (!existente && !responsavelExistente && !confirmarRepetido) return null;
  return (
    <output className="flex flex-col gap-4 border-linha border-t border-b py-6">
      {existente}
      {responsavelExistente && (
        <>
          <p className="font-semibold">
            {responsavelExistente.nome} já tem cadastro. Usar como responsável?
          </p>
          <input
            type="hidden"
            name="responsavelExistenteNome"
            value={responsavelExistente.nome}
          />
          <div className="flex flex-col gap-4 md:flex-row">
            <BotaoPergunta
              nome="responsavelId"
              valor={responsavelExistente.pessoaId}
              principal
            >
              Usar {responsavelExistente.nome} como responsável
            </BotaoPergunta>
            <BotaoPergunta nome="responsavelNovo" valor="1">
              Cadastrar outra pessoa
            </BotaoPergunta>
          </div>
        </>
      )}
      {whatsappRepetido && (
        <>
          <p className="font-semibold">
            Já existe {whatsappRepetido.nome} com esse WhatsApp.
          </p>
          <p className="text-texto-suave">
            Irmãos podem usar o número da mãe ou do pai. Se for outra pessoa,
            confira o número.
          </p>
          {verMesmoNumero && (
            <Link href={verMesmoNumero.href} className={LINK_PERGUNTA}>
              {verMesmoNumero.rotulo}
            </Link>
          )}
        </>
      )}
      {confirmarRepetido && (
        <BotaoPergunta nome="confirmarWhatsappRepetido" valor="1">
          Salvar mesmo assim
        </BotaoPergunta>
      )}
    </output>
  );
}
