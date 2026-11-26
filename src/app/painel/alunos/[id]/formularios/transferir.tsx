"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { BotaoEnviar } from "../../../_formulario/botao-enviar";
import { Campo } from "../../../_formulario/campo";
import { ESTADO_INICIAL } from "../../../_formulario/estado";
import { MensagemErroGeral } from "../../../_formulario/mensagem";
import { transferirAcao } from "../acoes";
import {
  contaDaTransferencia,
  filtrarPorNome,
  textoRestam,
  type Unidade,
} from "../calculos";
import { useAcompanhar } from "./acompanhar";
import { Conta } from "./botoes";
import { CamposQuantidade, type TurmaDoFormulario } from "./quantidade";

export type Recebedor = {
  id: string;
  nome: string;
  /** O último período ainda não terminou: os dias entram nele. */
  recebeNoPeriodo: boolean;
};

const LINK =
  "-mx-2 flex min-h-12 items-center self-start px-2 text-link underline decoration-link underline-offset-4";

/**
 * Transferir dias para outro aluno: busca de quem recebe (ou cadastro na
 * hora), quantidade, unidade, turma, início para quem recebe (só se o período
 * dele já terminou ou não existe) e motivo.
 */
export function FormularioTransferir({
  aluno,
  recebedores,
  paraInicial,
  fimAtual,
  restantes,
  hoje,
  unidadePadrao,
  turmas,
}: {
  aluno: { id: string; primeiroNome: string };
  recebedores: Recebedor[];
  paraInicial: string;
  fimAtual: string;
  restantes: number;
  hoje: string;
  unidadePadrao: Unidade;
  turmas: TurmaDoFormulario[];
}) {
  const [estado, acao] = useActionState(transferirAcao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  const v = estado.valores;
  const [busca, setBusca] = useState("");
  const [campos, acompanhar, versao] = useAcompanhar(
    estado,
    {
      paraAlunoId: paraInicial,
      quantidade: "",
      unidade: unidadePadrao,
      turmaId: "",
    },
    (campo) => ({
      paraAlunoId: campo("paraAlunoId"),
      quantidade: campo("quantidade"),
      unidade: (campo("unidade") === "aulas" ? "aulas" : "dias") as Unidade,
      turmaId: campo("turmaId"),
    }),
  );
  const escolhido = recebedores.find((r) => r.id === campos.paraAlunoId);
  // O escolhido continua na lista (no mesmo lugar e com a mesma `key`, para o
  // navegador não perder a seleção) mesmo fora da busca.
  const achados = new Set(filtrarPorNome(recebedores, busca).map((r) => r.id));
  const opcoes = recebedores.filter(
    (r) => achados.has(r.id) || r.id === escolhido?.id,
  );
  const conta = contaDaTransferencia({
    nome: aluno.primeiroNome,
    fimAtual,
    restantes,
    quantidade: campos.quantidade,
    unidade: campos.unidade,
    turmas,
    turmaId: campos.turmaId,
  });
  const depois = `/painel/alunos/${aluno.id}/transferir`;

  return (
    <form
      key={versao}
      action={acao}
      onChange={acompanhar}
      noValidate
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="id" value={aluno.id} />
      <p className="font-semibold">{textoRestam(restantes)}</p>
      <fieldset className="flex flex-col gap-4">
        <legend className="sr-only">Quem recebe</legend>
        <div className="flex flex-col gap-2">
          <label htmlFor="busca-recebedor" className="font-semibold">
            Buscar quem recebe
          </label>
          <input
            id="busca-recebedor"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            autoComplete="off"
            aria-controls="paraAlunoId"
            className="min-h-12 w-full rounded-sm border border-borda bg-transparent px-3 text-base"
          />
        </div>
        <Campo
          nome="paraAlunoId"
          rotulo="Quem recebe"
          tipo="selecao"
          valor={v?.paraAlunoId ?? paraInicial}
          erro={erros.paraAlunoId}
          obrigatorio
        >
          <option value="">
            {achados.size === 0 ? "Ninguém com esse nome" : "Escolha o aluno"}
          </option>
          {opcoes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nome}
            </option>
          ))}
        </Campo>
        <Link
          href={`/painel/alunos/novo?depois=${encodeURIComponent(depois)}`}
          className={LINK}
        >
          Cadastrar novo aluno
        </Link>
      </fieldset>
      <CamposQuantidade
        valores={v}
        erros={erros}
        unidade={campos.unidade}
        unidadePadrao={unidadePadrao}
        turmas={turmas}
      />
      {escolhido && !escolhido.recebeNoPeriodo && (
        <Campo
          nome="inicioRecebedor"
          rotulo={`Início para ${escolhido.nome}`}
          tipo="data"
          valor={v?.inicioRecebedor || hoje}
          erro={erros.inicioRecebedor}
          ajuda="Sem período em andamento, os dias viram um período novo a partir desta data."
        />
      )}
      <Campo
        nome="motivo"
        rotulo="Motivo"
        valor={v?.motivo}
        erro={erros.motivo}
        ajuda="Ex.: viagem a trabalho; o irmão vai usar os dias."
        obrigatorio
      />
      <div className="flex flex-col gap-4">
        <MensagemErroGeral erro={erros._} />
        <BotaoEnviar carregando="Salvando…">Transferir</BotaoEnviar>
        <Conta texto={conta} />
      </div>
    </form>
  );
}
