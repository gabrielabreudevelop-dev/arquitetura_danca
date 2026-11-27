"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { DataIso } from "@/servidor/alunos/datas";
import { BotaoEnviar } from "../_formulario/botao-enviar";
import { ESTADO_INICIAL } from "../_formulario/estado";
import { MensagemErroGeral } from "../_formulario/mensagem";
import {
  BotaoPadrao,
  CAIXA,
  CamposPessoa,
  LINK_PERGUNTA,
  OPCAO,
  PerguntasPessoa,
  type PessoaParaEditar,
  SECUNDARIO,
} from "../_pessoa/campos";
import {
  atualizarAlunoAcao,
  cadastrarAlunoAcao,
  tornarAlunoAcao,
} from "./acoes";
import type { EstadoAluno } from "./estado";

export type AlunoParaEditar = PessoaParaEditar;

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
 * Formulário de aluno: novo (com `turmas`) ou edição (com `aluno`). Os campos
 * da pessoa e as perguntas do serviço (responsável já cadastrado, WhatsApp
 * repetido) vêm de `_pessoa/campos`; a de e-mail de outra pessoa ("Tornar
 * aluno") é daqui. As perguntas aparecem acima do botão.
 */
export function FormularioAluno({
  aluno,
  turmas,
  hoje,
  depois,
}: {
  aluno?: AlunoParaEditar;
  /** Turmas ativas, só no cadastro. */
  turmas?: { id: string; rotulo: string }[];
  hoje: DataIso;
  /** Só no cadastro: para onde voltar depois de salvar (já validado por `lerDepois`). */
  depois?: string;
}) {
  const [estado, acao] = useActionState<EstadoAluno, FormData>(
    aluno ? atualizarAlunoAcao : cadastrarAlunoAcao,
    ESTADO_INICIAL,
  );
  const erros = estado.erros ?? {};
  const v = estado.valores;
  const turmasMarcadas = new Set(v?.turmaIds?.split(",") ?? []);
  const existente = estado.existente;

  return (
    <form action={acao} noValidate className="flex flex-col gap-6">
      <BotaoPadrao />
      {aluno && <input type="hidden" name="id" value={aluno.id} />}
      {depois && <input type="hidden" name="depois" value={depois} />}
      <CamposPessoa
        estado={estado}
        pessoa={aluno}
        hoje={hoje}
        ajudaEmail="Opcional. É por ele que o aluno vai entrar na plataforma."
      />

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

      <PerguntasPessoa
        estado={estado}
        verMesmoNumero={{
          href: `/painel/alunos?busca=${encodeURIComponent(v?.whatsapp ?? "")}`,
          rotulo: "Ver alunos com esse número",
        }}
        existente={
          existente &&
          (existente.jaAluno ? (
            <>
              <p className="font-semibold">
                {existente.nome} já é aluno com esse e-mail.
              </p>
              <Link
                href={`/painel/alunos/${existente.pessoaId}`}
                className={LINK_PERGUNTA}
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
          ))
        }
      />

      {/* Com a pergunta do responsável, as duas respostas já salvam. */}
      {!estado.responsavelExistente && (
        <div className="flex flex-col gap-4">
          <MensagemErroGeral erro={erros._} />
          <BotaoEnviar carregando="Salvando…">Salvar</BotaoEnviar>
        </div>
      )}
    </form>
  );
}
