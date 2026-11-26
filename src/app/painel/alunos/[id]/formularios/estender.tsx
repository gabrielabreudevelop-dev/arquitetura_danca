"use client";

import { useActionState } from "react";
import { BotaoEnviar } from "../../../_formulario/botao-enviar";
import { Campo } from "../../../_formulario/campo";
import { ESTADO_INICIAL } from "../../../_formulario/estado";
import { MensagemErroGeral } from "../../../_formulario/mensagem";
import { estenderAcao } from "../acoes";
import { contaDaExtensao, type Unidade } from "../calculos";
import { useAcompanhar } from "./acompanhar";
import { Conta } from "./botoes";
import { CamposQuantidade, type TurmaDoFormulario } from "./quantidade";

/** Estender o último período; a conta "Fim passa de … para …" aparece abaixo do botão. */
export function FormularioEstender({
  alunoId,
  fimAtual,
  unidadePadrao,
  turmas,
}: {
  alunoId: string;
  fimAtual: string;
  unidadePadrao: Unidade;
  turmas: TurmaDoFormulario[];
}) {
  const [estado, acao] = useActionState(estenderAcao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const v = estado.valores;
  const [campos, acompanhar, versao] = useAcompanhar(
    estado,
    { quantidade: "", unidade: unidadePadrao, turmaId: "" },
    (campo) => ({
      quantidade: campo("quantidade"),
      unidade: (campo("unidade") === "aulas" ? "aulas" : "dias") as Unidade,
      turmaId: campo("turmaId"),
    }),
  );
  const conta = contaDaExtensao(
    fimAtual,
    campos.quantidade,
    campos.unidade,
    turmas,
    campos.turmaId,
  );

  return (
    <form
      key={versao}
      action={acao}
      onChange={acompanhar}
      noValidate
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="id" value={alunoId} />
      <CamposQuantidade
        valores={v}
        erros={erros}
        unidade={campos.unidade}
        unidadePadrao={unidadePadrao}
        turmas={turmas}
      />
      <Campo
        nome="motivo"
        rotulo="Motivo"
        valor={v?.motivo}
        erro={erros.motivo}
        ajuda="Ex.: feriado de 15/11, aula cancelada."
        obrigatorio
      />
      <div className="flex flex-col gap-4">
        <MensagemErroGeral erro={erros._} />
        <BotaoEnviar carregando="Salvando…">Estender</BotaoEnviar>
        <Conta texto={conta} />
      </div>
    </form>
  );
}
