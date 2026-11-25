"use client";

import { Campo } from "../../../_formulario/campo";
import type { TurmaConversao, Unidade } from "../calculos";

export type TurmaDoFormulario = TurmaConversao & { rotulo: string };

/**
 * Quantidade, unidade e (em aulas, com mais de uma turma) "Aulas de qual
 * turma?". Sem matrícula aberta, só dias. Usado em Estender e Transferir.
 */
export function CamposQuantidade({
  valores,
  erros,
  unidade,
  unidadePadrao,
  turmas,
}: {
  valores?: Record<string, string>;
  erros: Record<string, string>;
  /** Unidade escolhida agora (decide se a turma aparece). */
  unidade: Unidade;
  unidadePadrao: Unidade;
  turmas: TurmaDoFormulario[];
}) {
  const comAulas = turmas.length > 0;
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Campo
          nome="quantidade"
          rotulo="Quantidade"
          tipo="numero"
          valor={valores?.quantidade}
          erro={erros.quantidade}
          atributos={{ inputMode: "numeric", min: 1, step: 1 }}
          obrigatorio
        />
        <Campo
          nome="unidade"
          rotulo="Em"
          tipo="selecao"
          valor={valores?.unidade ?? unidadePadrao}
          erro={erros.unidade}
          ajuda={comAulas ? undefined : "Sem turma, só em dias."}
        >
          <option value="dias">Dias</option>
          {comAulas && <option value="aulas">Aulas</option>}
        </Campo>
      </div>
      {unidade === "aulas" && turmas.length > 1 && (
        <Campo
          nome="turmaId"
          rotulo="Aulas de qual turma?"
          tipo="selecao"
          valor={valores?.turmaId ?? ""}
          erro={erros.turmaId}
          obrigatorio
        >
          <option value="">Escolha a turma</option>
          {turmas.map((t) => (
            <option key={t.turmaId} value={t.turmaId}>
              {t.rotulo}
            </option>
          ))}
        </Campo>
      )}
    </>
  );
}
