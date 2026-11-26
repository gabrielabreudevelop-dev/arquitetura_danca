import { MENSAGEM_ENCERRADO } from "@/servidor/alunos/cadastro";
import { formatarDia, hojeEmSaoPaulo } from "@/servidor/alunos/datas";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { textoDoPeriodo } from "../../textos";
import { FormularioTrancar } from "../formularios/trancar";
import { alunoOu404, Impedimento, Moldura } from "../moldura";

export const dynamic = "force-dynamic";

export default async function PaginaTrancar({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirAdministracao();
  const { id } = await params;
  const hoje = hojeEmSaoPaulo();
  const aluno = await alunoOu404(id, hoje);
  const { estado, ultimo, trancamentoAberto } = aluno.resumo;
  const atual = textoDoPeriodo(aluno.planoUltimo, aluno.resumo);
  const aberto = aluno.trancamentos.find((t) => t.volta === null);

  let conteudo: React.ReactNode;
  if (aluno.encerrado) {
    conteudo = (
      <Impedimento alunoId={aluno.id}>{MENSAGEM_ENCERRADO}</Impedimento>
    );
  } else if (aberto || trancamentoAberto) {
    const desde = (aberto ?? trancamentoAberto)?.inicio;
    conteudo = (
      <Impedimento alunoId={aluno.id}>
        Este período já está trancado
        {desde ? ` desde ${formatarDia(desde)}` : ""}. Destranque antes de
        trancar de novo.
      </Impedimento>
    );
  } else if (
    !ultimo ||
    (estado !== "vigente" && estado !== "comeca_em_breve")
  ) {
    conteudo = (
      <Impedimento alunoId={aluno.id}>
        Só dá para trancar um período vigente ou que começa em breve.
      </Impedimento>
    );
  } else {
    conteudo = (
      <FormularioTrancar
        alunoId={aluno.id}
        inicioPadrao={hoje > ultimo.inicio ? hoje : ultimo.inicio}
        fimAtual={ultimo.fimEfetivo}
      />
    );
  }
  return (
    <Moldura
      aluno={aluno}
      titulo="Trancar"
      detalhe={atual && `Atual: ${atual}`}
    >
      {conteudo}
    </Moldura>
  );
}
