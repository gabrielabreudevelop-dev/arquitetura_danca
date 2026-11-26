"use client";

import { type FormEvent, useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Campo } from "../../_formulario/campo";
import { MensagemErroGeral } from "../../_formulario/mensagem";
import { useVersao } from "../[id]/formularios/acompanhar";
import { confirmarLoteAcao, previaLoteAcao } from "./acoes";
import { type EstadoLote, linhaDaPrevia } from "./entrada";

const CAIXA_LINHA =
  "flex min-h-12 cursor-pointer items-center gap-3 border-linha border-b py-2";
const CAIXA =
  "size-6 shrink-0 accent-acao aria-invalid:outline-2 aria-invalid:outline-erro";
const SECUNDARIO =
  "min-h-12 w-full rounded-sm border border-acao px-6 font-semibold text-link hover:bg-acao hover:text-fundo disabled:cursor-wait disabled:border-texto-suave disabled:text-texto-suave md:w-auto";
const PRINCIPAL =
  "min-h-12 w-full rounded-sm bg-acao px-6 font-semibold text-fundo hover:bg-acao-escura disabled:cursor-wait disabled:bg-texto-suave md:w-auto";

/**
 * Primeiro botão de envio do formulário: invisível, é o que o Enter (ou o "Ir"
 * do teclado do celular) aciona. Só mostra a prévia; confirmar exige o clique
 * no botão "Confirmar extensão".
 */
function BotaoPadrao() {
  return (
    <button type="submit" tabIndex={-1} aria-hidden className="sr-only">
      Ver quem recebe
    </button>
  );
}

/**
 * Botão de envio. Com `acao`, envia por essa action (a do formulário não
 * vale); sem ela, `outra` é a action do botão irmão. Mostra `carregando`
 * só quando foi este botão que enviou.
 */
function BotaoLote({
  children,
  carregando,
  visual,
  acao,
  outra,
}: {
  children: React.ReactNode;
  carregando: string;
  visual: "secundario" | "principal";
  acao?: (form: FormData) => void;
  outra?: (form: FormData) => void;
}) {
  const { pending, action } = useFormStatus();
  const fui = pending && (acao ? action === acao : action !== outra);
  return (
    <button
      type="submit"
      formAction={acao}
      disabled={pending}
      className={visual === "secundario" ? SECUNDARIO : PRINCIPAL}
    >
      {fui ? carregando : children}
    </button>
  );
}

type Turma = { id: string; rotulo: string };

/**
 * Extensão em lote: escolhe turmas (ou o estúdio todo), quantidade e motivo;
 * "Ver quem recebe" mostra a prévia e "Confirmar extensão" grava. Qualquer
 * mudança nos campos depois da prévia esconde a prévia e o botão de confirmar.
 */
export function FormularioEstenderTurma({
  turmas,
  unidadePadrao,
}: {
  turmas: Turma[];
  unidadePadrao: "dias" | "aulas";
}) {
  const [estadoPrevia, acaoPrevia] = useActionState<EstadoLote, FormData>(
    previaLoteAcao,
    {},
  );
  const [estadoConfirmar, acaoConfirmar] = useActionState<EstadoLote, FormData>(
    confirmarLoteAcao,
    {},
  );
  // A resposta mais nova (prévia ou confirmação com erro) é a que a tela mostra.
  const estado =
    (estadoConfirmar.em ?? 0) > (estadoPrevia.em ?? 0)
      ? estadoConfirmar
      : estadoPrevia;
  const versao = useVersao(estado);
  const [alterado, setAlterado] = useState(false);
  const [visto, setVisto] = useState(estado);
  if (estado !== visto) {
    setVisto(estado);
    setAlterado(false);
  }
  const erros = estado.erros ?? {};
  const v = estado.valores;
  const marcadas = new Set((v?.turmaIds ?? "").split(",").filter(Boolean));
  const previa = alterado ? undefined : estado.previa;

  return (
    <form
      key={versao}
      action={acaoPrevia}
      onChange={(_e: FormEvent<HTMLFormElement>) => setAlterado(true)}
      noValidate
      className="flex flex-col gap-8"
    >
      <BotaoPadrao />
      <fieldset
        className="flex flex-col"
        aria-describedby={erros.turmaIds ? "turmas-erro" : undefined}
      >
        <legend className="mb-2 font-semibold">Quem recebe</legend>
        <label className={`${CAIXA_LINHA} border-t`}>
          <input
            type="checkbox"
            name="estudio"
            value="1"
            defaultChecked={v?.estudio === "1"}
            className={CAIXA}
          />
          <span className="font-semibold">Estúdio todo</span>
        </label>
        {turmas.length === 0 && (
          <p className="py-3 text-texto-suave">Nenhuma turma ativa.</p>
        )}
        {turmas.map((t) => (
          <label key={t.id} className={CAIXA_LINHA}>
            <input
              type="checkbox"
              name="turmaIds"
              value={t.id}
              defaultChecked={marcadas.has(t.id)}
              className={CAIXA}
            />
            <span className="min-w-0 break-words">{t.rotulo}</span>
          </label>
        ))}
        {erros.turmaIds && (
          <p id="turmas-erro" className="pt-2 text-erro">
            {erros.turmaIds}
          </p>
        )}
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <Campo
          nome="quantidade"
          rotulo="Quantidade"
          tipo="numero"
          valor={v?.quantidade}
          erro={erros.quantidade}
          atributos={{ inputMode: "numeric", min: 1, step: 1 }}
          obrigatorio
        />
        <Campo
          nome="unidade"
          rotulo="Em"
          tipo="selecao"
          valor={v?.unidade || unidadePadrao}
          erro={erros.unidade}
        >
          <option value="dias">Dias</option>
          <option value="aulas">Aulas</option>
        </Campo>
      </div>
      <Campo
        nome="motivo"
        rotulo="Motivo"
        valor={v?.motivo}
        erro={erros.motivo}
        ajuda="Ex.: recesso de fim de ano, obra no estúdio."
        obrigatorio
      />

      <div className="flex flex-col gap-4">
        <MensagemErroGeral erro={erros._} />
        <BotaoLote
          visual="secundario"
          carregando="Calculando…"
          outra={acaoConfirmar}
        >
          Ver quem recebe
        </BotaoLote>
      </div>

      {previa && (
        <section
          aria-live="polite"
          className="flex flex-col gap-4 border-linha border-t pt-6"
        >
          {previa.linhas.length === 0 ? (
            <>
              <h2 className="text-base">Ninguém recebe</h2>
              <p className="text-texto-suave">
                Nenhum aluno com período vigente nessa escolha. Só quem está
                vigente recebe a extensão.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-base">
                Vão receber ({previa.linhas.length})
              </h2>
              <ul className="flex flex-col">
                {previa.linhas.map((l) => (
                  <li
                    key={l.alunoId}
                    className="break-words border-linha border-b py-3 first:border-t"
                  >
                    {linhaDaPrevia(l)}
                  </li>
                ))}
              </ul>
              <BotaoLote
                visual="principal"
                carregando="Estendendo…"
                acao={acaoConfirmar}
              >
                Confirmar extensão
              </BotaoLote>
            </>
          )}
        </section>
      )}
    </form>
  );
}
