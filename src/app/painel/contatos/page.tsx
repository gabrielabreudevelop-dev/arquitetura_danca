import Link from "next/link";
import { type AlunoCarregado, carregarAlunos } from "@/servidor/alunos/carga";
import { hojeEmSaoPaulo } from "@/servidor/alunos/datas";
import {
  type FiltrosContatos,
  JANELAS,
  type LinhaContato,
  lerFiltrosContatos,
  linhasDeContato,
  urlContatos,
} from "@/servidor/alunos/listas";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { mensagemAtiva } from "@/servidor/configuracoes/mensagens-prontas";
import { primeiroNome } from "@/servidor/contatos/mensagens";
import { mensagemDoErro } from "@/servidor/contatos/pedido-abrir";
import { textoDoEstado } from "../alunos/textos";
import { BotaoWhatsapp, FormularioResultado } from "./formularios";
import { textoDoUltimoContato, textoSemMensagem, textoVazio } from "./textos";

export const dynamic = "force-dynamic";

const LINK = "text-link underline decoration-link underline-offset-4";
const LINK_TOQUE = `-mx-2 inline-flex min-h-12 items-center px-2 ${LINK}`;

function alunosNasLinhas(linhas: LinhaContato[]): number {
  return linhas.reduce((soma, l) => soma + l.alunos.length, 0);
}

/** Opções de filtro como links: a escolhida fica marcada, sem ser link. */
function Opcoes({
  rotulo,
  id,
  opcoes,
  empilhar = false,
}: {
  rotulo: string;
  id: string;
  opcoes: { rotulo: string; href: string; atual: boolean }[];
  /** No celular, uma opção embaixo da outra (rótulos longos). */
  empilhar?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span id={id} className="font-semibold">
        {rotulo}
      </span>
      <ul
        aria-labelledby={id}
        className={`flex rounded-sm border border-borda ${empilhar ? "flex-col md:flex-row" : ""}`}
      >
        {opcoes.map((o) => (
          <li
            key={o.href}
            className={`flex-1 border-borda ${empilhar ? "border-t first:border-t-0 md:border-t-0 md:border-l md:first:border-l-0" : "border-l first:border-l-0"}`}
          >
            {o.atual ? (
              <span
                aria-current="true"
                className="flex min-h-12 items-center justify-center whitespace-nowrap bg-rosa-suave px-4 font-semibold"
              >
                {o.rotulo}
              </span>
            ) : (
              <Link
                href={o.href}
                className="flex min-h-12 items-center justify-center whitespace-nowrap px-4 text-link hover:bg-fundo-suave"
              >
                {o.rotulo}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Turmas e período de um aluno: "Forró Iniciante · ter e qui 19h · venceu em 02/11". */
function detalheDoAluno(a: AlunoCarregado): string {
  const turmas =
    a.matriculas.length === 0
      ? "Sem turma"
      : a.matriculas.map((m) => m.rotulo).join(" e ");
  return `${turmas} · ${textoDoEstado(a.resumo)}`;
}

function QuemRecebe({ linha }: { linha: LinhaContato }) {
  const { pessoa, alunos } = linha;
  const fichas = alunos.map((a, i) => (
    <span key={a.id}>
      {i > 0 && (
        <span className="font-normal">
          {i === alunos.length - 1 ? " e " : ", "}
        </span>
      )}
      <Link href={`/painel/alunos/${a.id}`} className={LINK}>
        {alunos.length > 1 || pessoa.ehResponsavel
          ? primeiroNome(a.nome)
          : a.nome}
      </Link>
    </span>
  ));
  if (!pessoa.ehResponsavel) {
    return <p className="font-semibold">{fichas}</p>;
  }
  return (
    <p className="font-semibold">
      {pessoa.nome}
      <span className="font-normal text-texto-suave">, responsável por </span>
      {fichas}
    </p>
  );
}

function Linha({
  linha,
  lista,
  hoje,
}: {
  linha: LinhaContato;
  lista: FiltrosContatos["lista"];
  hoje: string;
}) {
  const { pessoa, alunos, ultimoContato } = linha;
  const varios = alunos.length > 1;
  return (
    <tr className="flex flex-col gap-4 border-linha border-b py-6 first:border-t md:table-row md:first:border-t-0">
      <td className="flex flex-col gap-1 md:table-cell md:py-6 md:pr-6 md:align-top">
        <QuemRecebe linha={linha} />
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
        <div className="flex flex-col gap-4">
          {pessoa.whatsapp ? (
            <BotaoWhatsapp
              alunoIds={alunos.map((a) => a.id)}
              lista={lista}
              rotuloAcessivel={`WhatsApp para ${pessoa.nome}`}
            >
              WhatsApp
            </BotaoWhatsapp>
          ) : (
            <p>
              Sem WhatsApp.{" "}
              <Link
                href={`/painel/alunos/${alunos[0].id}/editar`}
                className={LINK}
              >
                Cadastrar número
              </Link>
            </p>
          )}
          {ultimoContato && (
            <FormularioResultado
              key={`${ultimoContato.grupoId}-${ultimoContato.resultado}`}
              grupoId={ultimoContato.grupoId}
              atual={ultimoContato.resultado}
              nome={pessoa.nome}
            />
          )}
          {ultimoContato?.resultado === "nao_volta" &&
            alunos.map((a) => (
              <Link
                key={a.id}
                href={`/painel/alunos/${a.id}/encerrar`}
                className={`${LINK_TOQUE} self-start`}
              >
                {varios ? `Encerrar ${primeiroNome(a.nome)}` : "Encerrar aluno"}
              </Link>
            ))}
        </div>
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
  const erro = mensagemDoErro(
    Array.isArray(params.erro) ? params.erro[0] : params.erro,
  );
  const hoje = hojeEmSaoPaulo();
  const agora = new Date();
  const db = obterBanco();
  const [alunos, mensagem] = await Promise.all([
    carregarAlunos(db, hoje),
    mensagemAtiva(
      db,
      filtros.lista === "vence_em_breve" ? "renovacao" : "retorno",
    ),
  ]);

  const filtrosDe = (lista: FiltrosContatos["lista"]): FiltrosContatos => ({
    ...filtros,
    lista,
  });
  const vencem = linhasDeContato(
    alunos,
    filtrosDe("vence_em_breve"),
    hoje,
    agora,
  );
  const vencidos = linhasDeContato(alunos, filtrosDe("vencido"), hoje, agora);
  const linhas = filtros.lista === "vence_em_breve" ? vencem : vencidos;

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
  ];

  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12 md:px-12 md:py-16"
    >
      <h1 className="text-titulo">Contatos</h1>

      {erro && (
        <p role="alert" className="text-erro">
          {erro}
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
        {filtros.lista === "vence_em_breve" ? (
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
          <Link href="/painel/configuracoes" className={LINK}>
            Ir para configurações
          </Link>
        </p>
      )}

      {linhas.length === 0 ? (
        <section className="flex max-w-prose flex-col gap-2 border-linha border-t pt-6">
          <h2 className="text-base">{textoVazio(filtros)}</h2>
          <p className="text-texto-suave">
            {filtros.lista === "vence_em_breve"
              ? "Quem estiver com o período perto do fim aparece aqui, do que vence primeiro ao último."
              : "Quem tiver o período vencido aparece aqui, do que venceu mais recentemente ao mais antigo."}
          </p>
        </section>
      ) : (
        <table className="block w-full md:table">
          <caption className="sr-only">
            {filtros.lista === "vence_em_breve"
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
            {linhas.map((l) => (
              <Linha
                key={l.pessoa.pessoaId}
                linha={l}
                lista={filtros.lista}
                hoje={hoje}
              />
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
