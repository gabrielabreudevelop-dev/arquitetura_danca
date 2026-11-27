"use client";

import { useActionState } from "react";
import { ESTADO_INICIAL } from "../../../_formulario/estado";
import { MensagemErroGeral } from "../../../_formulario/mensagem";
import { BotaoEnvio } from "../../../alunos/[id]/formularios/botoes";
import {
  desfazerNaoQuerContatoBolsistaAcao,
  naoQuerContatoBolsistaAcao,
} from "../acoes";

/**
 * "Não quer contato" ou, com a marca já feita, "Voltou a aceitar contato".
 * A marca é da pessoa que recebe as mensagens do bolsista.
 */
export function FormularioNaoQuerContatoBolsista({
  bolsistaId,
  marcado,
}: {
  bolsistaId: string;
  marcado: boolean;
}) {
  const [estado, acao] = useActionState(
    marcado ? desfazerNaoQuerContatoBolsistaAcao : naoQuerContatoBolsistaAcao,
    ESTADO_INICIAL,
  );
  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={bolsistaId} />
      <MensagemErroGeral erro={estado.erros?._} />
      <BotaoEnvio visual="secundario" carregando="Salvando…">
        {marcado ? "Voltou a aceitar contato" : "Não quer contato"}
      </BotaoEnvio>
    </form>
  );
}
