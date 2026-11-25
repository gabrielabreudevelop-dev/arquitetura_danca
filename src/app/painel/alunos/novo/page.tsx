import Link from "next/link";
import { rotuloDaTurma } from "@/servidor/alunos/carga";
import { hojeEmSaoPaulo } from "@/servidor/alunos/datas";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { listarTurmas } from "@/servidor/cadastros/turmas";
import { FormularioAluno } from "../formulario";

export const dynamic = "force-dynamic";

export default async function NovoAluno() {
  await exigirAdministracao();
  const turmas = (await listarTurmas(obterBanco()))
    .filter((t) => t.ativa)
    .map((t) => ({ id: t.id, rotulo: rotuloDaTurma(t) }));
  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12 md:px-12 md:py-16"
    >
      <div className="flex flex-col gap-2">
        <Link
          href="/painel/alunos"
          className="-mx-2 flex min-h-12 items-center self-start px-2 text-link underline decoration-link underline-offset-4"
        >
          Voltar para alunos
        </Link>
        <h1 className="text-titulo">Novo aluno</h1>
      </div>
      <FormularioAluno turmas={turmas} hoje={hojeEmSaoPaulo()} />
    </main>
  );
}
