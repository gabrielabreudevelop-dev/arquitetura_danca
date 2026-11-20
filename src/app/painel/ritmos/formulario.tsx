"use client";

import { useActionState } from "react";
import { BotaoEnviar } from "../_formulario/botao-enviar";
import { Campo } from "../_formulario/campo";
import { ESTADO_INICIAL } from "../_formulario/estado";
import { MensagemErroGeral } from "../_formulario/mensagem";
import { salvarRitmoAcao } from "./acoes";

type Ritmo = {
  id: string;
  nome: string;
  slug: string;
  ordem: number;
  ativo: boolean;
};

/** Formulário de ritmo: novo (sem `ritmo`) ou edição. Com erro, mantém o que foi digitado. */
export function FormularioRitmo({ ritmo }: { ritmo?: Ritmo }) {
  const [estado, acao] = useActionState(salvarRitmoAcao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const v = estado.valores;
  return (
    <form action={acao} noValidate className="flex flex-col gap-6">
      {ritmo && <input type="hidden" name="id" value={ritmo.id} />}
      <Campo
        nome="nome"
        rotulo="Nome"
        valor={v?.nome ?? ritmo?.nome}
        erro={erros.nome}
        obrigatorio
      />
      <Campo
        nome="slug"
        rotulo="Endereço na grade"
        valor={v?.slug ?? ritmo?.slug}
        erro={erros.slug}
        ajuda={
          ritmo
            ? "Mudar o endereço faz links antigos da grade deixarem de funcionar."
            : "Deixe em branco para criar a partir do nome."
        }
        atributos={{ autoCapitalize: "none", spellCheck: false }}
      />
      <Campo
        nome="ordem"
        rotulo="Ordem"
        tipo="numero"
        valor={v?.ordem ?? String(ritmo?.ordem ?? 0)}
        erro={erros.ordem}
        ajuda="Na grade pública, números menores aparecem primeiro."
        atributos={{ inputMode: "numeric" }}
        obrigatorio
      />
      <Campo
        nome="ativo"
        rotulo="Ativo (aparece na grade pública)"
        tipo="caixa"
        marcado={v ? v.ativo === "on" : (ritmo?.ativo ?? true)}
      />
      <div className="flex flex-col gap-4">
        <MensagemErroGeral erro={erros._} />
        <BotaoEnviar carregando="Salvando…">Salvar</BotaoEnviar>
      </div>
    </form>
  );
}
