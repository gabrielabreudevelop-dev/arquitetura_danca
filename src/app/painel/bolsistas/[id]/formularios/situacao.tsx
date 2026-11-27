"use client";

import { useActionState } from "react";
import { BotaoEnviar } from "../../../_formulario/botao-enviar";
import { Campo } from "../../../_formulario/campo";
import { ESTADO_INICIAL } from "../../../_formulario/estado";
import { MensagemErroGeral } from "../../../_formulario/mensagem";
import { mudarSituacaoAcao } from "../acoes";

/**
 * Inativar (com motivo opcional) ou reativar a bolsa: data com padrão hoje,
 * nunca no futuro nem antes da última mudança (`desde`, se houver).
 */
export function FormularioSituacao({
  bolsistaId,
  tipo,
  hoje,
  desde,
}: {
  bolsistaId: string;
  tipo: "ativacao" | "inativacao";
  hoje: string;
  /** Data da última mudança de situação ("DD/MM/AAAA"), para a ajuda. */
  desde: { iso: string; texto: string } | null;
}) {
  const [estado, acao] = useActionState(mudarSituacaoAcao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const v = estado.valores;
  const inativar = tipo === "inativacao";
  const ajuda = desde
    ? `Pode ser no passado, a partir de ${desde.texto} (última mudança). Nunca no futuro.`
    : "Pode ser no passado. Nunca no futuro.";
  return (
    <form action={acao} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="id" value={bolsistaId} />
      <input type="hidden" name="tipo" value={tipo} />
      <Campo
        nome="data"
        rotulo={inativar ? "Inativo desde" : "Ativo de novo desde"}
        tipo="data"
        valor={v?.data ?? hoje}
        erro={erros.data}
        ajuda={ajuda}
        atributos={{ max: hoje, min: desde?.iso }}
        obrigatorio
      />
      {inativar && (
        <Campo
          nome="motivo"
          rotulo="Motivo (opcional)"
          valor={v?.motivo}
          erro={erros.motivo}
          ajuda="Ex.: começou a trabalhar à noite."
        />
      )}
      <div className="flex flex-col gap-4">
        <MensagemErroGeral erro={erros._} />
        <BotaoEnviar carregando="Salvando…">
          {inativar ? "Inativar bolsista" : "Reativar bolsista"}
        </BotaoEnviar>
      </div>
    </form>
  );
}
