import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { type AlunoCarregado, carregarAlunos } from "@/servidor/alunos/carga";
import type { DataIso } from "@/servidor/alunos/datas";
import { obterBanco } from "@/servidor/banco/cliente";
import { ehUuid } from "@/servidor/cadastros/comum";
import type { TurmaDoFormulario } from "./formularios/quantidade";

const LINK =
  "-mx-2 flex min-h-12 items-center self-start px-2 text-link underline decoration-link underline-offset-4";

/** O aluno do endereço, ou 404 (id inválido ou inexistente). */
export async function alunoOu404(
  id: string,
  hoje: DataIso,
): Promise<AlunoCarregado> {
  if (!ehUuid(id)) notFound();
  const [aluno] = await carregarAlunos(obterBanco(), hoje, { ids: [id] });
  if (!aluno) notFound();
  return aluno;
}

/**
 * Página de uma ação da ficha: "Voltar para a ficha", título, nome do aluno
 * (e um detalhe opcional, como o período atual) e o formulário.
 */
export function Moldura({
  aluno,
  titulo,
  detalhe,
  children,
}: {
  aluno: { id: string; nome: string };
  titulo: string;
  detalhe?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12 md:px-12 md:py-16"
    >
      <div className="flex flex-col gap-2">
        <Link href={`/painel/alunos/${aluno.id}`} className={LINK}>
          Voltar para a ficha
        </Link>
        <h1 className="text-titulo">{titulo}</h1>
        <p className="break-words font-semibold">{aluno.nome}</p>
        {detalhe && <p className="text-texto-suave">{detalhe}</p>}
      </div>
      {children}
    </main>
  );
}

/** No lugar do formulário, quando a ação não cabe agora (ex.: aluno encerrado). */
export function Impedimento({
  alunoId,
  children,
}: {
  alunoId: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-prose">{children}</p>
      <Link
        href={`/painel/alunos/${alunoId}`}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-sm border border-acao px-6 font-semibold text-link hover:bg-acao hover:text-fundo md:w-auto md:self-start"
      >
        Voltar para a ficha
      </Link>
    </div>
  );
}

/** Turmas das matrículas abertas, com os dias por semana para converter aulas. */
export function turmasDoAluno(aluno: AlunoCarregado): TurmaDoFormulario[] {
  return aluno.matriculas.map((m) => ({
    turmaId: m.turmaId,
    diasPorSemana: m.dias.length,
    rotulo: m.rotulo,
  }));
}
