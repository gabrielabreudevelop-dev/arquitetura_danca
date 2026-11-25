import Link from "next/link";
import { rotuloDaTurma } from "@/servidor/alunos/carga";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { listarTurmas } from "@/servidor/cadastros/turmas";
import { obterUnidadeAjustes } from "@/servidor/configuracoes/unidade";
import { FormularioEstenderTurma } from "./formulario";

export const dynamic = "force-dynamic";

const LINK =
  "-mx-2 flex min-h-12 items-center px-2 text-link underline decoration-link underline-offset-4";

export default async function PaginaEstenderTurma() {
  await exigirAdministracao();
  const banco = obterBanco();
  const [turmas, unidadePadrao] = await Promise.all([
    listarTurmas(banco),
    obterUnidadeAjustes(banco),
  ]);
  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12 md:px-12 md:py-16"
    >
      <div className="flex flex-col gap-2">
        <Link href="/painel/alunos" className={LINK}>
          Voltar para alunos
        </Link>
        <h1 className="text-titulo">Estender turma</h1>
        <p className="text-texto-suave">
          Soma dias ao último período de quem está vigente, de uma vez. Veja
          quem recebe antes de confirmar.
        </p>
        <Link href="/painel/alunos/estender-turma/lotes" className={LINK}>
          Ver extensões feitas
        </Link>
      </div>
      <FormularioEstenderTurma
        turmas={turmas
          .filter((t) => t.ativa)
          .map((t) => ({ id: t.id, rotulo: rotuloDaTurma(t) }))}
        unidadePadrao={unidadePadrao}
      />
    </main>
  );
}
