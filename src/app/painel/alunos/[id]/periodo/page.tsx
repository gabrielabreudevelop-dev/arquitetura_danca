import Link from "next/link";
import { notFound } from "next/navigation";
import { MENSAGEM_ENCERRADO } from "@/servidor/alunos/cadastro";
import {
  formatarDia,
  hojeEmSaoPaulo,
  somarDias,
} from "@/servidor/alunos/datas";
import {
  periodoParaCorrigir,
  sugestaoDePeriodo,
} from "@/servidor/alunos/periodos";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { formatarDuracao, listarPlanos } from "@/servidor/configuracoes/planos";
import { textoDoPeriodo } from "../../textos";
import { fimPeloPlanoOuVazio } from "../calculos";
import {
  FormularioPeriodo,
  type PlanoDoFormulario,
} from "../formularios/periodo";
import { alunoOu404, Impedimento, Moldura } from "../moldura";

export const dynamic = "force-dynamic";

export default async function PaginaPeriodo({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ corrigir?: string | string[] }>;
}) {
  await exigirAdministracao();
  const { id } = await params;
  const { corrigir } = await searchParams;
  const hoje = hojeEmSaoPaulo();
  const db = obterBanco();
  const aluno = await alunoOu404(id, hoje);

  const errado =
    corrigir === undefined
      ? null
      : typeof corrigir === "string"
        ? await periodoParaCorrigir(db, aluno.id, corrigir)
        : null;
  if (corrigir !== undefined && !errado) notFound();

  const atual = textoDoPeriodo(aluno.planoUltimo, aluno.resumo);
  const titulo = errado
    ? "Corrigir período"
    : aluno.resumo.ultimo
      ? "Renovar"
      : "Registrar período";
  const detalhe = errado
    ? `Período a corrigir: ${formatarDia(errado.inicio)} a ${formatarDia(errado.fim)}`
    : atual && `Atual: ${atual}`;

  if (aluno.encerrado) {
    return (
      <Moldura aluno={aluno} titulo={titulo} detalhe={detalhe}>
        <Impedimento alunoId={aluno.id}>{MENSAGEM_ENCERRADO}</Impedimento>
      </Moldura>
    );
  }

  const planos: PlanoDoFormulario[] = (
    await listarPlanos(db, { somenteAtivos: true })
  ).map((p) => ({
    id: p.id,
    nome: p.nome,
    quantidade: p.duracaoQuantidade,
    unidade: p.duracaoUnidade,
    duracao: formatarDuracao(p.duracaoQuantidade, p.duracaoUnidade),
  }));
  if (planos.length === 0) {
    return (
      <Moldura aluno={aluno} titulo={titulo} detalhe={detalhe}>
        <div className="flex flex-col gap-4">
          <p className="font-semibold">Nenhum plano ativo</p>
          <p className="max-w-prose text-texto-suave">
            Para registrar um período, cadastre (ou reative) os planos do
            estúdio em Configurações.
          </p>
          <Link
            href="/painel/configuracoes"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-acao px-6 font-semibold text-fundo hover:bg-acao-escura md:w-auto md:self-start"
          >
            Ir para Configurações
          </Link>
        </div>
      </Moldura>
    );
  }

  let inicial: { planoId: string; inicio: string };
  let ajudaInicio: string | undefined;
  if (errado) {
    inicial = {
      planoId: planos.some((p) => p.id === errado.planoId)
        ? (errado.planoId ?? "")
        : "",
      inicio: errado.inicio,
    };
  } else {
    const sugestao = await sugestaoDePeriodo(db, aluno.id, hoje);
    inicial = { planoId: sugestao.planoId ?? "", inicio: sugestao.inicio };
    if (sugestao.inicioMinimo) {
      ajudaInicio = `O período atual vai até ${formatarDia(somarDias(sugestao.inicioMinimo, -1))}. O novo começa a partir de ${formatarDia(sugestao.inicioMinimo)}.`;
    }
  }
  const plano = planos.find((p) => p.id === inicial.planoId);
  const fim = errado ? errado.fim : fimPeloPlanoOuVazio(inicial.inicio, plano);

  return (
    <Moldura aluno={aluno} titulo={titulo} detalhe={detalhe}>
      {errado && (
        <p className="max-w-prose bg-rosa-suave px-4 py-3">
          Ao salvar, o período de {formatarDia(errado.inicio)} a{" "}
          {formatarDia(errado.fim)} é anulado (motivo “Correção”) e o novo é
          registrado no lugar.
        </p>
      )}
      <FormularioPeriodo
        alunoId={aluno.id}
        planos={planos}
        inicial={{ ...inicial, fim }}
        corrigir={errado?.id}
        botao={errado ? "Corrigir período" : titulo}
        ajudaInicio={ajudaInicio}
      />
    </Moldura>
  );
}
