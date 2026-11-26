"use client";

import { useActionState } from "react";
import { BotaoEnviar } from "../_formulario/botao-enviar";
import { ESTADO_INICIAL } from "../_formulario/estado";
import { MensagemErroGeral } from "../_formulario/mensagem";
import { salvarUnidadeAcao } from "./acoes";

const OPCOES = [
  { valor: "dias", rotulo: "Dias" },
  { valor: "aulas", rotulo: "Aulas" },
];

/** Escolha da unidade padrão dos ajustes (dias ou aulas). */
export function FormularioUnidade({ atual }: { atual: "dias" | "aulas" }) {
  const [estado, acao] = useActionState(salvarUnidadeAcao, ESTADO_INICIAL);
  const escolhida = estado.valores?.unidade ?? atual;
  return (
    <form action={acao} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-1">
        <legend className="font-semibold">Contar ajustes em</legend>
        {OPCOES.map((o) => (
          <label
            key={o.valor}
            className="-mx-2 flex min-h-12 items-center gap-3 px-2"
          >
            <input
              type="radio"
              name="unidade"
              value={o.valor}
              defaultChecked={escolhida === o.valor}
              className="size-6 shrink-0 accent-acao"
            />
            <span>{o.rotulo}</span>
          </label>
        ))}
      </fieldset>
      <MensagemErroGeral erro={estado.erros?.unidade ?? estado.erros?._} />
      {estado.valores?.salvo && !estado.erros && (
        <output className="text-sucesso">Salvo.</output>
      )}
      <BotaoEnviar carregando="Salvando…">Salvar</BotaoEnviar>
    </form>
  );
}
