import Link from "next/link";
import { carregarAlunos, rotuloDaTurma } from "@/servidor/alunos/carga";
import { hojeEmSaoPaulo } from "@/servidor/alunos/datas";
import {
  filtrarAlunos,
  lerFiltrosAlunos,
  urlAlunos,
} from "@/servidor/alunos/listas";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { listarModulos } from "@/servidor/cadastros/modulos";
import { listarProfessores } from "@/servidor/cadastros/professores";
import { listarRitmos } from "@/servidor/cadastros/ritmos";
import { listarTurmas } from "@/servidor/cadastros/turmas";
import { FiltrosAlunos } from "./filtros";
import { textoDoEstado } from "./textos";

export const dynamic = "force-dynamic";

const BOTAO =
  "inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-acao px-6 font-semibold text-fundo hover:bg-acao-escura md:w-auto";
const BOTAO_SECUNDARIO =
  "inline-flex min-h-12 w-full items-center justify-center rounded-sm border border-acao px-6 font-semibold text-link hover:bg-acao hover:text-fundo md:w-auto";
const LINK = "text-link underline decoration-link underline-offset-4";

/** Desativados continuam nos filtros (alunos podem seguir matriculados), marcados como tal. */
function comDesativado(nome: string, ativo: boolean): string {
  return ativo ? nome : `${nome} (desativado)`;
}

export default async function Alunos({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirAdministracao();
  const filtros = lerFiltrosAlunos(await searchParams);
  const hoje = hojeEmSaoPaulo();
  const db = obterBanco();
  const [alunos, turmas, ritmos, modulos, professores] = await Promise.all([
    carregarAlunos(db, hoje),
    listarTurmas(db),
    listarRitmos(db),
    listarModulos(db),
    listarProfessores(db),
  ]);
  const lista = filtrarAlunos(alunos, filtros, hoje);
  const temFiltro = urlAlunos({ ...filtros, janela: 7 }) !== "/painel/alunos";

  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12 md:px-12 md:py-16"
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <h1 className="text-titulo">Alunos</h1>
        {alunos.length > 0 && (
          <div className="flex flex-col gap-4 md:flex-row">
            <Link
              href="/painel/alunos/estender-turma"
              className={BOTAO_SECUNDARIO}
            >
              Estender turma
            </Link>
            <Link href="/painel/alunos/novo" className={BOTAO}>
              Novo aluno
            </Link>
          </div>
        )}
      </div>

      {alunos.length > 0 && (
        <FiltrosAlunos
          key={urlAlunos(filtros)}
          valores={{
            busca: filtros.busca ?? "",
            turma: filtros.turma ?? "",
            ritmo: filtros.ritmo ?? "",
            modulo: filtros.modulo ?? "",
            professor: filtros.professor ?? "",
            periodo: filtros.periodo ?? "",
            situacao: filtros.situacao,
            janela: String(filtros.janela),
          }}
          turmas={turmas.map((t) => ({
            id: t.id,
            nome: t.ativa
              ? rotuloDaTurma(t)
              : `${rotuloDaTurma(t)} (desativada)`,
          }))}
          ritmos={ritmos.map((r) => ({
            id: r.id,
            nome: comDesativado(r.nome, r.ativo),
          }))}
          modulos={modulos.map((m) => ({
            id: m.id,
            nome: comDesativado(m.nome, m.ativo),
          }))}
          professores={professores.map((p) => ({
            id: p.pessoaId,
            nome: comDesativado(p.nome, p.ativo),
          }))}
          temFiltro={temFiltro}
        />
      )}

      {lista.length === 0 && !temFiltro ? (
        <section className="flex max-w-prose flex-col gap-4 border-linha border-t pt-6">
          <h2 className="text-base">Nenhum aluno cadastrado</h2>
          <p className="text-texto-suave">
            Cadastre os alunos com nascimento, WhatsApp e as turmas em que
            dançam. Os períodos contratados são registrados na ficha de cada um.
          </p>
          <Link href="/painel/alunos/novo" className={`${BOTAO} md:self-start`}>
            Novo aluno
          </Link>
        </section>
      ) : lista.length === 0 ? (
        <section className="flex max-w-prose flex-col gap-4 border-linha border-t pt-6">
          <h2 className="text-base">Nenhum aluno com esses filtros.</h2>
          <Link
            href="/painel/alunos"
            className={`-mx-2 flex min-h-12 items-center self-start px-2 ${LINK}`}
          >
            Limpar filtros
          </Link>
        </section>
      ) : (
        <table className="block w-full md:table">
          <caption className="sr-only">
            Alunos, com turmas e situação do período
          </caption>
          <thead className="hidden md:table-header-group">
            <tr className="border-linha border-b text-left">
              <th scope="col" className="py-3 pr-6 font-semibold">
                Aluno
              </th>
              <th scope="col" className="py-3 pr-6 font-semibold">
                Turmas
              </th>
              <th scope="col" className="py-3 font-semibold">
                Período
              </th>
            </tr>
          </thead>
          <tbody className="block md:table-row-group">
            {lista.map((a) => (
              <tr
                key={a.id}
                className="flex flex-col gap-1 border-linha border-b py-3 first:border-t md:table-row md:first:border-t-0"
              >
                <td className="block md:table-cell md:pr-6 md:align-top">
                  <Link
                    href={`/painel/alunos/${a.id}`}
                    className={`-mx-2 inline-flex min-h-12 items-center px-2 font-semibold ${LINK}`}
                  >
                    {a.nome}
                  </Link>
                  {a.menor && (
                    <span className="text-texto-suave"> (menor)</span>
                  )}
                </td>
                <td className="block text-pequeno text-texto-suave md:table-cell md:py-3 md:pr-6 md:align-top md:text-base">
                  {a.matriculas.length === 0 ? (
                    "Sem turma"
                  ) : (
                    <ul>
                      {a.matriculas.map((m) => (
                        <li key={m.matriculaId}>{m.rotulo}</li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="block md:table-cell md:whitespace-nowrap md:py-3 md:align-top">
                  {textoDoEstado(a.resumo)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
