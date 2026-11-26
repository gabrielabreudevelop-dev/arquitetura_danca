"use client";

import { type FormEvent, useActionState } from "react";
import { BotaoEnviar } from "../../../_formulario/botao-enviar";
import { Campo } from "../../../_formulario/campo";
import { ESTADO_INICIAL } from "../../../_formulario/estado";
import { MensagemErroGeral } from "../../../_formulario/mensagem";
import { registrarPeriodoAcao } from "../acoes";
import { fimPeloPlanoOuVazio } from "../calculos";
import { useVersao } from "./acompanhar";

export type PlanoDoFormulario = {
  id: string;
  nome: string;
  quantidade: number;
  unidade: "meses" | "dias";
  /** "3 meses". */
  duracao: string;
};

/**
 * Registrar, renovar ou corrigir um período. Ao mudar o plano ou o início, o
 * fim é recalculado pelo plano (e continua editável para acordos especiais).
 */
export function FormularioPeriodo({
  alunoId,
  planos,
  inicial,
  corrigir,
  botao,
  ajudaInicio,
}: {
  alunoId: string;
  planos: PlanoDoFormulario[];
  inicial: { planoId: string; inicio: string; fim: string };
  corrigir?: string;
  botao: string;
  ajudaInicio?: string;
}) {
  const [estado, acao] = useActionState(registrarPeriodoAcao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const v = estado.valores;
  const versao = useVersao(estado);

  function recalcularFim(e: FormEvent<HTMLFormElement>) {
    const alvo = e.target as HTMLInputElement;
    if (alvo.name !== "planoId" && alvo.name !== "inicio") return;
    const campos = e.currentTarget.elements;
    const planoId = (campos.namedItem("planoId") as HTMLSelectElement).value;
    const inicio = (campos.namedItem("inicio") as HTMLInputElement).value;
    const plano = planos.find((p) => p.id === planoId);
    const fim = fimPeloPlanoOuVazio(inicio, plano);
    if (fim) (campos.namedItem("fim") as HTMLInputElement).value = fim;
  }

  return (
    <form
      key={versao}
      action={acao}
      onChange={recalcularFim}
      noValidate
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="id" value={alunoId} />
      {corrigir && <input type="hidden" name="corrigir" value={corrigir} />}
      <Campo
        nome="planoId"
        rotulo="Plano"
        tipo="selecao"
        valor={v?.planoId ?? inicial.planoId}
        erro={erros.planoId}
        obrigatorio
      >
        <option value="">Escolha o plano</option>
        {planos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome} ({p.duracao})
          </option>
        ))}
      </Campo>
      <Campo
        nome="inicio"
        rotulo="Início"
        tipo="data"
        valor={v?.inicio ?? inicial.inicio}
        erro={erros.inicio}
        ajuda={ajudaInicio}
        obrigatorio
      />
      <Campo
        nome="fim"
        rotulo="Fim"
        tipo="data"
        valor={v?.fim ?? inicial.fim}
        erro={erros.fim}
        ajuda="Calculado pelo plano. Mude só em acordos especiais."
        obrigatorio
      />
      <div className="flex flex-col gap-4">
        <MensagemErroGeral erro={erros._} />
        <BotaoEnviar carregando="Salvando…">{botao}</BotaoEnviar>
      </div>
    </form>
  );
}
