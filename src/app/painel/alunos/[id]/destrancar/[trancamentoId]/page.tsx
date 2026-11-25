import { notFound } from "next/navigation";
import { formatarDia, hojeEmSaoPaulo } from "@/servidor/alunos/datas";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { FormularioDestrancar } from "../../formularios/destrancar";
import { alunoOu404, Moldura } from "../../moldura";

export const dynamic = "force-dynamic";

export default async function PaginaDestrancar({
  params,
}: {
  params: Promise<{ id: string; trancamentoId: string }>;
}) {
  await exigirAdministracao();
  const { id, trancamentoId } = await params;
  const hoje = hojeEmSaoPaulo();
  const aluno = await alunoOu404(id, hoje);
  // Só um trancamento aberto (sem volta) deste aluno; vale também para encerrado.
  const trancamento = aluno.trancamentos.find(
    (t) => t.id === trancamentoId.toLowerCase() && t.volta === null,
  );
  if (!trancamento) notFound();
  return (
    <Moldura
      aluno={aluno}
      titulo="Destrancar"
      detalhe={`Trancado desde ${formatarDia(trancamento.inicio)}`}
    >
      <FormularioDestrancar
        alunoId={aluno.id}
        trancamentoId={trancamento.id}
        inicio={trancamento.inicio}
        hoje={hoje}
        fimAtual={aluno.resumo.ultimo?.fimEfetivo ?? null}
      />
    </Moldura>
  );
}
