import { MENSAGEM_ENCERRADO } from "@/servidor/alunos/cadastro";
import { rotuloDaTurma } from "@/servidor/alunos/carga";
import { formatarDia, hojeEmSaoPaulo } from "@/servidor/alunos/datas";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { listarTurmas } from "@/servidor/cadastros/turmas";
import {
  FormularioMatricular,
  FormularioTirar,
  FormularioTrocar,
} from "../formularios/turmas";
import { alunoOu404, Impedimento, Moldura } from "../moldura";

export const dynamic = "force-dynamic";

const SECAO = "flex flex-col gap-6 border-linha border-t pt-6";

export default async function PaginaTurmas({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirAdministracao();
  const { id } = await params;
  const hoje = hojeEmSaoPaulo();
  const aluno = await alunoOu404(id, hoje);
  const titulo = aluno.matriculas.length === 0 ? "Matricular" : "Turmas";

  if (aluno.encerrado) {
    return (
      <Moldura aluno={aluno} titulo={titulo}>
        <Impedimento alunoId={aluno.id}>{MENSAGEM_ENCERRADO}</Impedimento>
      </Moldura>
    );
  }

  const atuais = new Set(aluno.matriculas.map((m) => m.turmaId));
  const livres = (await listarTurmas(obterBanco()))
    .filter((t) => t.ativa && !atuais.has(t.id))
    .map((t) => ({ id: t.id, rotulo: rotuloDaTurma(t) }));

  return (
    <Moldura aluno={aluno} titulo={titulo}>
      {aluno.matriculas.length > 0 && (
        <section
          aria-labelledby="turmas-atuais"
          className="flex flex-col gap-6"
        >
          <h2 id="turmas-atuais" className="text-base">
            Turmas atuais
          </h2>
          <ul className="flex flex-col">
            {aluno.matriculas.map((m) => (
              <li
                key={m.matriculaId}
                className="flex flex-col gap-2 border-linha border-b py-4 last:border-b-0"
              >
                <p className="break-words font-semibold">{m.rotulo}</p>
                <p className="text-pequeno text-texto-suave">
                  desde {formatarDia(m.entrada)}
                </p>
                <FormularioTrocar
                  alunoId={aluno.id}
                  matriculaId={m.matriculaId}
                  turmas={livres}
                  hoje={hoje}
                />
                <FormularioTirar
                  alunoId={aluno.id}
                  matriculaId={m.matriculaId}
                  hoje={hoje}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
      <section
        aria-labelledby="turmas-matricular"
        className={aluno.matriculas.length > 0 ? SECAO : "flex flex-col gap-6"}
      >
        <h2 id="turmas-matricular" className="text-base">
          {aluno.matriculas.length > 0 ? "Matricular em outra turma" : "Turma"}
        </h2>
        {livres.length === 0 ? (
          <p className="max-w-prose text-texto-suave">
            Não há outra turma ativa para matricular. As turmas são cadastradas
            em Vitrine › Turmas.
          </p>
        ) : (
          <FormularioMatricular
            alunoId={aluno.id}
            turmas={livres}
            hoje={hoje}
          />
        )}
      </section>
    </Moldura>
  );
}
