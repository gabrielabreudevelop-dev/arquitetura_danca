import Link from "next/link";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { opcoesDeTurma } from "@/servidor/cadastros/turmas";
import { cadastrosFaltando, FaltaCadastro } from "../falta-cadastro";
import { FormularioTurma } from "../formulario";

export const dynamic = "force-dynamic";

export default async function NovaTurma() {
  await exigirAdministracao();
  const opcoes = await opcoesDeTurma(obterBanco());
  const faltando = cadastrosFaltando(opcoes);
  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12 md:px-12 md:py-16"
    >
      <div className="flex flex-col gap-2">
        <Link
          href="/painel/turmas"
          className="-mx-2 flex min-h-12 items-center px-2 text-link underline decoration-link underline-offset-4"
        >
          Voltar para turmas
        </Link>
        <h1 className="text-titulo">Nova turma</h1>
      </div>
      {faltando.length > 0 ? (
        <FaltaCadastro faltando={faltando} />
      ) : (
        <FormularioTurma opcoes={opcoes} />
      )}
    </main>
  );
}
