"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BotaoEnviar } from "../_formulario/botao-enviar";
import { Campo } from "../_formulario/campo";
import { ESTADO_INICIAL } from "../_formulario/estado";
import { MensagemErroGeral } from "../_formulario/mensagem";
import {
  atualizarProfessorAcao,
  cadastrarProfessorAcao,
  tornarProfessorAcao,
} from "./acoes";
import type { EstadoProfessor } from "./estado";

type Professor = {
  pessoaId: string;
  nome: string;
  email: string | null;
  whatsapp: string | null;
  ativo: boolean;
};

const AJUDA_WHATSAPP = "Com DDD, por exemplo (27) 99999-0000. Opcional.";

/** Formulário de professor: novo (sem `professor`) ou edição. Com erro, mantém o que foi digitado. */
export function FormularioProfessor({
  professor,
  whatsappExibicao,
}: {
  professor?: Professor;
  /** WhatsApp já formatado para o campo de edição. */
  whatsappExibicao?: string;
}) {
  const [estado, acao] = useActionState<EstadoProfessor, FormData>(
    professor ? atualizarProfessorAcao : cadastrarProfessorAcao,
    ESTADO_INICIAL,
  );
  const erros = estado.erros ?? {};
  const v = estado.valores;
  const existente = estado.existente;
  return (
    <div className="flex flex-col gap-8">
      {existente && (
        <output className="flex flex-col gap-4 border-linha border-t border-b py-6">
          {existente.jaProfessor ? (
            <>
              <p className="font-semibold">
                {existente.nome} já é professor(a).
              </p>
              <Link
                href={`/painel/professores/${existente.pessoaId}`}
                className="-mx-2 flex min-h-12 items-center px-2 font-semibold text-link underline decoration-link underline-offset-4"
              >
                Abrir cadastro de {existente.nome}
              </Link>
            </>
          ) : (
            <form action={tornarProfessorAcao} className="flex flex-col gap-4">
              <input type="hidden" name="id" value={existente.pessoaId} />
              <p className="font-semibold">
                {existente.nome} já está cadastrada com esse e-mail.
              </p>
              <BotaoEnviar carregando="Salvando…">
                Tornar professor(a)
              </BotaoEnviar>
            </form>
          )}
        </output>
      )}
      <form action={acao} noValidate className="flex flex-col gap-6">
        {professor && (
          <input type="hidden" name="id" value={professor.pessoaId} />
        )}
        <Campo
          nome="nome"
          rotulo="Nome"
          valor={v?.nome ?? professor?.nome}
          erro={erros.nome}
          atributos={{ autoComplete: "off" }}
          obrigatorio
        />
        <Campo
          nome="email"
          rotulo="E-mail"
          tipo="email"
          valor={v?.email ?? professor?.email ?? ""}
          erro={erros.email}
          ajuda="Opcional. Se já houver uma pessoa com esse e-mail, usamos o cadastro dela."
          atributos={{ autoCapitalize: "none", spellCheck: false }}
        />
        <Campo
          nome="whatsapp"
          rotulo="WhatsApp"
          tipo="texto"
          valor={v?.whatsapp ?? whatsappExibicao ?? ""}
          erro={erros.whatsapp}
          ajuda={AJUDA_WHATSAPP}
          atributos={{ inputMode: "tel", autoComplete: "off" }}
        />
        {professor && (
          <Campo
            nome="ativo"
            rotulo="Ativo (pode receber turmas)"
            tipo="caixa"
            marcado={v ? v.ativo === "on" : professor.ativo}
          />
        )}
        <div className="flex flex-col gap-4">
          <MensagemErroGeral erro={erros._} />
          <BotaoEnviar carregando="Salvando…">Salvar</BotaoEnviar>
        </div>
      </form>
    </div>
  );
}
