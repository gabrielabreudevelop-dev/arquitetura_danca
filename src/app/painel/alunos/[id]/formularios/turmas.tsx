"use client";

import { useActionState } from "react";
import { BotaoEnviar } from "../../../_formulario/botao-enviar";
import { Campo } from "../../../_formulario/campo";
import { ESTADO_INICIAL } from "../../../_formulario/estado";
import { MensagemErroGeral } from "../../../_formulario/mensagem";
import { matricularAcao, tirarDaTurmaAcao, trocarDeTurmaAcao } from "../acoes";
import { useVersao } from "./acompanhar";
import { BotaoEnvio } from "./botoes";

export type OpcaoTurma = { id: string; rotulo: string };

const RESUMO =
  "-mx-2 flex min-h-12 cursor-pointer items-center self-start px-2 font-semibold text-link underline decoration-link underline-offset-4";

/** Matricular numa turma ativa em que o aluno não está (entrada padrão hoje). */
export function FormularioMatricular({
  alunoId,
  turmas,
  hoje,
}: {
  alunoId: string;
  turmas: OpcaoTurma[];
  hoje: string;
}) {
  const [estado, acao] = useActionState(matricularAcao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const v = estado.valores;
  const versao = useVersao(estado);
  return (
    <form key={versao} action={acao} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="id" value={alunoId} />
      <Campo
        nome="turmaId"
        rotulo="Turma"
        tipo="selecao"
        valor={v?.turmaId ?? ""}
        erro={erros.turmaId}
        obrigatorio
      >
        <option value="">Escolha a turma</option>
        {turmas.map((t) => (
          <option key={t.id} value={t.id}>
            {t.rotulo}
          </option>
        ))}
      </Campo>
      <Campo
        nome="entrada"
        rotulo="Entrada"
        tipo="data"
        valor={v?.entrada ?? hoje}
        erro={erros.entrada}
        obrigatorio
      />
      <div className="flex flex-col gap-4">
        <MensagemErroGeral erro={erros._} />
        <BotaoEnviar carregando="Salvando…">Matricular</BotaoEnviar>
      </div>
    </form>
  );
}

/** "Trocar de turma": nova turma e data (saída de uma e entrada na outra). Abre sozinho com erro. */
export function FormularioTrocar({
  alunoId,
  matriculaId,
  turmas,
  hoje,
}: {
  alunoId: string;
  matriculaId: string;
  turmas: OpcaoTurma[];
  hoje: string;
}) {
  const [estado, acao] = useActionState(trocarDeTurmaAcao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const v = estado.valores;
  const versao = useVersao(estado);
  if (turmas.length === 0) return null;
  return (
    <details open={estado.erros ? true : undefined}>
      <summary className={RESUMO}>Trocar de turma</summary>
      <form
        key={versao}
        action={acao}
        noValidate
        className="flex flex-col gap-6 pt-4"
      >
        <input type="hidden" name="id" value={alunoId} />
        <input type="hidden" name="matriculaId" value={matriculaId} />
        <Campo
          nome="novaTurmaId"
          id={`${matriculaId}-novaTurmaId`}
          rotulo="Nova turma"
          tipo="selecao"
          valor={v?.novaTurmaId ?? ""}
          erro={erros.novaTurmaId}
          obrigatorio
        >
          <option value="">Escolha a turma</option>
          {turmas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.rotulo}
            </option>
          ))}
        </Campo>
        <Campo
          nome="data"
          id={`${matriculaId}-data`}
          rotulo="Data da troca"
          tipo="data"
          valor={v?.data ?? hoje}
          erro={erros.data}
          ajuda="Sai da turma atual e entra na nova nesta data."
          obrigatorio
        />
        <div className="flex flex-col gap-4">
          <MensagemErroGeral erro={erros._} />
          <BotaoEnvio visual="secundario" carregando="Salvando…">
            Trocar
          </BotaoEnvio>
        </div>
      </form>
    </details>
  );
}

/** "Tirar da turma": data de saída (padrão hoje). Abre sozinho com erro. */
export function FormularioTirar({
  alunoId,
  matriculaId,
  hoje,
}: {
  alunoId: string;
  matriculaId: string;
  hoje: string;
}) {
  const [estado, acao] = useActionState(tirarDaTurmaAcao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const v = estado.valores;
  const versao = useVersao(estado);
  return (
    <details open={estado.erros ? true : undefined}>
      <summary className={RESUMO}>Tirar da turma</summary>
      <form
        key={versao}
        action={acao}
        noValidate
        className="flex flex-col gap-6 pt-4"
      >
        <input type="hidden" name="id" value={alunoId} />
        <input type="hidden" name="matriculaId" value={matriculaId} />
        <Campo
          nome="saida"
          id={`${matriculaId}-saida`}
          rotulo="Saída"
          tipo="data"
          valor={v?.saida ?? hoje}
          erro={erros.saida}
          ajuda="O histórico da turma fica guardado."
          obrigatorio
        />
        <div className="flex flex-col gap-4">
          <MensagemErroGeral erro={erros._} />
          <BotaoEnvio visual="perigo" carregando="Salvando…">
            Tirar da turma
          </BotaoEnvio>
        </div>
      </form>
    </details>
  );
}
