import { hojeEmSaoPaulo } from "@/servidor/alunos/datas";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { FormularioEncerrar } from "../formularios/encerrar";
import { alunoOu404, Impedimento, Moldura } from "../moldura";

export const dynamic = "force-dynamic";

export default async function PaginaEncerrar({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirAdministracao();
  const { id } = await params;
  const hoje = hojeEmSaoPaulo();
  const aluno = await alunoOu404(id, hoje);
  return (
    <Moldura aluno={aluno} titulo="Encerrar aluno">
      {aluno.encerrado ? (
        <Impedimento alunoId={aluno.id}>
          Este cadastro já está encerrado. Para voltar, use “Reabrir cadastro”
          na ficha.
        </Impedimento>
      ) : (
        <>
          <p className="max-w-prose text-texto-suave">
            Encerra as matrículas abertas e tira o aluno das listas de contato.
            O histórico fica guardado e o cadastro pode ser reaberto depois.
          </p>
          <FormularioEncerrar alunoId={aluno.id} hoje={hoje} />
        </>
      )}
    </Moldura>
  );
}
