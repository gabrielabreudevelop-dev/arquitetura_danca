"use client";

import { useActionState } from "react";
import { BotaoEnviar } from "../../../_formulario/botao-enviar";
import { Campo } from "../../../_formulario/campo";
import { ESTADO_INICIAL } from "../../../_formulario/estado";
import { MensagemErroGeral } from "../../../_formulario/mensagem";
import { trancarAcao } from "../acoes";
import { contaDaPausa } from "../calculos";
import { useAcompanhar } from "./acompanhar";
import { Conta } from "./botoes";

/**
 * Trancar: início (padrão hoje, ou o início do período se ele ainda não começou), "Sei a data de volta" + volta e motivo. A
 * volta só aparece com a caixa marcada (por CSS, também sem JavaScript).
 */
export function FormularioTrancar({
  alunoId,
  inicioPadrao,
  fimAtual,
}: {
  alunoId: string;
  inicioPadrao: string;
  fimAtual: string;
}) {
  const [estado, acao] = useActionState(trancarAcao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const v = estado.valores;
  const [campos, acompanhar, versao] = useAcompanhar(
    estado,
    { inicio: inicioPadrao, sabeVolta: false, volta: "" },
    (campo) => ({
      inicio: campo("inicio"),
      sabeVolta: campo("sabeVolta") === "on",
      volta: campo("volta"),
    }),
  );
  const conta = campos.sabeVolta
    ? contaDaPausa(campos.inicio, campos.volta, fimAtual)
    : null;

  return (
    <form
      key={versao}
      action={acao}
      onChange={acompanhar}
      noValidate
      className="group flex flex-col gap-6"
    >
      <input type="hidden" name="id" value={alunoId} />
      <Campo
        nome="inicio"
        rotulo="Início"
        tipo="data"
        valor={v?.inicio ?? inicioPadrao}
        erro={erros.inicio}
        obrigatorio
      />
      <Campo
        nome="sabeVolta"
        rotulo="Sei a data de volta"
        tipo="caixa"
        marcado={v ? v.sabeVolta === "on" : false}
      />
      <div className="hidden group-has-[#sabeVolta:checked]:block">
        <Campo
          nome="volta"
          rotulo="Volta"
          tipo="data"
          valor={v?.volta}
          erro={erros.volta}
          ajuda="O primeiro dia de aula na volta."
        />
      </div>
      <Campo
        nome="motivo"
        rotulo="Motivo (opcional)"
        valor={v?.motivo}
        erro={erros.motivo}
        ajuda="Ex.: viagem, cirurgia."
      />
      <div className="flex flex-col gap-4">
        <MensagemErroGeral erro={erros._} />
        <BotaoEnviar carregando="Salvando…">Trancar</BotaoEnviar>
        <Conta
          texto={
            conta ??
            (campos.sabeVolta
              ? null
              : "Sem a volta, o período fica trancado até você destrancar.")
          }
        />
      </div>
    </form>
  );
}
