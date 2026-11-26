"use client";

import { useActionState } from "react";
import { BotaoEnviar } from "../../_formulario/botao-enviar";
import { Campo } from "../../_formulario/campo";
import { ESTADO_INICIAL } from "../../_formulario/estado";
import { MensagemErroGeral } from "../../_formulario/mensagem";
import { salvarPlanoAcao } from "../acoes";

type Plano = {
  id: string;
  nome: string;
  duracaoQuantidade: number;
  duracaoUnidade: "meses" | "dias";
  ordem: number;
  ativo: boolean;
};

/** Formulário de plano: novo (sem `plano`) ou edição. Com erro, mantém o que foi digitado. */
export function FormularioPlano({ plano }: { plano?: Plano }) {
  const [estado, acao] = useActionState(salvarPlanoAcao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const v = estado.valores;
  return (
    <form action={acao} noValidate className="flex flex-col gap-6">
      {plano && <input type="hidden" name="id" value={plano.id} />}
      <Campo
        nome="nome"
        rotulo="Nome"
        valor={v?.nome ?? plano?.nome}
        erro={erros.nome}
        obrigatorio
      />
      <Campo
        nome="quantidade"
        rotulo="Duração"
        tipo="numero"
        valor={v?.quantidade ?? String(plano?.duracaoQuantidade ?? 1)}
        erro={erros.quantidade}
        atributos={{ inputMode: "numeric" }}
        obrigatorio
      />
      <Campo
        nome="unidade"
        rotulo="Em"
        tipo="selecao"
        valor={v?.unidade ?? plano?.duracaoUnidade ?? "meses"}
        erro={erros.unidade}
      >
        <option value="meses">Meses</option>
        <option value="dias">Dias</option>
      </Campo>
      <Campo
        nome="ordem"
        rotulo="Ordem"
        tipo="numero"
        valor={v?.ordem ?? String(plano?.ordem ?? 0)}
        erro={erros.ordem}
        ajuda="Na lista de planos, números menores aparecem primeiro."
        atributos={{ inputMode: "numeric" }}
        obrigatorio
      />
      <Campo
        nome="ativo"
        rotulo="Ativo (aparece ao registrar um período)"
        tipo="caixa"
        marcado={v ? v.ativo === "on" : (plano?.ativo ?? true)}
      />
      <div className="flex flex-col gap-4">
        <MensagemErroGeral erro={erros._} />
        <BotaoEnviar carregando="Salvando…">Salvar</BotaoEnviar>
      </div>
    </form>
  );
}
