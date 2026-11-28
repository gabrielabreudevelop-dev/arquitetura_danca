"use client";

import { useActionState } from "react";
import { BotaoEnviar } from "../../../_formulario/botao-enviar";
import { Campo } from "../../../_formulario/campo";
import { ESTADO_INICIAL } from "../../../_formulario/estado";
import { MensagemErroGeral } from "../../../_formulario/mensagem";
import { useVersao } from "../../../alunos/[id]/formularios/acompanhar";
import { CampoDias } from "../../campos";
import { diasMarcados } from "../../dados";
import { alterarDiasAcao } from "../acoes";

/** Alterar os dias combinados: dias e "vigente desde" (padrão hoje, nunca no futuro). */
export function FormularioDias({
  bolsistaId,
  diasAtuais,
  hoje,
}: {
  bolsistaId: string;
  diasAtuais: number[];
  hoje: string;
}) {
  const [estado, acao] = useActionState(alterarDiasAcao, ESTADO_INICIAL);
  // Caixas guardam o padrão da montagem: remontar as põe nos valores devolvidos.
  const versao = useVersao(estado);
  const erros = estado.erros ?? {};
  const v = estado.valores;
  return (
    <form key={versao} action={acao} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="id" value={bolsistaId} />
      <CampoDias
        marcados={v ? diasMarcados(v.dias) : new Set(diasAtuais)}
        erro={erros.dias}
        ajuda="Ao menos um. Os dias de antes ficam no histórico."
      />
      <Campo
        nome="vigenteDesde"
        rotulo="Vigente desde"
        tipo="data"
        valor={v?.vigenteDesde ?? hoje}
        erro={erros.vigenteDesde}
        ajuda="Pode ser no passado, para corrigir. Nunca no futuro."
        atributos={{ max: hoje }}
        obrigatorio
      />
      <div className="flex flex-col gap-4">
        <MensagemErroGeral erro={erros._} />
        <BotaoEnviar carregando="Salvando…">Salvar dias</BotaoEnviar>
      </div>
    </form>
  );
}
