import Link from "next/link";
import { notFound } from "next/navigation";
import { rotuloDaTurma } from "@/servidor/alunos/carga";
import { hojeEmSaoPaulo } from "@/servidor/alunos/datas";
import { urlAlunos } from "@/servidor/alunos/listas";
import { contarMatriculasAbertas } from "@/servidor/alunos/matriculas";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { MENSAGEM_EM_USO } from "@/servidor/cadastros/resultado";
import {
  listarTurmas,
  obterTurma,
  opcoesDeTurma,
} from "@/servidor/cadastros/turmas";
import { MensagemErroGeral } from "../../_formulario/mensagem";
import { excluirTurmaAcao } from "../acoes";
import { FormularioTurma } from "../formulario";
import { FormularioMoverAlunos } from "../formulario-mover";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditarTurma({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; movidos?: string | string[] }>;
}) {
  await exigirAdministracao();
  const { id } = await params;
  const { erro, movidos } = await searchParams;
  if (!UUID.test(id)) notFound();
  const banco = obterBanco();
  const turma = await obterTurma(banco, id);
  if (!turma) notFound();
  const opcoes = await opcoesDeTurma(banco, id);
  const alunos = (await contarMatriculasAbertas(banco)).get(id) ?? 0;
  const destinos = (await listarTurmas(banco))
    .filter((t) => t.ativa && t.id !== id)
    .map((t) => ({ id: t.id, rotulo: rotuloDaTurma(t) }));
  const nMovidos = /^\d{1,6}$/.test(String([movidos].flat()[0] ?? ""))
    ? Number([movidos].flat()[0])
    : null;
  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-md flex-1 flex-col gap-12 px-6 py-12 md:px-12 md:py-16"
    >
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <Link
            href="/painel/turmas"
            className="-mx-2 flex min-h-12 items-center px-2 text-link underline decoration-link underline-offset-4"
          >
            Voltar para turmas
          </Link>
          <h1 className="text-titulo">Editar turma</h1>
          {nMovidos !== null && (
            <output className="block font-semibold">
              {nMovidos === 1
                ? "1 aluno movido."
                : `${nMovidos} alunos movidos.`}
            </output>
          )}
          {alunos > 0 && (
            <p>
              {alunos === 1
                ? "1 aluno ainda está nesta turma."
                : `${alunos} alunos ainda estão nesta turma.`}{" "}
              <Link
                href={urlAlunos({ turma: turma.id })}
                className="text-link underline decoration-link underline-offset-4"
              >
                Ver alunos
              </Link>
            </p>
          )}
        </div>
        <FormularioTurma turma={turma} opcoes={opcoes} />
      </div>
      {alunos > 0 && (
        <section className="flex flex-col gap-4 border-linha border-t pt-6">
          <h2 className="text-base">Mover alunos</h2>
          <p className="text-texto-suave">
            Passa quem está nesta turma para outra turma ativa, a partir da data
            escolhida. Use antes de desativar a turma.
          </p>
          <FormularioMoverAlunos
            turmaId={turma.id}
            destinos={destinos}
            hoje={hojeEmSaoPaulo()}
          />
        </section>
      )}
      <form
        action={excluirTurmaAcao}
        className="flex flex-col gap-4 border-linha border-t pt-6"
      >
        <input type="hidden" name="id" value={turma.id} />
        <h2 className="text-base">Excluir</h2>
        <p className="text-texto-suave">
          Só dá para excluir uma turma sem matrículas. Se ela já foi usada,
          desative em vez de excluir.
        </p>
        <MensagemErroGeral
          erro={erro === "em-uso" ? MENSAGEM_EM_USO : undefined}
        />
        <button
          type="submit"
          className="min-h-12 w-full rounded-sm border border-erro px-6 font-semibold text-erro hover:bg-erro hover:text-fundo md:w-auto md:self-start"
        >
          Excluir turma
        </button>
      </form>
    </main>
  );
}
