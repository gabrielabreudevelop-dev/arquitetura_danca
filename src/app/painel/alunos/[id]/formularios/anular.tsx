"use client";

import { useActionState } from "react";
import { Campo } from "../../../_formulario/campo";
import { ESTADO_INICIAL } from "../../../_formulario/estado";
import { MensagemErroGeral } from "../../../_formulario/mensagem";
import { anularAcao } from "../acoes";
import type { AlvoAnular } from "../calculos";
import { BotaoEnvio } from "./botoes";

/** Anular um item do histórico: pede o motivo. Recusas do servidor aparecem como erro geral. */
export function FormularioAnular({
  alunoId,
  alvo,
}: {
  alunoId: string;
  alvo: AlvoAnular;
}) {
  const [estado, acao] = useActionState(anularAcao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const v = estado.valores;
  return (
    <form action={acao} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="id" value={alunoId} />
      <input type="hidden" name="tipo" value={alvo.tipo} />
      <input type="hidden" name="alvo" value={alvo.id} />
      <Campo
        nome="motivo"
        rotulo="Motivo"
        valor={v?.motivo}
        erro={erros.motivo}
        ajuda="Ex.: lançado no aluno errado, feriado desmarcado."
        obrigatorio
      />
      <div className="flex flex-col gap-4">
        <MensagemErroGeral erro={erros._} />
        <BotaoEnvio visual="perigoCheio" carregando="Anulando…">
          Anular
        </BotaoEnvio>
      </div>
    </form>
  );
}
