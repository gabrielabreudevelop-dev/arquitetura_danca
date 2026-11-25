"use client";

import { useActionState } from "react";
import { BotaoEnviar } from "../_formulario/botao-enviar";
import { Campo } from "../_formulario/campo";
import { ESTADO_INICIAL } from "../_formulario/estado";
import { MensagemErroGeral } from "../_formulario/mensagem";
import { useVersao } from "../alunos/[id]/formularios/acompanhar";
import { moverAlunosAcao } from "./acoes";

/** "Mover alunos para": passa quem está na turma para outra turma ativa, a partir de uma data. */
export function FormularioMoverAlunos({
  turmaId,
  destinos,
  hoje,
}: {
  turmaId: string;
  destinos: { id: string; rotulo: string }[];
  /** "AAAA-MM-DD", dia de hoje em São Paulo. */
  hoje: string;
}) {
  const [estado, acao] = useActionState(moverAlunosAcao, ESTADO_INICIAL);
  const versao = useVersao(estado);
  const erros = estado.erros ?? {};
  const v = estado.valores;
  return (
    <form key={versao} action={acao} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="deTurmaId" value={turmaId} />
      <Campo
        nome="paraTurmaId"
        rotulo="Mover alunos para"
        tipo="selecao"
        valor={v?.paraTurmaId ?? ""}
        erro={erros.paraTurmaId}
        obrigatorio
      >
        <option value="">Escolha a turma</option>
        {destinos.map((d) => (
          <option key={d.id} value={d.id}>
            {d.rotulo}
          </option>
        ))}
      </Campo>
      <Campo
        nome="data"
        rotulo="A partir de"
        tipo="data"
        valor={v?.data || hoje}
        erro={erros.data}
        obrigatorio
      />
      <div className="flex flex-col gap-4">
        <MensagemErroGeral erro={erros._} />
        <BotaoEnviar carregando="Movendo…">Mover alunos</BotaoEnviar>
      </div>
    </form>
  );
}
