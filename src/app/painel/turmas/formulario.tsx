"use client";

import { useActionState } from "react";
import { DIAS_SEMANA } from "@/servidor/vitrine/texto";
import { BotaoEnviar } from "../_formulario/botao-enviar";
import { Campo } from "../_formulario/campo";
import { ESTADO_INICIAL } from "../_formulario/estado";
import { MensagemErroGeral } from "../_formulario/mensagem";
import { salvarTurmaAcao } from "./acoes";

type Opcao = { id: string; nome: string; ativo: boolean };

type Turma = {
  id: string;
  ritmoId: string;
  moduloId: string;
  professorId: string;
  dias: number[];
  horarioInicio: string;
  horarioFim: string;
  linkGrupoWhatsapp: string | null;
  ativa: boolean;
};

type Props = {
  turma?: Turma;
  opcoes: { ritmos: Opcao[]; modulos: Opcao[]; professores: Opcao[] };
};

function Opcoes({ lista, vazio }: { lista: Opcao[]; vazio: string }) {
  return (
    <>
      <option value="">{vazio}</option>
      {lista.map((o) => (
        <option key={o.id} value={o.id}>
          {o.ativo ? o.nome : `${o.nome} (desativado)`}
        </option>
      ))}
    </>
  );
}

/** Formulário de turma: nova (sem `turma`) ou edição. Com erro, mantém o que foi digitado. */
export function FormularioTurma({ turma, opcoes }: Props) {
  const [estado, acao] = useActionState(salvarTurmaAcao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const v = estado.valores;
  const diasMarcados = v
    ? v.dias.split(",").filter(Boolean).map(Number)
    : (turma?.dias ?? []);
  return (
    <form action={acao} noValidate className="flex flex-col gap-6">
      {turma && <input type="hidden" name="id" value={turma.id} />}
      <Campo
        nome="ritmoId"
        rotulo="Ritmo"
        tipo="selecao"
        valor={v?.ritmoId ?? turma?.ritmoId ?? ""}
        erro={erros.ritmoId}
        obrigatorio
      >
        <Opcoes lista={opcoes.ritmos} vazio="Escolha o ritmo" />
      </Campo>
      <Campo
        nome="moduloId"
        rotulo="Módulo"
        tipo="selecao"
        valor={v?.moduloId ?? turma?.moduloId ?? ""}
        erro={erros.moduloId}
        obrigatorio
      >
        <Opcoes lista={opcoes.modulos} vazio="Escolha o módulo" />
      </Campo>
      <Campo
        nome="professorId"
        rotulo="Professor"
        tipo="selecao"
        valor={v?.professorId ?? turma?.professorId ?? ""}
        erro={erros.professorId}
        ajuda="O nome do professor não aparece no site público."
        obrigatorio
      >
        <Opcoes lista={opcoes.professores} vazio="Escolha o professor" />
      </Campo>

      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={erros.dias ? "dias-erro" : undefined}
      >
        <legend className="font-semibold">Dias da semana</legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {DIAS_SEMANA.map((d) => (
            <label key={d.numero} className="block">
              <input
                type="checkbox"
                name="dias"
                value={d.numero}
                defaultChecked={diasMarcados.includes(d.numero)}
                className="peer sr-only"
              />
              <span className="flex min-h-12 cursor-pointer items-center justify-center rounded-sm border border-borda font-semibold peer-checked:border-acao peer-checked:bg-acao peer-checked:text-fundo peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-link">
                {d.exibicao}
              </span>
            </label>
          ))}
        </div>
        {erros.dias && (
          <p id="dias-erro" className="text-erro">
            {erros.dias}
          </p>
        )}
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <Campo
          nome="horarioInicio"
          rotulo="Início"
          tipo="hora"
          valor={v?.horarioInicio ?? turma?.horarioInicio.slice(0, 5)}
          erro={erros.horarioInicio}
          atributos={{ step: 1800 }}
          obrigatorio
        />
        <Campo
          nome="horarioFim"
          rotulo="Fim"
          tipo="hora"
          valor={v?.horarioFim ?? turma?.horarioFim.slice(0, 5)}
          erro={erros.horarioFim}
          atributos={{ step: 1800 }}
          obrigatorio
        />
      </div>

      <Campo
        nome="linkGrupoWhatsapp"
        rotulo="Link do grupo de WhatsApp"
        tipo="url"
        valor={v?.linkGrupoWhatsapp ?? turma?.linkGrupoWhatsapp ?? ""}
        erro={erros.linkGrupoWhatsapp}
        ajuda="Opcional. Link de convite, começando por https://chat.whatsapp.com/"
        atributos={{ autoCapitalize: "none", spellCheck: false }}
      />
      <Campo
        nome="ativa"
        rotulo="Ativa (aparece na grade pública)"
        tipo="caixa"
        marcado={v ? v.ativa === "on" : (turma?.ativa ?? true)}
      />
      <div className="flex flex-col gap-4">
        <MensagemErroGeral erro={erros._} />
        <BotaoEnviar carregando="Salvando…">Salvar</BotaoEnviar>
      </div>
    </form>
  );
}
