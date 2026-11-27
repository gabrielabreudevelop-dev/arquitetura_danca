import Link from "next/link";
import type { PessoaDeContato, UltimoContato } from "@/servidor/alunos/carga";
import { type AlunoCarregado, carregarAlunos } from "@/servidor/alunos/carga";
import { hojeEmSaoPaulo } from "@/servidor/alunos/datas";
import {
  type FiltrosContatos,
  JANELAS,
  type Janela,
  type LinhaContato,
  lerFiltrosContatos,
  linhasDeContato,
  urlContatos,
} from "@/servidor/alunos/listas";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import {
  type BolsistaCarregado,
  carregarBolsistas,
} from "@/servidor/bolsistas/carga";
import {
  contarBolsistas,
  type LinhaBolsista,
  linhasBolsistasSemVir,
} from "@/servidor/bolsistas/listas";
import { diasCurtos } from "@/servidor/bolsistas/textos";
import { mensagemAtiva } from "@/servidor/configuracoes/mensagens-prontas";
import {
  MENSAGEM_RECENTE,
  ultimosGruposDosAlunos,
} from "@/servidor/contatos/contatos";
import { primeiroNome } from "@/servidor/contatos/mensagens";
import { mensagemDoErro } from "@/servidor/contatos/pedido-abrir";
import {
  LISTAS_ALUNO,
  LISTAS_BOLSISTA,
  type ListaContato,
  RESULTADOS_ALUNO,
  RESULTADOS_BOLSISTA,
  type ResultadoContato,
} from "@/servidor/contatos/valores";
import { textoDoEstado } from "../alunos/textos";
import { textoDaFrequencia } from "../bolsistas/textos";
import { Opcoes } from "../opcoes";
import { BotaoWhatsapp, FormularioResultado } from "./formularios";
import {
  textoDoUltimoContato,
  textoSemMensagem,
  textoTotalBolsistas,
  textoUltimaPresenca,
  textoVazio,
} from "./textos";

export const dynamic = "force-dynamic";

const LINK = "text-link underline decoration-link underline-offset-4";
const LINK_TOQUE = `-mx-2 inline-flex min-h-12 items-center px-2 ${LINK}`;

function alunosNasLinhas(linhas: LinhaContato[]): number {
  return linhas.reduce((soma, l) => soma + l.alunos.length, 0);
}

/** Turmas e período de um aluno: "Forró Iniciante · ter e qui 19h · venceu em 02/11". */
function detalheDoAluno(a: AlunoCarregado): string {
  const turmas =
    a.matriculas.length === 0
      ? "Sem turma"
      : a.matriculas.map((m) => m.rotulo).join(" e ");
  return `${turmas} · ${textoDoEstado(a.resumo)}`;
}

type Ficha = { id: string; nome: string; href: string };

/** Quem recebe a mensagem: a pessoa e, se for responsável, os menores com link para a ficha. */
function QuemRecebe({
  pessoa,
  fichas,
}: {
  pessoa: PessoaDeContato;
  fichas: Ficha[];
}) {
  const links = fichas.map((f, i) => (
    <span key={f.id}>
      {i > 0 && (
        <span className="font-normal">
          {i === fichas.length - 1 ? " e " : ", "}
        </span>
      )}
      <Link href={f.href} className={LINK_TOQUE}>
        {fichas.length > 1 || pessoa.ehResponsavel
          ? primeiroNome(f.nome)
          : f.nome}
      </Link>
    </span>
  ));
  if (!pessoa.ehResponsavel) {
    return <p className="font-semibold">{links}</p>;
  }
  return (
    <p className="font-semibold">
      {pessoa.nome}
      <span className="font-normal text-texto-suave">, responsável por </span>
      {links}
    </p>
  );
}

/**
 * Coluna de contato de uma linha (aluno ou bolsista): WhatsApp (com o aviso de
 * contato recente), resultado do último contato e, em "não volta", os links
 * de encerrar/inativar passados em `aoNaoVolta`.
 */
function CelulaContato({
  pessoa,
  ids,
  lista,
  filtros,
  ultimoContato,
  grupos,
  confirmar,
  resultados,
  cadastrarHref,
  aoNaoVolta,
}: {
  pessoa: PessoaDeContato;
  ids: string[];
  lista: ListaContato;
  filtros: FiltrosContatos;
  ultimoContato: UltimoContato | null;
  grupos: string[];
  confirmar: boolean;
  resultados: readonly ResultadoContato[];
  cadastrarHref: string;
  aoNaoVolta: React.ReactNode;
}) {
  const botao = {
    alunoIds: ids,
    lista,
    visto: ultimoContato?.grupoId ?? null,
    filtros,
  };
  return (
    <div className="flex flex-col gap-4">
      {pessoa.whatsapp && confirmar ? (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-erro">
            {MENSAGEM_RECENTE}
          </p>
          <BotaoWhatsapp
            {...botao}
            confirmar
            depois={urlContatos(filtros)}
            rotuloAcessivel={`Chamar ${pessoa.nome} mesmo assim`}
          >
            Chamar mesmo assim
          </BotaoWhatsapp>
        </div>
      ) : pessoa.whatsapp ? (
        <BotaoWhatsapp
          {...botao}
          rotuloAcessivel={`WhatsApp para ${pessoa.nome}`}
        >
          WhatsApp
        </BotaoWhatsapp>
      ) : (
        <p>
          Sem WhatsApp.{" "}
          <Link href={cadastrarHref} className={LINK_TOQUE}>
            Cadastrar número
          </Link>
        </p>
      )}
      {ultimoContato && grupos.length > 0 && (
        <FormularioResultado
          key={`${grupos.join()}-${ultimoContato.resultado}`}
          pessoaId={pessoa.pessoaId}
          grupoIds={grupos}
          atual={ultimoContato.resultado}
          nome={pessoa.nome}
          resultados={resultados}
        />
      )}
      {ultimoContato?.resultado === "nao_volta" && aoNaoVolta}
    </div>
  );
}

function Linha({
  linha,
  filtros,
  hoje,
  grupos,
  confirmar,
}: {
  linha: LinhaContato;
  filtros: FiltrosContatos;
  hoje: string;
  /** Grupo do último contato de cada aluno da linha (o resultado vale para todos). */
  grupos: string[];
  /** Outra pessoa da equipe chamou há pouco: aviso e "Chamar mesmo assim" (R17). */
  confirmar: boolean;
}) {
  const { pessoa, alunos, ultimoContato } = linha;
  const varios = alunos.length > 1;
  return (
    <tr className="flex flex-col gap-4 border-linha border-b py-6 first:border-t md:table-row md:first:border-t-0">
      <td className="flex flex-col gap-1 md:table-cell md:py-6 md:pr-6 md:align-top">
        <QuemRecebe
          pessoa={pessoa}
          fichas={alunos.map((a) => ({
            id: a.id,
            nome: a.nome,
            href: `/painel/alunos/${a.id}`,
          }))}
        />
        <ul className="flex flex-col gap-1 text-texto-suave">
          {alunos.map((a) => (
            <li key={a.id}>
              {varios && `${primeiroNome(a.nome)}: `}
              {detalheDoAluno(a)}
              {a.contato.usandoNumeroDoResponsavel && (
                <span className="block">
                  {`sem WhatsApp próprio — usando o de ${primeiroNome(pessoa.nome)} (responsável)`}
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="text-pequeno text-texto-suave">
          {textoDoUltimoContato(linha, hoje)}
        </p>
      </td>
      <td className="flex flex-col gap-4 md:table-cell md:w-80 md:py-6 md:align-top">
        <CelulaContato
          pessoa={pessoa}
          ids={alunos.map((a) => a.id)}
          lista={filtros.lista}
          filtros={filtros}
          ultimoContato={ultimoContato}
          grupos={grupos}
          confirmar={confirmar}
          resultados={RESULTADOS_ALUNO}
          cadastrarHref={`/painel/alunos/${alunos[0].id}/editar`}
          aoNaoVolta={alunos.map((a) => (
            <Link
              key={a.id}
              href={`/painel/alunos/${a.id}/encerrar`}
              className={`${LINK_TOQUE} self-start`}
            >
              {varios ? `Encerrar ${primeiroNome(a.nome)}` : "Encerrar aluno"}
            </Link>
          ))}
        />
      </td>
    </tr>
  );
}

/** Dias, última presença e frequência do mês de um bolsista da linha. */
function detalheDoBolsista(
  b: BolsistaCarregado,
  hoje: string,
  janela: Janela,
): string {
  const dias = b.diasHoje ? diasCurtos(b.diasHoje) : "sem dias combinados";
  return `${dias} · ${textoUltimaPresenca(b.semVir[janela].ultimaPresenca, hoje)}`;
}

function LinhaDeBolsista({
  linha,
  filtros,
  hoje,
  grupos,
  confirmar,
}: {
  linha: LinhaBolsista;
  filtros: FiltrosContatos;
  hoje: string;
  grupos: string[];
  confirmar: boolean;
}) {
  const { pessoa, bolsistas, ultimoContato } = linha;
  const varios = bolsistas.length > 1;
  return (
    <tr className="flex flex-col gap-4 border-linha border-b py-6 first:border-t md:table-row md:first:border-t-0">
      <td className="flex flex-col gap-1 md:table-cell md:py-6 md:pr-6 md:align-top">
        <QuemRecebe
          pessoa={pessoa}
          fichas={bolsistas.map((b) => ({
            id: b.id,
            nome: b.nome,
            href: `/painel/bolsistas/${b.id}`,
          }))}
        />
        <ul className="flex flex-col gap-1 text-texto-suave">
          {bolsistas.map((b) => (
            <li key={b.id} className="flex flex-col">
              <span>
                {varios && `${primeiroNome(b.nome)}: `}
                {detalheDoBolsista(b, hoje, filtros.janela)}
              </span>
              <span>Neste mês: {textoDaFrequencia(b.mes)}</span>
              {b.contato.usandoNumeroDoResponsavel && (
                <span>
                  {`sem WhatsApp próprio — usando o de ${primeiroNome(pessoa.nome)} (responsável)`}
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="text-pequeno text-texto-suave">
          {textoDoUltimoContato(linha, hoje)}
        </p>
      </td>
      <td className="flex flex-col gap-4 md:table-cell md:w-80 md:py-6 md:align-top">
        <CelulaContato
          pessoa={pessoa}
          ids={bolsistas.map((b) => b.id)}
          lista="bolsista_ausente"
          filtros={filtros}
          ultimoContato={ultimoContato}
          grupos={grupos}
          confirmar={confirmar}
          resultados={RESULTADOS_BOLSISTA}
          cadastrarHref={`/painel/bolsistas/${bolsistas[0].id}/editar`}
          aoNaoVolta={bolsistas.map((b) => (
            <Link
              key={b.id}
              href={`/painel/bolsistas/${b.id}/situacao`}
              className={`${LINK_TOQUE} self-start`}
            >
              {varios
                ? `Inativar ${primeiroNome(b.nome)}`
                : "Inativar bolsista"}
            </Link>
          ))}
        />
      </td>
    </tr>
  );
}

export default async function Contatos({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirAdministracao();
  const params = await searchParams;
  const filtros = lerFiltrosContatos(params);
  const codigoErro = Array.isArray(params.erro) ? params.erro[0] : params.erro;
  const alunoMarcado = Array.isArray(params.aluno)
    ? params.aluno[0]
    : params.aluno;
  const erro = mensagemDoErro(codigoErro);
  const hoje = hojeEmSaoPaulo();
  const agora = new Date();
  const db = obterBanco();
  const ehBolsistas = filtros.lista === "bolsista_ausente";
  const [alunos, bolsistas, mensagem] = await Promise.all([
    carregarAlunos(db, hoje),
    carregarBolsistas(db, hoje),
    mensagemAtiva(
      db,
      ehBolsistas
        ? "bolsista"
        : filtros.lista === "vence_em_breve"
          ? "renovacao"
          : "retorno",
    ),
  ]);

  // Trocar de tipo de lista volta aos filtros padrão da aba de destino
  // (as de aluno usam 7 dias; a de bolsistas, 15).
  const filtrosDe = (lista: FiltrosContatos["lista"]): FiltrosContatos =>
    (lista === "bolsista_ausente") === ehBolsistas
      ? { ...filtros, lista }
      : lerFiltrosContatos({ lista });
  const vencem = linhasDeContato(
    alunos,
    filtrosDe("vence_em_breve"),
    hoje,
    agora,
  );
  const vencidos = linhasDeContato(alunos, filtrosDe("vencido"), hoje, agora);
  const filtrosBolsistas = filtrosDe("bolsista_ausente");
  const semVir = linhasBolsistasSemVir(
    bolsistas,
    filtrosBolsistas.janela,
    agora,
  );
  const totalSemVir = contarBolsistas(
    bolsistas,
    filtrosBolsistas.janela,
  ).semVir;
  const linhas = filtros.lista === "vence_em_breve" ? vencem : vencidos;
  const itensDasLinhas = ehBolsistas
    ? semVir.flatMap((l) =>
        l.bolsistas.map((b) => ({ id: b.id, pessoaId: l.pessoa.pessoaId })),
      )
    : linhas.flatMap((l) =>
        l.alunos.map((a) => ({ id: a.id, pessoaId: l.pessoa.pessoaId })),
      );
  const ultimosGrupos = await ultimosGruposDosAlunos(
    db,
    itensDasLinhas.map((i) => ({ alunoId: i.id, pessoaId: i.pessoaId })),
    ehBolsistas ? LISTAS_BOLSISTA : LISTAS_ALUNO,
  );
  const gruposDe = (ids: string[]): string[] => [
    ...new Set(
      ids
        .map((id) => ultimosGrupos.get(id))
        .filter((g): g is string => g !== undefined),
    ),
  ];

  // R17: o aviso de contato recente vai na linha do aluno (ou bolsista)
  // marcado; se ela não estiver na lista, fica no topo, como os outros erros.
  const marcado = codigoErro === "recente" ? alunoMarcado : undefined;
  const linhaConfirmar = marcado
    ? linhas.find((l) => l.alunos.some((a) => a.id === marcado))
    : undefined;
  const linhaConfirmarBolsista = marcado
    ? semVir.find((l) => l.bolsistas.some((b) => b.id === marcado))
    : undefined;
  const erroNoTopo = (ehBolsistas ? linhaConfirmarBolsista : linhaConfirmar)
    ? null
    : erro;

  const abas = [
    {
      lista: "vence_em_breve" as const,
      rotulo: "Vencem em breve",
      quantidade: alunosNasLinhas(vencem),
    },
    {
      lista: "vencido" as const,
      rotulo: "Vencidos",
      quantidade: alunosNasLinhas(vencidos),
    },
    {
      lista: "bolsista_ausente" as const,
      rotulo: "Bolsistas sem vir",
      quantidade: totalSemVir,
    },
  ];

  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12 md:px-12 md:py-16"
    >
      <h1 className="text-titulo">Contatos</h1>

      {erroNoTopo && (
        <p role="alert" className="text-erro">
          {erroNoTopo}
        </p>
      )}

      <nav aria-label="Listas de contato">
        <ul className="flex border-linha border-b">
          {abas.map((aba) => {
            const atual = aba.lista === filtros.lista;
            return (
              <li key={aba.lista} className="flex-1 md:flex-none">
                <Link
                  href={urlContatos(filtrosDe(aba.lista))}
                  aria-current={atual ? "page" : undefined}
                  className={`-mb-px flex min-h-12 items-center justify-center border-b-2 px-4 text-center md:px-6 ${
                    atual
                      ? "border-marca font-semibold"
                      : "border-transparent text-link hover:border-linha"
                  }`}
                >
                  {aba.rotulo} ({aba.quantidade})
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex flex-col gap-6 md:flex-row md:flex-wrap md:items-end">
        {ehBolsistas ? (
          <Opcoes
            id="filtro-janela-bolsistas"
            rotulo="Sem vir há"
            opcoes={JANELAS.map((j) => ({
              rotulo: `${j} dias`,
              href: urlContatos({ ...filtros, janela: j }),
              atual: j === filtros.janela,
            }))}
          />
        ) : filtros.lista === "vence_em_breve" ? (
          <Opcoes
            id="filtro-janela"
            rotulo="Vencem nos próximos"
            opcoes={JANELAS.map((j) => ({
              rotulo: `${j} dias`,
              href: urlContatos({ ...filtros, janela: j }),
              atual: j === filtros.janela,
            }))}
          />
        ) : (
          <>
            <Opcoes
              id="filtro-vencidos"
              rotulo="Venceram"
              opcoes={[
                {
                  rotulo: "Últimos 90 dias",
                  href: urlContatos({ ...filtros, todos: false }),
                  atual: !filtros.todos,
                },
                {
                  rotulo: "Todos",
                  href: urlContatos({ ...filtros, todos: true }),
                  atual: filtros.todos,
                },
              ]}
            />
            <Opcoes
              id="filtro-contato"
              rotulo="Contato"
              empilhar
              opcoes={[
                {
                  rotulo: "Com ou sem contato",
                  href: urlContatos({ ...filtros, semContato: false }),
                  atual: !filtros.semContato,
                },
                {
                  rotulo: "Só sem contato desde que venceu",
                  href: urlContatos({ ...filtros, semContato: true }),
                  atual: filtros.semContato,
                },
              ]}
            />
          </>
        )}
      </div>

      {!mensagem && (
        <p className="bg-rosa-suave px-4 py-3">
          {textoSemMensagem(filtros.lista)}{" "}
          <Link href="/painel/configuracoes" className={LINK_TOQUE}>
            Ir para configurações
          </Link>
        </p>
      )}

      {ehBolsistas && semVir.length > 0 && (
        <p className="font-semibold">
          {textoTotalBolsistas(totalSemVir, filtros.janela)}
        </p>
      )}

      {(ehBolsistas ? semVir.length : linhas.length) === 0 ? (
        <section className="flex max-w-prose flex-col gap-2 border-linha border-t pt-6">
          <h2 className="text-base">{textoVazio(filtros)}</h2>
          <p className="text-texto-suave">
            {ehBolsistas
              ? "Bolsistas ativos que não vieram na janela escolhida aparecem aqui, de quem está há mais tempo sem vir ao mais recente."
              : filtros.lista === "vence_em_breve"
                ? "Quem estiver com o período perto do fim aparece aqui, do que vence primeiro ao último."
                : "Quem tiver o período vencido aparece aqui, do que venceu mais recentemente ao mais antigo."}
          </p>
        </section>
      ) : (
        <table className="block w-full md:table">
          <caption className="sr-only">
            {ehBolsistas
              ? "Bolsistas sem vir, por pessoa de contato"
              : filtros.lista === "vence_em_breve"
                ? "Alunos que vencem em breve, por pessoa de contato"
                : "Alunos vencidos, por pessoa de contato"}
          </caption>
          <thead className="hidden md:table-header-group">
            <tr className="border-linha border-b text-left">
              <th scope="col" className="py-3 pr-6 font-semibold">
                Quem recebe
              </th>
              <th scope="col" className="py-3 font-semibold">
                Contato
              </th>
            </tr>
          </thead>
          <tbody className="block md:table-row-group">
            {ehBolsistas
              ? semVir.map((l) => (
                  <LinhaDeBolsista
                    key={l.pessoa.pessoaId}
                    linha={l}
                    filtros={filtros}
                    hoje={hoje}
                    grupos={gruposDe(l.bolsistas.map((b) => b.id))}
                    confirmar={l === linhaConfirmarBolsista}
                  />
                ))
              : linhas.map((l) => (
                  <Linha
                    key={l.pessoa.pessoaId}
                    linha={l}
                    filtros={filtros}
                    hoje={hoje}
                    grupos={gruposDe(l.alunos.map((a) => a.id))}
                    confirmar={l === linhaConfirmar}
                  />
                ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
