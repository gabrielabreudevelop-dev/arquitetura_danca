"use client";

import { useActionState } from "react";
import { Campo } from "../../_formulario/campo";
import { ESTADO_INICIAL } from "../../_formulario/estado";
import { MensagemErroGeral } from "../../_formulario/mensagem";
import { BotaoEnvio } from "../[id]/formularios/botoes";
import { anularLoteAcao } from "./acoes";

/** "Anular lote": pede o motivo; fica recolhido até a pessoa abrir. */
export function FormularioAnularLote({ loteId }: { loteId: string }) {
  const [estado, acao] = useActionState(anularLoteAcao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const aberto = Boolean(estado.erros);
  return (
    <details open={aberto || undefined} className="group">
      <summary className="-mx-2 flex min-h-12 cursor-pointer items-center px-2 font-semibold text-link underline decoration-link underline-offset-4">
        Anular lote
      </summary>
      <form action={acao} noValidate className="flex flex-col gap-6 pt-2">
        <input type="hidden" name="loteId" value={loteId} />
        <Campo
          id={`motivo-${loteId}`}
          nome="motivo"
          rotulo="Motivo da anulação"
          valor={estado.valores?.motivo}
          erro={erros.motivo}
          ajuda="Os dias deste lote deixam de contar para todos os alunos."
          obrigatorio
        />
        <div className="flex flex-col gap-4">
          <MensagemErroGeral erro={erros._} />
          <BotaoEnvio visual="perigoCheio" carregando="Anulando…">
            Anular lote
          </BotaoEnvio>
        </div>
      </form>
    </details>
  );
}
