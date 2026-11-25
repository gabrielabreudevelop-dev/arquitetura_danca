"use client";

import { useActionState } from "react";
import { ESTADO_INICIAL } from "../../../_formulario/estado";
import { MensagemErroGeral } from "../../../_formulario/mensagem";
import { excluirAlunoAcao, reabrirAcao } from "../acoes";
import { BotaoEnvio } from "./botoes";

/** "Reabrir cadastro", na ficha de aluno encerrado. */
export function FormularioReabrir({ alunoId }: { alunoId: string }) {
  const [estado, acao] = useActionState(reabrirAcao, ESTADO_INICIAL);
  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={alunoId} />
      <MensagemErroGeral erro={estado.erros?._} />
      <BotaoEnvio visual="secundario" carregando="Reabrindo…">
        Reabrir cadastro
      </BotaoEnvio>
    </form>
  );
}

/**
 * "Excluir cadastro" em dois passos: o primeiro envio só pede a confirmação
 * (o servidor devolve `confirmar`); o segundo, com `confirmar=1`, exclui.
 * Funciona igual sem JavaScript.
 */
export function FormularioExcluir({
  alunoId,
  nome,
}: {
  alunoId: string;
  nome: string;
}) {
  const [estado, acao] = useActionState(excluirAlunoAcao, ESTADO_INICIAL);
  const confirmando = estado.valores?.confirmar === "1";
  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={alunoId} />
      {confirmando ? (
        <>
          <input type="hidden" name="confirmar" value="1" />
          <p role="alert" className="max-w-prose font-semibold">
            Excluir o cadastro de {nome}? Isso não pode ser desfeito.
          </p>
          <div className="flex flex-col gap-4 md:flex-row">
            <BotaoEnvio visual="perigoCheio" carregando="Excluindo…">
              Sim, excluir
            </BotaoEnvio>
            <a
              href={`/painel/alunos/${alunoId}`}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-sm border border-acao px-6 font-semibold text-link hover:bg-acao hover:text-fundo md:w-auto"
            >
              Cancelar
            </a>
          </div>
        </>
      ) : (
        <>
          <MensagemErroGeral erro={estado.erros?._} />
          <BotaoEnvio visual="perigo" carregando="Aguarde…">
            Excluir cadastro
          </BotaoEnvio>
        </>
      )}
    </form>
  );
}
