"use client";

import Link from "next/link";
import {
  type FormEvent,
  useActionState,
  useState,
  useSyncExternalStore,
} from "react";
import { useFormStatus } from "react-dom";
import { type DataIso, ehDataIso, ehMenor } from "@/servidor/alunos/datas";
import { BotaoEnviar } from "../_formulario/botao-enviar";
import { Campo } from "../_formulario/campo";
import { ESTADO_INICIAL } from "../_formulario/estado";
import { MensagemErroGeral } from "../_formulario/mensagem";
import {
  atualizarAlunoAcao,
  cadastrarAlunoAcao,
  tornarAlunoAcao,
} from "./acoes";
import type { EstadoAluno } from "./estado";

export type AlunoParaEditar = {
  id: string;
  nome: string;
  nascimento: DataIso;
  /** Já formatado para o campo. */
  whatsapp: string;
  email: string;
  instagram: string;
  responsavel: { id: string; nome: string; contato: string } | null;
};

const LINK =
  "-mx-2 flex min-h-12 items-center self-start px-2 font-semibold text-link underline decoration-link underline-offset-4";
const SECUNDARIO =
  "min-h-12 w-full rounded-sm border border-acao px-6 font-semibold text-link hover:bg-acao hover:text-fundo disabled:cursor-wait disabled:border-texto-suave disabled:text-texto-suave md:w-auto";
const OPCAO = "-mx-2 flex min-h-12 items-center gap-3 px-2";
const CAIXA = "size-6 shrink-0 accent-acao";

/** `false` no servidor e na hidratação; `true` depois, já com JavaScript. */
function useComJavascript(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/** Botão de uma pergunta (envia o formulário com `nome=valor`); desativado durante o envio. */
function BotaoPergunta({
  nome,
  valor,
  children,
  principal,
}: {
  nome: string;
  valor: string;
  children: React.ReactNode;
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

/** "Tornar aluno": outra action, no mesmo formulário. */
function BotaoTornarAluno({ pessoaId }: { pessoaId: string }) {
  const { pending } = useFormStatus();
  return (
    <>
      {/* Campo oculto: o par nome/valor do botão não chega à action de `formAction`. */}
      <input type="hidden" name="pessoaId" value={pessoaId} />
      <button
        type="submit"
        formAction={tornarAlunoAcao}
        disabled={pending}
        className={SECUNDARIO}
      >
        {pending ? "Salvando…" : "Tornar aluno"}
      </button>
    </>
  );
}

/**
 * Formulário de aluno: novo (com `turmas`) ou edição (com `aluno`). O bloco
 * "Responsável" aparece quando a data de nascimento indica menor; sem
 * JavaScript, fica sempre visível. As perguntas do serviço (e-mail de outra
 * pessoa, responsável já cadastrado, WhatsApp repetido) aparecem acima do botão.
 */
export function FormularioAluno({
  aluno,
  turmas,
  hoje,
}: {
  aluno?: AlunoParaEditar;
  /** Turmas ativas, só no cadastro. */
  turmas?: { id: string; rotulo: string }[];
  hoje: DataIso;
}) {
  const [estado, acao] = useActionState<EstadoAluno, FormData>(
    aluno ? atualizarAlunoAcao : cadastrarAlunoAcao,
    ESTADO_INICIAL,
  );
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
    : (aluno?.responsavel ?? null);
  const escolhaInicial = ligado && (!v || v.responsavelId) ? ligado.id : "";
  const nascimentoInicial = v?.nascimento ?? aluno?.nascimento ?? "";

  // O formulário volta aos valores do estado a cada resposta da action.
  const [visto, setVisto] = useState(estado);
  const [nascimento, setNascimento] = useState(nascimentoInicial);
  const [escolha, setEscolha] = useState(escolhaInicial);
  if (visto !== estado) {
    setVisto(estado);
    setNascimento(nascimentoInicial);
    setEscolha(escolhaInicial);
  }

  function aoMudar(e: FormEvent<HTMLFormElement>) {
    const alvo = e.target as HTMLInputElement;
    if (alvo.name === "nascimento") setNascimento(alvo.value);
    if (alvo.name === "responsavelId") setEscolha(alvo.value);
  }

  const menor =
    ehDataIso(nascimento) && nascimento <= hoje && ehMenor(nascimento, hoje);
  const mostrarResponsavel = !comJs || menor;
  const mostrarCamposResponsavel = !comJs || !ligado || escolha === "";
  const turmasMarcadas = new Set(v?.turmaIds?.split(",") ?? []);
  const erroNomeResponsavel = erros["responsavel.nome"] ?? erros.responsavel;

  const existente = estado.existente;
  const responsavelExistente = estado.responsavelExistente;
  const whatsappRepetido = estado.whatsappRepetido;
  const temPergunta =
    existente ||
    responsavelExistente ||
    whatsappRepetido ||
    v?.whatsappRepetido === "1";

  return (
    <form
      action={acao}
      onChange={aoMudar}
      noValidate
      className="flex flex-col gap-6"
    >
      {aluno && <input type="hidden" name="id" value={aluno.id} />}
      {v?.responsavelNovo === "1" && (
        <input type="hidden" name="responsavelNovo" value="1" />
      )}
      <Campo
        nome="nome"
        rotulo="Nome"
        valor={v?.nome ?? aluno?.nome}
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
        valor={v?.whatsapp ?? aluno?.whatsapp ?? ""}
        erro={erros.whatsapp}
        ajuda="Com DDD, por exemplo (27) 99999-0000. Para menores de 18 anos é opcional."
        atributos={{ inputMode: "tel", autoComplete: "off" }}
      />
      <Campo
        nome="email"
        rotulo="E-mail"
        tipo="email"
        valor={v?.email ?? aluno?.email ?? ""}
        erro={erros.email}
        ajuda="Opcional. É por ele que o aluno vai entrar na plataforma."
        atributos={{ autoCapitalize: "none", spellCheck: false }}
      />
      <Campo
        nome="instagram"
        rotulo="Instagram"
        valor={v?.instagram ?? aluno?.instagram ?? ""}
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
                ? "É quem recebe as mensagens enquanto o aluno for menor."
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

      {turmas && (
        <fieldset className="flex flex-col gap-2 border-linha border-t pt-6">
          <legend className="float-left flex w-full flex-col gap-1">
            <span className="font-semibold">Turmas</span>
            <span className="text-pequeno text-texto-suave">
              Opcional. Cada turma marcada vira matrícula a partir de hoje.
            </span>
          </legend>
          {turmas.length === 0 ? (
            <p className="text-texto-suave">
              Nenhuma turma ativa agora. Dá para matricular depois, pela ficha.
            </p>
          ) : (
            <div className="flex flex-col">
              {turmas.map((t) => (
                <label key={t.id} className={OPCAO}>
                  <input
                    type="checkbox"
                    name="turmaIds"
                    value={t.id}
                    defaultChecked={turmasMarcadas.has(t.id)}
                    className={CAIXA}
                  />
                  <span>{t.rotulo}</span>
                </label>
              ))}
            </div>
          )}
          {erros.turmaIds && <p className="text-erro">{erros.turmaIds}</p>}
        </fieldset>
      )}

      {temPergunta && (
        <output className="flex flex-col gap-4 border-linha border-t border-b py-6">
          {existente &&
            (existente.jaAluno ? (
              <>
                <p className="font-semibold">
                  {existente.nome} já é aluno com esse e-mail.
                </p>
                <Link
                  href={`/painel/alunos/${existente.pessoaId}`}
                  className={LINK}
                >
                  Abrir a ficha de {existente.nome}
                </Link>
              </>
            ) : (
              <>
                <p className="font-semibold">
                  {existente.nome} já tem cadastro com esse e-mail.
                </p>
                <p className="text-texto-suave">
                  Tornar aluno usa o cadastro que já existe. Depois, complete os
                  dados e as turmas pela ficha.
                </p>
                <BotaoTornarAluno pessoaId={existente.pessoaId} />
              </>
            ))}
          {responsavelExistente && (
            <>
              <p className="font-semibold">
                {responsavelExistente.nome} já tem cadastro. Usar como
                responsável?
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
                Irmãos podem usar o número da mãe ou do pai. Se for outra
                pessoa, confira o número.
              </p>
              <Link
                href={`/painel/alunos?busca=${encodeURIComponent(v?.whatsapp ?? "")}`}
                className={LINK}
              >
                Ver alunos com esse número
              </Link>
            </>
          )}
          {(whatsappRepetido || v?.whatsappRepetido === "1") && (
            <BotaoPergunta nome="confirmarWhatsappRepetido" valor="1">
              Salvar mesmo assim
            </BotaoPergunta>
          )}
        </output>
      )}

      {/* Com a pergunta do responsável, as duas respostas já salvam. */}
      {!responsavelExistente && (
        <div className="flex flex-col gap-4">
          <MensagemErroGeral erro={erros._} />
          <BotaoEnviar carregando="Salvando…">Salvar</BotaoEnviar>
        </div>
      )}
    </form>
  );
}
