"use client";

import { useActionState } from "react";
import { ESTADO_INICIAL } from "../../../_formulario/estado";
import { MensagemErroGeral } from "../../../_formulario/mensagem";
import { desfazerNaoQuerContatoAcao, naoQuerContatoAcao } from "../acoes";
import { BotaoEnvio } from "./botoes";

/**
 * "Não quer contato" ou, com a marca já feita, "Voltou a aceitar contato".
 * A marca é da pessoa que recebe as mensagens do aluno.
 */
export function FormularioNaoQuerContato({
  alunoId,
  marcado,
}: {
  alunoId: string;
  marcado: boolean;
}) {
  const [estado, acao] = useActionState(
    marcado ? desfazerNaoQuerContatoAcao : naoQuerContatoAcao,
    ESTADO_INICIAL,
  );
  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={alunoId} />
      <MensagemErroGeral erro={estado.erros?._} />
      <BotaoEnvio visual="secundario" carregando="Salvando…">
        {marcado ? "Voltou a aceitar contato" : "Não quer contato"}
      </BotaoEnvio>
    </form>
  );
}
