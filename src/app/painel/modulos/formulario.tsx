"use client";

import { useActionState } from "react";
import { BotaoEnviar } from "../_formulario/botao-enviar";
import { Campo } from "../_formulario/campo";
import { ESTADO_INICIAL } from "../_formulario/estado";
import { MensagemErroGeral } from "../_formulario/mensagem";
import { salvarModuloAcao } from "./acoes";

type Modulo = { id: string; nome: string; ordem: number; ativo: boolean };

/** Formulário de módulo: novo (sem `modulo`) ou edição. Com erro, mantém o que foi digitado. */
export function FormularioModulo({ modulo }: { modulo?: Modulo }) {
  const [estado, acao] = useActionState(salvarModuloAcao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const v = estado.valores;
  return (
    <form action={acao} noValidate className="flex flex-col gap-6">
      {modulo && <input type="hidden" name="id" value={modulo.id} />}
      <Campo
        nome="nome"
        rotulo="Nome"
        valor={v?.nome ?? modulo?.nome}
        erro={erros.nome}
        obrigatorio
      />
      <Campo
        nome="ordem"
        rotulo="Ordem"
        tipo="numero"
        valor={v?.ordem ?? String(modulo?.ordem ?? 0)}
        erro={erros.ordem}
        ajuda="Números menores aparecem primeiro."
        atributos={{ inputMode: "numeric" }}
        obrigatorio
      />
      <Campo
        nome="ativo"
        rotulo="Ativo"
        tipo="caixa"
        marcado={v ? v.ativo === "on" : (modulo?.ativo ?? true)}
      />
      <div className="flex flex-col gap-4">
        <MensagemErroGeral erro={erros._} />
        <BotaoEnviar carregando="Salvando…">Salvar</BotaoEnviar>
      </div>
    </form>
  );
}
