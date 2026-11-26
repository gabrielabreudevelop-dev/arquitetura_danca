import { MENSAGEM_ENCERRADO } from "@/servidor/alunos/cadastro";
import { carregarAlunos } from "@/servidor/alunos/carga";
import { hojeEmSaoPaulo } from "@/servidor/alunos/datas";
import { diasRestantes } from "@/servidor/alunos/estado";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { obterUnidadeAjustes } from "@/servidor/configuracoes/unidade";
import { textoDoPeriodo } from "../../textos";
import {
  FormularioTransferir,
  type Recebedor,
} from "../formularios/transferir";
import { alunoOu404, Impedimento, Moldura, turmasDoAluno } from "../moldura";

export const dynamic = "force-dynamic";

export default async function PaginaTransferir({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ para?: string | string[] }>;
}) {
  await exigirAdministracao();
  const { id } = await params;
  const { para } = await searchParams;
  const hoje = hojeEmSaoPaulo();
  const db = obterBanco();
  const aluno = await alunoOu404(id, hoje);
  const ultimo = aluno.resumo.ultimo;
  const atual = textoDoPeriodo(aluno.planoUltimo, aluno.resumo);

  let conteudo: React.ReactNode;
  if (aluno.encerrado) {
    conteudo = (
      <Impedimento alunoId={aluno.id}>{MENSAGEM_ENCERRADO}</Impedimento>
    );
  } else if (aluno.resumo.estado !== "vigente" || !ultimo) {
    conteudo = (
      <Impedimento alunoId={aluno.id}>
        Só é possível transferir de um período vigente e não trancado.
      </Impedimento>
    );
  } else {
    const recebedores: Recebedor[] = (await carregarAlunos(db, hoje))
      .filter((a) => !a.encerrado && a.id !== aluno.id)
      .map((a) => ({
        id: a.id,
        nome: a.nome,
        recebeNoPeriodo:
          a.resumo.ultimo !== null && a.resumo.ultimo.fimEfetivo >= hoje,
      }));
    const paraInicial =
      typeof para === "string" &&
      recebedores.some((r) => r.id === para.toLowerCase())
        ? para.toLowerCase()
        : "";
    const turmas = turmasDoAluno(aluno);
    const unidadePadrao =
      turmas.length > 0 ? await obterUnidadeAjustes(db) : "dias";
    conteudo = (
      <FormularioTransferir
        aluno={{
          id: aluno.id,
          primeiroNome: aluno.nome.trim().split(/\s+/)[0] ?? aluno.nome,
        }}
        recebedores={recebedores}
        paraInicial={paraInicial}
        fimAtual={ultimo.fimEfetivo}
        restantes={diasRestantes(aluno.resumo, hoje)}
        hoje={hoje}
        unidadePadrao={unidadePadrao}
        turmas={turmas}
      />
    );
  }
  return (
    <Moldura
      aluno={aluno}
      titulo="Transferir dias"
      detalhe={atual && `Atual: ${atual}`}
    >
      {conteudo}
    </Moldura>
  );
}
