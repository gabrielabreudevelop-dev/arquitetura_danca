"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { DataIso } from "@/servidor/alunos/datas";
import { BotaoEnviar } from "../_formulario/botao-enviar";
import { ESTADO_INICIAL } from "../_formulario/estado";
import { MensagemErroGeral } from "../_formulario/mensagem";
import {
  BotaoPadrao,
  BotaoPergunta,
  CamposPessoa,
  LINK_PERGUNTA,
  PerguntasPessoa,
  type PessoaParaEditar,
} from "../_pessoa/campos";
import { useVersao } from "../alunos/[id]/formularios/acompanhar";
import { atualizarBolsistaAcao, cadastrarBolsistaAcao } from "./acoes";
import { CampoDias, CampoPreferencia } from "./campos";
import { diasMarcados } from "./dados";
import type { EstadoBolsista } from "./estado";

export type BolsistaParaEditar = PessoaParaEditar & { preferencia: string };

/**
 * Formulário de bolsista: novo (com os dias combinados, vigentes desde hoje)
 * ou edição (com `bolsista`; os dias mudam por "Alterar dias", na ficha).
 * Mesmos campos e perguntas do aluno, sem turmas, mais a preferência.
 */
export function FormularioBolsista({
  bolsista,
  hoje,
}: {
  bolsista?: BolsistaParaEditar;
  hoje: DataIso;
}) {
  const [estado, acao] = useActionState<EstadoBolsista, FormData>(
    bolsista ? atualizarBolsistaAcao : cadastrarBolsistaAcao,
    ESTADO_INICIAL,
  );
  // As caixas e os rádios guardam o padrão da montagem: remontar os põe nos valores devolvidos.
  const versao = useVersao(estado);
  const erros = estado.erros ?? {};
  const v = estado.valores;
  const existente = estado.existente;

  return (
    <form key={versao} action={acao} noValidate className="flex flex-col gap-6">
      <BotaoPadrao />
      {bolsista && <input type="hidden" name="id" value={bolsista.id} />}
      <CamposPessoa
        estado={estado}
        pessoa={bolsista}
        hoje={hoje}
        ajudaEmail="Opcional."
      />

      <div className="flex flex-col gap-6 border-linha border-t pt-6">
        {!bolsista && (
          <CampoDias
            marcados={diasMarcados(v?.dias)}
            erro={erros.dias}
            ajuda="Ao menos um. Valem a partir de hoje; para mudar depois, use “Alterar dias” na ficha."
          />
        )}
        <CampoPreferencia
          valor={v?.preferencia ?? bolsista?.preferencia}
          erro={erros.preferencia}
        />
      </div>

      <PerguntasPessoa
        estado={estado}
        existente={
          existente &&
          (existente.jaBolsista ? (
            <>
              <p className="font-semibold">
                {existente.nome} já é bolsista com esse e-mail.
              </p>
              <Link
                href={`/painel/bolsistas/${existente.pessoaId}`}
                className={LINK_PERGUNTA}
              >
                Abrir a ficha de {existente.nome}
              </Link>
            </>
          ) : (
            <>
              <p className="font-semibold">
                {existente.nome} já tem cadastro com esse e-mail.
              </p>
              <p className="text-texto-suave">
                Tornar bolsista usa o cadastro que já existe, com os dias e a
                preferência marcados acima. Os outros campos não mudam o
                cadastro; para isso, use “Editar” na ficha.
              </p>
              <input
                type="hidden"
                name="existenteNome"
                value={existente.nome}
              />
              <BotaoPergunta nome="tornar" valor={existente.pessoaId}>
                Tornar bolsista
              </BotaoPergunta>
            </>
          ))
        }
      />

      {/* Com a pergunta do responsável, as duas respostas já salvam. */}
      {!estado.responsavelExistente && (
        <div className="flex flex-col gap-4">
          <MensagemErroGeral erro={erros._} />
          <BotaoEnviar carregando="Salvando…">Salvar</BotaoEnviar>
        </div>
      )}
    </form>
  );
}
