"use client";

import { useActionState } from "react";
import { BotaoEnviar } from "../../_formulario/botao-enviar";
import { Campo } from "../../_formulario/campo";
import { ESTADO_INICIAL } from "../../_formulario/estado";
import { MensagemErroGeral } from "../../_formulario/mensagem";
import { salvarMensagemAcao } from "../acoes";

type Mensagem = {
  id: string;
  nome: string;
  finalidade: "renovacao" | "retorno";
  texto: string;
  ativa: boolean;
};

const CAMPOS = [
  ["{nome}", "primeiro nome de quem recebe"],
  ["{aluno}", "primeiro nome do aluno"],
  ["{turma}", "ritmo e módulo da turma do aluno"],
  ["{fim}", "fim do período, como 08/12"],
];

/**
 * Formulário de mensagem pronta. A prévia vem do servidor: `previaInicial` ao
 * abrir a edição, ou a que a ação devolve quando o salvamento dá erro.
 */
export function FormularioMensagem({
  mensagem,
  previaInicial,
}: {
  mensagem?: Mensagem;
  previaInicial?: string;
}) {
  const [estado, acao] = useActionState(salvarMensagemAcao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const v = estado.valores;
  const previa = v?.previa ?? previaInicial;
  return (
    <form action={acao} noValidate className="flex flex-col gap-6">
      {mensagem && <input type="hidden" name="id" value={mensagem.id} />}
      <Campo
        nome="nome"
        rotulo="Nome"
        valor={v?.nome ?? mensagem?.nome}
        erro={erros.nome}
        obrigatorio
      />
      <Campo
        nome="finalidade"
        rotulo="Finalidade"
        tipo="selecao"
        valor={v?.finalidade ?? mensagem?.finalidade ?? "renovacao"}
        erro={erros.finalidade}
      >
        <option value="renovacao">Renovação</option>
        <option value="retorno">Convite para voltar</option>
      </Campo>
      <div className="flex flex-col gap-3">
        <Campo
          nome="texto"
          rotulo="Texto"
          tipo="area"
          valor={v?.texto ?? mensagem?.texto}
          erro={erros.texto}
          atributos={{ rows: 6 }}
          obrigatorio
        />
        <div className="flex flex-col gap-1 text-pequeno text-texto-suave">
          <p className="font-semibold">Campos que se preenchem sozinhos</p>
          <ul className="flex flex-col gap-1">
            {CAMPOS.map(([campo, descricao]) => (
              <li key={campo}>
                <code className="font-semibold text-texto">{campo}</code>:{" "}
                {descricao}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {previa && (
        <section
          aria-labelledby="previa"
          className="flex flex-col gap-2 rounded-sm bg-fundo-suave p-4"
        >
          <h2 id="previa" className="text-pequeno text-texto-suave">
            Prévia com um exemplo
          </h2>
          <p className="whitespace-pre-line break-words">{previa}</p>
        </section>
      )}
      <Campo
        nome="ativa"
        rotulo="Ativa (usada nos contatos)"
        tipo="caixa"
        marcado={v ? v.ativa === "on" : (mensagem?.ativa ?? true)}
        ajuda="Só uma mensagem fica ativa por finalidade: ativar esta desativa a outra."
      />
      <div className="flex flex-col gap-4">
        <MensagemErroGeral erro={erros._} />
        <BotaoEnviar carregando="Salvando…">Salvar</BotaoEnviar>
      </div>
    </form>
  );
}
