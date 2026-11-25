import Link from "next/link";
import { MENSAGEM_ENCERRADO } from "@/servidor/alunos/cadastro";
import { rotuloDaTurma } from "@/servidor/alunos/carga";
import { hojeEmSaoPaulo } from "@/servidor/alunos/datas";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { listarTurmas } from "@/servidor/cadastros/turmas";
import { MensagemErroGeral } from "../../_formulario/mensagem";
import { FormularioAluno } from "../formulario";

export const dynamic = "force-dynamic";

/** Por que "Tornar aluno" falhou (`?erro=` vindo de `tornarAlunoAcao`). */
const ERROS_TORNAR: Record<string, string> = {
  encerrado: MENSAGEM_ENCERRADO,
  "nao-encontrada":
    "Não achamos essa pessoa para tornar aluno. Confira o e-mail e tente de novo.",
};

export default async function NovoAluno({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string | string[] }>;
}) {
  await exigirAdministracao();
  const { erro } = await searchParams;
  const mensagem =
    typeof erro === "string" && Object.hasOwn(ERROS_TORNAR, erro)
      ? ERROS_TORNAR[erro]
      : undefined;
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
      <MensagemErroGeral erro={mensagem} />
      <FormularioAluno turmas={turmas} hoje={hojeEmSaoPaulo()} />
    </main>
  );
}
