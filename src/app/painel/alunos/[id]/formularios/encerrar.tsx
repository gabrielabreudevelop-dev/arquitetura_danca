"use client";

import { useActionState } from "react";
import { Campo } from "../../../_formulario/campo";
import { ESTADO_INICIAL } from "../../../_formulario/estado";
import { MensagemErroGeral } from "../../../_formulario/mensagem";
import { encerrarAcao } from "../acoes";
import { BotaoEnvio } from "./botoes";

/** Encerrar o cadastro: data (padrão hoje) e motivo opcional. */
export function FormularioEncerrar({
  alunoId,
  hoje,
}: {
  alunoId: string;
  hoje: string;
}) {
  const [estado, acao] = useActionState(encerrarAcao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const v = estado.valores;
  return (
    <form action={acao} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="id" value={alunoId} />
      <Campo
        nome="data"
        rotulo="Data do encerramento"
        tipo="data"
        valor={v?.data ?? hoje}
        erro={erros.data}
        ajuda="As matrículas abertas saem nesta data."
        obrigatorio
      />
      <Campo
        nome="motivo"
        rotulo="Motivo (opcional)"
        valor={v?.motivo}
        erro={erros.motivo}
        ajuda="Ex.: mudou de cidade."
      />
      <div className="flex flex-col gap-4">
        <MensagemErroGeral erro={erros._} />
        <BotaoEnvio visual="perigoCheio" carregando="Encerrando…">
          Encerrar aluno
        </BotaoEnvio>
      </div>
    </form>
  );
}
