"use client";

import { type KeyboardEvent, useActionState, useRef, useState } from "react";
import {
  type Preferencia,
  ROTULOS_PREFERENCIA,
} from "@/servidor/bolsistas/textos";
import { BotaoEnviar } from "../_formulario/botao-enviar";
import { Campo } from "../_formulario/campo";
import { ESTADO_INICIAL } from "../_formulario/estado";
import { MensagemErroGeral } from "../_formulario/mensagem";
import {
  BotaoPadrao,
  BotaoPergunta,
  CAIXA,
  SECUNDARIO,
  useComJavascript,
} from "../_pessoa/campos";
import { useVersao } from "../alunos/[id]/formularios/acompanhar";
import { BotaoEnvio } from "../alunos/[id]/formularios/botoes";
import { desfazerNaoHouveAcao, naoHouveAcao, salvarChamadaAcao } from "./acoes";
import type { EstadoChamada } from "./estado";
import { contar, nomesDe, textoDaContagem } from "./textos";

type Pessoa = { pessoaId: string; nome: string; preferencia: Preferencia };
type Linha = Pessoa & { presente: boolean };

const SECAO = "flex flex-col gap-2 border-linha border-t pt-6";
const LISTA = "flex flex-col divide-y divide-linha";
const LINHA =
  "flex min-h-12 items-center gap-3 py-2 md:justify-between md:gap-6";
/** Quantos disponíveis aparecem sem busca; acima disso, só buscando. */
const MOSTRAR_SEM_BUSCA = 6;
/** Quantos resultados da busca aparecem de uma vez. */
const MOSTRAR_NA_BUSCA = 8;

/** Sem acento e em minúsculas, para a busca por nome. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function marcadosDe(linhas: Linha[]): Set<string> {
  return new Set(linhas.filter((l) => l.presente).map((l) => l.pessoaId));
}

/** Uma caixa da chamada: nome e, ao lado (embaixo no celular), a preferência. */
function Caixa({
  pessoa,
  marcado,
  aoMudar,
}: {
  pessoa: Pessoa;
  marcado: boolean;
  aoMudar: (marcado: boolean) => void;
}) {
  return (
    <label className={LINHA}>
      <input
        type="checkbox"
        name="presentes"
        value={pessoa.pessoaId}
        checked={marcado}
        onChange={(e) => aoMudar(e.currentTarget.checked)}
        className={CAIXA}
      />
      <span className="flex min-w-0 flex-1 flex-col md:flex-row md:items-baseline md:justify-between md:gap-6">
        <span className="break-words">{pessoa.nome}</span>
        <span className="text-texto-suave">
          {ROTULOS_PREFERENCIA[pessoa.preferencia]}
        </span>
      </span>
    </label>
  );
}

/**
 * "Adicionar bolsista": busca pelo nome entre os ativos fora do acordo do
 * dia; quem é escolhido entra marcado em "Vieram sem estar no acordo".
 */
function Adicionar({
  dia,
  disponiveis,
  aoEscolher,
}: {
  dia: string;
  disponiveis: Pessoa[];
  aoEscolher: (p: Pessoa) => void;
}) {
  const [busca, setBusca] = useState("");
  const [aviso, setAviso] = useState("");
  const campo = useRef<HTMLInputElement>(null);
  const termo = normalizar(busca);
  const achados = termo
    ? disponiveis.filter((p) => normalizar(p.nome).includes(termo))
    : disponiveis.length <= MOSTRAR_SEM_BUSCA
      ? disponiveis
      : [];
  const visiveis = achados.slice(0, MOSTRAR_NA_BUSCA);

  function escolher(p: Pessoa) {
    aoEscolher(p);
    setBusca("");
    setAviso(`${p.nome} entrou na chamada, marcado.`);
    campo.current?.focus();
  }

  // Enter na busca escolhe o primeiro achado, em vez de salvar a chamada.
  function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const primeiro = visiveis[0];
    if (termo && primeiro) escolher(primeiro);
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="adicionar-busca" className="font-semibold">
        Adicionar bolsista
      </label>
      <span id="adicionar-ajuda" className="text-pequeno text-texto-suave">
        Para quem veio sem ter combinado {dia}:{" "}
        {disponiveis.length === 1
          ? "1 bolsista ativo."
          : `${disponiveis.length} bolsistas ativos.`}
      </span>
      <input
        ref={campo}
        id="adicionar-busca"
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.currentTarget.value)}
        onKeyDown={aoTeclar}
        placeholder="Buscar pelo nome"
        autoComplete="off"
        aria-describedby="adicionar-ajuda"
        aria-controls="adicionar-achados"
        className="min-h-12 w-full rounded-sm border border-borda bg-transparent px-3 text-base"
      />
      <p aria-live="polite" className="text-sucesso empty:hidden">
        {aviso}
      </p>
      <ul id="adicionar-achados" className={LISTA}>
        {visiveis.map((p) => (
          <li key={p.pessoaId}>
            <button
              type="button"
              onClick={() => escolher(p)}
              className={`${LINHA} w-full text-left`}
            >
              <span className="flex min-w-0 flex-1 flex-col md:flex-row md:items-baseline md:justify-between md:gap-6">
                <span className="break-words">{p.nome}</span>
                <span className="text-texto-suave">
                  {ROTULOS_PREFERENCIA[p.preferencia]}
                </span>
              </span>
              <span className="shrink-0 font-semibold text-link underline decoration-link underline-offset-4">
                Adicionar
              </span>
            </button>
          </li>
        ))}
      </ul>
      {termo && achados.length === 0 && (
        <p className="text-texto-suave">Nenhum bolsista ativo com esse nome.</p>
      )}
      {termo && achados.length > visiveis.length && (
        <p className="text-texto-suave">
          Mais {achados.length - visiveis.length}. Digite mais do nome.
        </p>
      )}
    </div>
  );
}

/**
 * Chamada de uma aula: combinados do dia, quem veio sem estar no acordo e
 * "Adicionar bolsista", com a contagem por preferência ao vivo no topo. As
 * caixas mostram a chamada salva; depois de salvar (ou de outra pessoa ter
 * salvo antes), voltam a ela (a `versao` muda).
 */
export function FormularioChamada({
  turmaId,
  data,
  versao,
  dia,
  salva,
  combinados,
  extras,
  disponiveis,
}: {
  turmaId: string;
  data: string;
  versao: number;
  /** Dia da semana por extenso ("terça"). */
  dia: string;
  /** Já existe chamada salva para esta aula? */
  salva: boolean;
  combinados: Linha[];
  extras: Linha[];
  disponiveis: Pessoa[];
}) {
  const [estado, acao] = useActionState<EstadoChamada, FormData>(
    salvarChamadaAcao,
    ESTADO_INICIAL,
  );
  const comJs = useComJavascript();
  // Remonta o formulário a cada resposta: depois de uma action o React
  // devolve as caixas ao estado da primeira renderização, e uma caixa
  // controlada que não mudou de valor ficaria desmarcada na tela.
  const chave = useVersao(estado);
  const salvos = [...combinados, ...extras];
  const [marcados, setMarcados] = useState(() => marcadosDe(salvos));
  const [adicionados, setAdicionados] = useState<Pessoa[]>([]);
  const [mexeu, setMexeu] = useState(false);
  const [vistos, setVistos] = useState({ versao, estado });

  // Nova versão no banco (salvou, ou outra pessoa salvou): volta à chamada salva.
  if (versao !== vistos.versao) {
    setVistos({ versao, estado });
    setMarcados(marcadosDe(salvos));
    setAdicionados([]);
    setMexeu(false);
  } else if (estado !== vistos.estado) {
    setVistos({ versao, estado });
    setMexeu(false);
  }

  const idsExtras = new Set(extras.map((e) => e.pessoaId));
  const novos = adicionados.filter((a) => !idsExtras.has(a.pessoaId));
  const idsNovos = new Set(novos.map((a) => a.pessoaId));
  const foraDoAcordo: Pessoa[] = [...extras, ...novos];
  const paraAdicionar = disponiveis.filter((d) => !idsNovos.has(d.pessoaId));
  const todos: Pessoa[] = [...combinados, ...foraDoAcordo];
  const contagem = contar(todos.filter((p) => marcados.has(p.pessoaId)));

  const conflito = estado.conflito;
  const salvaAgora = nomesDe(
    salvos.filter((l) => l.presente).map((l) => l.pessoaId),
    salvos,
  );
  const tinhaMarcado = conflito
    ? nomesDe(conflito, [...todos, ...disponiveis])
    : [];
  const mesmaSelecao =
    conflito !== undefined &&
    conflito.length === marcados.size &&
    conflito.every((id) => marcados.has(id));

  function marcar(id: string, marcado: boolean) {
    setMexeu(true);
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (marcado) novo.add(id);
      else novo.delete(id);
      return novo;
    });
  }

  function adicionar(p: Pessoa) {
    setAdicionados((atual) => [...atual, p]);
    marcar(p.pessoaId, true);
  }

  /** Depois do aviso de conflito: volta a marcar o que a pessoa tinha marcado. */
  function remarcar() {
    if (!conflito) return;
    const conhecidos = new Set(todos.map((p) => p.pessoaId));
    const faltam = disponiveis.filter(
      (d) => conflito.includes(d.pessoaId) && !conhecidos.has(d.pessoaId),
    );
    setAdicionados((atual) => [...atual, ...faltam]);
    setMarcados(new Set(conflito));
    setMexeu(true);
  }

  const erros = estado.erros ?? {};
  const perguntarVazia = estado.vazia && marcados.size === 0;

  return (
    <form key={chave} action={acao} noValidate className="flex flex-col gap-8">
      <BotaoPadrao />
      <input type="hidden" name="turmaId" value={turmaId} />
      <input type="hidden" name="data" value={data} />
      <input type="hidden" name="versao" value={versao} />

      <div className="flex flex-col gap-1">
        <p aria-live="polite" className="font-semibold">
          {textoDaContagem(contagem)}
        </p>
        <p className="text-texto-suave">
          {salva
            ? "Marque quem veio e salve de novo para corrigir."
            : "Ainda sem chamada salva."}
        </p>
      </div>

      <fieldset className={SECAO}>
        <legend className="float-left w-full font-semibold">
          Combinados para {dia}
        </legend>
        {combinados.length === 0 ? (
          <p className="text-texto-suave">
            Nenhum bolsista ativo combinou {dia}. Quem veio entra por “Adicionar
            bolsista”.
          </p>
        ) : (
          <div className={LISTA}>
            {combinados.map((p) => (
              <Caixa
                key={p.pessoaId}
                pessoa={p}
                marcado={marcados.has(p.pessoaId)}
                aoMudar={(m) => marcar(p.pessoaId, m)}
              />
            ))}
          </div>
        )}
      </fieldset>

      {(foraDoAcordo.length > 0 || paraAdicionar.length > 0) && (
        <div className={`${SECAO} gap-6`}>
          {foraDoAcordo.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="float-left w-full font-semibold">
                Vieram sem estar no acordo
              </legend>
              <div className={LISTA}>
                {foraDoAcordo.map((p) => (
                  <Caixa
                    key={p.pessoaId}
                    pessoa={p}
                    marcado={marcados.has(p.pessoaId)}
                    aoMudar={(m) => marcar(p.pessoaId, m)}
                  />
                ))}
              </div>
            </fieldset>
          )}
          {paraAdicionar.length > 0 &&
            (comJs ? (
              <Adicionar
                dia={dia}
                disponiveis={paraAdicionar}
                aoEscolher={adicionar}
              />
            ) : (
              // Sem JavaScript, sem busca: todos os disponíveis como caixas.
              <fieldset className="flex flex-col gap-2">
                <legend className="float-left w-full font-semibold">
                  Adicionar bolsista
                </legend>
                <div className={LISTA}>
                  {paraAdicionar.map((p) => (
                    <Caixa
                      key={p.pessoaId}
                      pessoa={p}
                      marcado={marcados.has(p.pessoaId)}
                      aoMudar={(m) => marcar(p.pessoaId, m)}
                    />
                  ))}
                </div>
              </fieldset>
            ))}
        </div>
      )}

      <div className="flex flex-col gap-4 border-linha border-t pt-6 md:items-start">
        {conflito && (
          <div role="alert" className="flex flex-col gap-2">
            <p className="font-semibold text-erro">{erros._}</p>
            <p>
              Salva agora:{" "}
              {salvaAgora.length === 0 ? "ninguém" : salvaAgora.join(", ")}.
            </p>
            <p>
              Você tinha marcado:{" "}
              {tinhaMarcado.length === 0 ? "ninguém" : tinhaMarcado.join(", ")}.
            </p>
            {!mesmaSelecao && (
              <button type="button" onClick={remarcar} className={SECUNDARIO}>
                Usar o que eu tinha marcado
              </button>
            )}
          </div>
        )}
        {perguntarVazia && (
          <output className="flex flex-col gap-4 md:items-start">
            <p className="font-semibold">
              Ninguém veio? Se não houve aula, use “Não houve aula”, mais
              abaixo.
            </p>
            <BotaoPergunta nome="confirmarVazia" valor="1" principal>
              Salvar sem ninguém
            </BotaoPergunta>
          </output>
        )}
        {!conflito && <MensagemErroGeral erro={erros._} />}
        <MensagemErroGeral erro={erros.presentes} />
        {estado.salvo && !mexeu && (
          <output className="text-sucesso">Chamada salva.</output>
        )}
        {/* Com a pergunta da chamada vazia, o envio principal é a resposta dela. */}
        {!perguntarVazia && (
          <BotaoEnviar carregando="Salvando…">
            {conflito ? "Salvar de novo" : "Salvar chamada"}
          </BotaoEnviar>
        )}
      </div>
    </form>
  );
}

/** "Não houve aula", com o motivo obrigatório; fora do formulário da chamada. */
export function FormularioNaoHouve({
  turmaId,
  data,
}: {
  turmaId: string;
  data: string;
}) {
  const [estado, acao] = useActionState(naoHouveAcao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  return (
    <form action={acao} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="turmaId" value={turmaId} />
      <input type="hidden" name="data" value={data} />
      <Campo
        nome="motivo"
        rotulo="Motivo"
        valor={estado.valores?.motivo}
        erro={erros.motivo}
        ajuda="Ex.: feriado, professor doente. Esse dia não conta na frequência."
        obrigatorio
      />
      <div className="flex flex-col gap-4 md:items-start">
        <MensagemErroGeral erro={erros._} />
        <BotaoEnvio visual="secundario" carregando="Salvando…">
          Marcar que não houve aula
        </BotaoEnvio>
      </div>
    </form>
  );
}

/** "Desfazer" o "não houve aula": a aula volta a ter chamada. */
export function FormularioDesfazerNaoHouve({
  turmaId,
  data,
}: {
  turmaId: string;
  data: string;
}) {
  const [estado, acao] = useActionState(desfazerNaoHouveAcao, ESTADO_INICIAL);
  return (
    <form action={acao} className="flex flex-col gap-4 md:items-start">
      <input type="hidden" name="turmaId" value={turmaId} />
      <input type="hidden" name="data" value={data} />
      <MensagemErroGeral erro={estado.erros?._} />
      <BotaoEnvio visual="secundario" carregando="Desfazendo…">
        Desfazer
      </BotaoEnvio>
    </form>
  );
}
