"use client";

import { useRouter } from "next/navigation";
import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type ListaContato,
  RESULTADOS_ALUNO,
  type ResultadoContato,
} from "@/servidor/contatos/valores";
import { ESTADO_INICIAL } from "../_formulario/estado";
import { MensagemErroGeral } from "../_formulario/mensagem";
import { useVersao } from "../alunos/[id]/formularios/acompanhar";
import { BotaoEnvio } from "../alunos/[id]/formularios/botoes";
import { textoDoResultado } from "../alunos/textos";
import { marcarResultadoAcao } from "./acoes";

const VISUAIS = {
  principal:
    "min-h-12 w-full rounded-sm bg-acao px-6 font-semibold text-fundo hover:bg-acao-escura disabled:cursor-wait disabled:bg-texto-suave md:w-auto",
  secundario:
    "min-h-12 w-full rounded-sm border border-acao px-6 font-semibold text-link hover:bg-acao hover:text-fundo disabled:cursor-wait disabled:border-texto-suave disabled:text-texto-suave md:w-auto",
};

/** Tempo com o botão em "Abrindo…", contra toque duplo (dois registros). */
const ESPERA_MS = 1500;

/**
 * Botão que registra o contato e abre o WhatsApp numa aba nova: um POST
 * comum para `/painel/contatos/abrir`, que grava e redireciona para o
 * `wa.me`. Sem `noreferrer`: com ele o navegador manda `Origin: null` e a
 * rota recusa. Ao enviar, a lista desta aba é atualizada (e de novo quando a
 * pessoa volta para ela), para mostrar o contato feito.
 */
export function BotaoWhatsapp({
  alunoIds,
  lista,
  visto,
  confirmar = false,
  filtros,
  depois,
  children,
  visual = "secundario",
  rotuloAcessivel,
}: {
  alunoIds: string[];
  lista: ListaContato;
  /**
   * Último grupo de contato que esta tela mostra para a pessoa: se outra
   * pessoa da equipe chamou depois, hoje, a rota pede confirmação.
   */
  visto: string | null;
  /** "Chamar mesmo assim": grava mesmo com o contato recente. */
  confirmar?: boolean;
  /** Filtros da lista, para voltar a ela igual se precisar confirmar. */
  filtros?: { janela: number; todos: boolean; semContato: boolean };
  /** Endereço desta tela sem o aviso, para onde ela vai depois de enviar. */
  depois?: string;
  children: React.ReactNode;
  visual?: keyof typeof VISUAIS;
  /** Nome do botão para leitores de tela, quando há um por linha. */
  rotuloAcessivel?: string;
}) {
  const roteador = useRouter();
  const [abrindo, setAbrindo] = useState(false);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aoVoltar = useRef<(() => void) | null>(null);

  /** Cancela a espera e o ouvinte da volta à aba, se houver. */
  const limpar = useCallback(() => {
    if (espera.current) clearTimeout(espera.current);
    espera.current = null;
    if (aoVoltar.current) {
      document.removeEventListener("visibilitychange", aoVoltar.current);
    }
    aoVoltar.current = null;
  }, []);
  useEffect(() => limpar, [limpar]);

  /** Mostra o contato feito; depois do aviso, sai do endereço com o aviso. */
  function atualizar() {
    if (depois) roteador.replace(depois);
    else roteador.refresh();
  }

  function aoEnviar() {
    limpar();
    setAbrindo(true);
    espera.current = setTimeout(() => {
      espera.current = null;
      setAbrindo(false);
      atualizar();
    }, ESPERA_MS);
    const ouvinte = () => {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", ouvinte);
      aoVoltar.current = null;
      atualizar();
    };
    aoVoltar.current = ouvinte;
    document.addEventListener("visibilitychange", ouvinte);
  }

  return (
    <form
      method="post"
      action="/painel/contatos/abrir"
      target="_blank"
      rel="noopener"
      onSubmit={aoEnviar}
    >
      {alunoIds.map((id) => (
        <input key={id} type="hidden" name="aluno" value={id} />
      ))}
      <input type="hidden" name="lista" value={lista} />
      <input type="hidden" name="visto" value={visto ?? ""} />
      {confirmar && <input type="hidden" name="confirmar" value="1" />}
      {filtros && (
        <>
          <input type="hidden" name="janela" value={filtros.janela} />
          {filtros.todos && <input type="hidden" name="todos" value="1" />}
          {filtros.semContato && (
            <input type="hidden" name="sem_contato" value="1" />
          )}
        </>
      )}
      <button
        type="submit"
        disabled={abrindo}
        aria-label={abrindo ? undefined : rotuloAcessivel}
        className={VISUAIS[visual]}
      >
        {abrindo ? "Abrindo…" : children}
      </button>
    </form>
  );
}

/** Resultado do último contato da linha, com o atual já escolhido. */
export function FormularioResultado({
  pessoaId,
  grupoIds,
  atual,
  nome,
  resultados = RESULTADOS_ALUNO,
}: {
  /** Pessoa de contato da linha (todos os grupos são dela). */
  pessoaId: string;
  /** Grupo do último contato de cada aluno da linha. */
  grupoIds: string[];
  atual: string | null;
  /** Quem recebeu, para o rótulo do campo ("Resultado do contato com Ana Souza"). */
  nome: string;
  /** Resultados do seletor, na ordem: os de aluno ou os de bolsista. */
  resultados?: readonly ResultadoContato[];
}) {
  const [estado, acao] = useActionState(marcarResultadoAcao, ESTADO_INICIAL);
  const versao = useVersao(estado);
  const id = `resultado-${grupoIds[0]}`;
  const erro = estado.erros?.resultado;
  return (
    <form key={versao} action={acao} className="flex flex-col gap-2">
      <input type="hidden" name="pessoa" value={pessoaId} />
      {grupoIds.map((g) => (
        <input key={g} type="hidden" name="grupo" value={g} />
      ))}
      <label htmlFor={id} className="font-semibold">
        Resultado<span className="sr-only"> do contato com {nome}</span>
      </label>
      <div className="flex flex-col gap-2 md:flex-row">
        <select
          id={id}
          name="resultado"
          defaultValue={estado.valores?.resultado ?? atual ?? ""}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${id}-erro` : undefined}
          className="min-h-12 w-full min-w-0 rounded-sm border border-borda bg-transparent px-3 text-base aria-invalid:border-erro md:w-auto"
        >
          <option value="" disabled>
            Escolha…
          </option>
          {resultados.map((r) => (
            <option key={r} value={r}>
              {textoDoResultado(r)}
            </option>
          ))}
        </select>
        <BotaoEnvio visual="secundario" carregando="Marcando…">
          Marcar
        </BotaoEnvio>
      </div>
      {erro && (
        <p id={`${id}-erro`} className="text-erro">
          {erro}
        </p>
      )}
      <MensagemErroGeral erro={estado.erros?._} />
    </form>
  );
}
