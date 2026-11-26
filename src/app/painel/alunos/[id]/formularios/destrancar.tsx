"use client";

import { useActionState } from "react";
import { BotaoEnviar } from "../../../_formulario/botao-enviar";
import { Campo } from "../../../_formulario/campo";
import { ESTADO_INICIAL } from "../../../_formulario/estado";
import { MensagemErroGeral } from "../../../_formulario/mensagem";
import { destrancarAcao } from "../acoes";
import { contaDaPausa } from "../calculos";
import { useAcompanhar } from "./acompanhar";
import { Conta } from "./botoes";

/** Destrancar: data de volta (padrão hoje) e a conta dos dias parados. */
export function FormularioDestrancar({
  alunoId,
  trancamentoId,
  inicio,
  hoje,
  fimAtual,
}: {
  alunoId: string;
  trancamentoId: string;
  inicio: string;
  hoje: string;
  fimAtual: string | null;
}) {
  const [estado, acao] = useActionState(destrancarAcao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const v = estado.valores;
  const [campos, acompanhar, versao] = useAcompanhar(
    estado,
    { volta: hoje },
    (c) => ({
      volta: c("volta"),
    }),
  );
  const conta = contaDaPausa(inicio, campos.volta, fimAtual);

  return (
    <form
      key={versao}
      action={acao}
      onChange={acompanhar}
      noValidate
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="id" value={alunoId} />
      <input type="hidden" name="trancamentoId" value={trancamentoId} />
      <Campo
        nome="volta"
        rotulo="Volta"
        tipo="data"
        valor={v?.volta ?? hoje}
        erro={erros.volta}
        ajuda="O primeiro dia de aula na volta."
        obrigatorio
      />
      <div className="flex flex-col gap-4">
        <MensagemErroGeral erro={erros._} />
        <BotaoEnviar carregando="Salvando…">Destrancar</BotaoEnviar>
        <Conta
          texto={
            conta ??
            (erros.volta
              ? null
              : "A volta precisa ser depois do início do trancamento.")
          }
        />
      </div>
    </form>
  );
}
