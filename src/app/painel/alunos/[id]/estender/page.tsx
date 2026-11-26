import { MENSAGEM_ENCERRADO } from "@/servidor/alunos/cadastro";
import { hojeEmSaoPaulo } from "@/servidor/alunos/datas";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { obterUnidadeAjustes } from "@/servidor/configuracoes/unidade";
import { textoDoPeriodo } from "../../textos";
import { FormularioEstender } from "../formularios/estender";
import { alunoOu404, Impedimento, Moldura, turmasDoAluno } from "../moldura";

export const dynamic = "force-dynamic";

export default async function PaginaEstender({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirAdministracao();
  const { id } = await params;
  const hoje = hojeEmSaoPaulo();
  const aluno = await alunoOu404(id, hoje);
  const ultimo = aluno.resumo.ultimo;
  const atual = textoDoPeriodo(aluno.planoUltimo, aluno.resumo);

  let conteudo: React.ReactNode;
  if (aluno.encerrado) {
    conteudo = (
      <Impedimento alunoId={aluno.id}>{MENSAGEM_ENCERRADO}</Impedimento>
    );
  } else if (!ultimo) {
    conteudo = (
      <Impedimento alunoId={aluno.id}>
        Este aluno ainda não tem período. Registre o período antes de estender.
      </Impedimento>
    );
  } else {
    const turmas = turmasDoAluno(aluno);
    const unidadePadrao =
      turmas.length > 0 ? await obterUnidadeAjustes(obterBanco()) : "dias";
    conteudo = (
      <FormularioEstender
        alunoId={aluno.id}
        fimAtual={ultimo.fimEfetivo}
        unidadePadrao={unidadePadrao}
        turmas={turmas}
      />
    );
  }
  return (
    <Moldura
      aluno={aluno}
      titulo="Estender"
      detalhe={atual && `Atual: ${atual}`}
    >
      {conteudo}
    </Moldura>
  );
}
