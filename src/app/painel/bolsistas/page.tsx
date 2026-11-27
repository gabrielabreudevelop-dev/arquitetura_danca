import Link from "next/link";
import {
  formatarDataCompleta,
  formatarDia,
  hojeEmSaoPaulo,
} from "@/servidor/alunos/datas";
import { JANELAS } from "@/servidor/alunos/listas";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { carregarBolsistas } from "@/servidor/bolsistas/carga";
import {
  contarBolsistas,
  filtrarBolsistas,
  lerFiltrosBolsistas,
  urlBolsistas,
} from "@/servidor/bolsistas/listas";
import { ultimaMudanca } from "@/servidor/bolsistas/regras";
import { diasCurtos, ROTULOS_PREFERENCIA } from "@/servidor/bolsistas/textos";
import { DIAS_SEMANA } from "@/servidor/vitrine/texto";
import { Opcoes } from "../opcoes";
import { nomeDoMes, textoCurtoDaFrequencia } from "./textos";

export const dynamic = "force-dynamic";

const BOTAO =
  "inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-acao px-6 font-semibold text-fundo hover:bg-acao-escura md:w-auto";
const SECUNDARIO =
  "min-h-12 w-full rounded-sm border border-acao px-6 font-semibold text-link hover:bg-acao hover:text-fundo md:w-auto";
const LINK = "text-link underline decoration-link underline-offset-4";
const LINK_TOQUE = `-mx-2 flex min-h-12 items-center self-start px-2 ${LINK}`;
const CONTROLE =
  "min-h-12 w-full rounded-sm border border-borda bg-transparent px-3 text-base";
const VAZIO = "flex max-w-prose flex-col gap-4 border-linha border-t pt-6";

/** Aba "Bolsistas sem vir" de `/painel/contatos`, com a janela escolhida. */
function urlSemVir(janela: number): string {
  return `/painel/contatos?${new URLSearchParams({ lista: "bolsista_ausente", janela: String(janela) })}`;
}

export default async function Bolsistas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirAdministracao();
  const filtros = lerFiltrosBolsistas(await searchParams);
  const hoje = hojeEmSaoPaulo();
  const bolsistas = await carregarBolsistas(obterBanco(), hoje);
  const lista = filtrarBolsistas(bolsistas, filtros);
  const numeros = contarBolsistas(bolsistas, filtros.janela);
  const inativos = filtros.situacao === "inativos";
  const camposMantidos = new URLSearchParams(
    urlBolsistas({ ...filtros, busca: undefined }).split("?")[1] ?? "",
  );

  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12 md:px-12 md:py-16"
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <h1 className="text-titulo">Bolsistas</h1>
        {bolsistas.length > 0 && (
          <Link href="/painel/bolsistas/novo" className={BOTAO}>
            Novo bolsista
          </Link>
        )}
      </div>

      {bolsistas.length === 0 ? (
        <section className={VAZIO}>
          <h2 className="text-base">Nenhum bolsista cadastrado</h2>
          <p className="text-texto-suave">
            Cadastre os bolsistas com os dias combinados e a preferência na
            dança. Depois, a chamada de cada turma mostra quem veio, e a lista
            avisa quem está sem vir.
          </p>
          <Link
            href="/painel/bolsistas/novo"
            className={`${BOTAO} md:self-start`}
          >
            Novo bolsista
          </Link>
        </section>
      ) : (
        <>
          <section aria-label="Números" className="flex flex-col gap-6">
            <p>
              <span className="font-semibold">
                {numeros.ativos} {numeros.ativos === 1 ? "ativo" : "ativos"}
              </span>
              {numeros.porDia.map((d) => (
                <span key={d.dia} className="whitespace-nowrap">
                  {" "}
                  · {DIAS_SEMANA[d.dia]?.exibicao} {d.quantidade}
                </span>
              ))}
            </p>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-8">
              <Opcoes
                rotulo="Sem vir há"
                id="filtro-janela"
                opcoes={JANELAS.map((j) => ({
                  rotulo: `${j} dias`,
                  href: urlBolsistas({ ...filtros, janela: j }),
                  atual: j === filtros.janela,
                }))}
              />
              {numeros.semVir === 0 ? (
                <p className="flex min-h-12 items-center text-texto-suave">
                  Ninguém sem vir há {filtros.janela} dias.
                </p>
              ) : (
                <Link
                  href={urlSemVir(filtros.janela)}
                  className="-mx-2 flex min-h-12 items-center gap-2 px-2 hover:bg-fundo-suave"
                >
                  <span className={`font-semibold ${LINK}`}>
                    {numeros.semVir} sem vir
                    <span aria-hidden="true"> →</span>
                  </span>
                  <span className="text-texto-suave">chamar no WhatsApp</span>
                </Link>
              )}
            </div>
          </section>

          <div className="flex flex-col gap-6 border-linha border-t pt-6 md:flex-row md:items-end md:gap-8">
            <search className="min-w-0 flex-1">
              <form
                method="get"
                action="/painel/bolsistas"
                className="flex flex-col gap-2"
              >
                {/* Os outros filtros fora do padrão seguem junto com a busca. */}
                {[...camposMantidos].map(([nome, valor]) => (
                  <input key={nome} type="hidden" name={nome} value={valor} />
                ))}
                <label htmlFor="filtro-busca" className="font-semibold">
                  Buscar
                </label>
                <div className="flex flex-col gap-4 md:flex-row">
                  <input
                    id="filtro-busca"
                    type="search"
                    name="busca"
                    defaultValue={filtros.busca ?? ""}
                    placeholder="Nome"
                    autoComplete="off"
                    className={CONTROLE}
                  />
                  <button type="submit" className={SECUNDARIO}>
                    Buscar
                  </button>
                </div>
              </form>
            </search>
            <Opcoes
              rotulo="Situação"
              id="filtro-situacao"
              opcoes={(["ativos", "inativos"] as const).map((s) => ({
                rotulo: s === "ativos" ? "Ativos" : "Inativos",
                href: urlBolsistas({ ...filtros, situacao: s }),
                atual: s === filtros.situacao,
              }))}
            />
          </div>

          {lista.length === 0 ? (
            <section className={VAZIO}>
              {filtros.busca ? (
                <>
                  <h2 className="text-base">
                    Nenhum bolsista {inativos ? "inativo" : "ativo"} com esse
                    nome.
                  </h2>
                  <Link
                    href={urlBolsistas({ ...filtros, busca: undefined })}
                    className={LINK_TOQUE}
                  >
                    Limpar busca
                  </Link>
                </>
              ) : (
                <>
                  <h2 className="text-base">
                    Nenhum bolsista {inativos ? "inativo" : "ativo"}.
                  </h2>
                  <p className="text-texto-suave">
                    {inativos
                      ? "Quem for inativado pela ficha aparece aqui, com a data."
                      : "Os bolsistas inativos continuam em “Inativos”, e dá para reativar pela ficha."}
                  </p>
                </>
              )}
            </section>
          ) : (
            <table className="block w-full md:table">
              <caption className="sr-only">
                Bolsistas {inativos ? "inativos" : "ativos"}, com dias
                combinados, preferência e frequência do mês
              </caption>
              <thead className="hidden md:table-header-group">
                <tr className="border-linha border-b text-left">
                  <th scope="col" className="py-3 pr-6 font-semibold">
                    Bolsista
                  </th>
                  <th scope="col" className="py-3 pr-6 font-semibold">
                    Dias
                  </th>
                  <th scope="col" className="py-3 pr-6 font-semibold">
                    Preferência
                  </th>
                  <th scope="col" className="py-3 font-semibold">
                    {inativos ? "Situação" : `Frequência em ${nomeDoMes(hoje)}`}
                  </th>
                </tr>
              </thead>
              <tbody className="block md:table-row-group">
                {lista.map((b) => {
                  const ultima = ultimaMudanca(b.historico);
                  return (
                    <tr
                      key={b.id}
                      className="flex flex-col gap-1 border-linha border-b py-3 first:border-t md:table-row md:first:border-t-0"
                    >
                      <td className="block md:table-cell md:pr-6 md:align-top">
                        <Link
                          href={`/painel/bolsistas/${b.id}`}
                          className={`-mx-2 inline-flex min-h-12 items-center px-2 font-semibold ${LINK}`}
                        >
                          {b.nome}
                        </Link>
                        {b.menor && (
                          <span className="text-texto-suave"> (menor)</span>
                        )}
                      </td>
                      <td className="block md:table-cell md:py-3 md:pr-6 md:align-top md:whitespace-nowrap">
                        {b.diasHoje ? diasCurtos(b.diasHoje) : "Sem dias"}
                        {/* No celular, a preferência vem na mesma linha dos dias. */}
                        <span className="text-texto-suave md:hidden">
                          {" "}
                          · {ROTULOS_PREFERENCIA[b.preferencia]}
                        </span>
                      </td>
                      <td className="hidden md:table-cell md:py-3 md:pr-6 md:align-top">
                        {ROTULOS_PREFERENCIA[b.preferencia]}
                      </td>
                      <td className="block text-texto-suave md:table-cell md:py-3 md:align-top md:whitespace-nowrap md:text-texto">
                        {inativos ? (
                          ultima ? (
                            `Inativo desde ${ultima.data.slice(0, 4) === hoje.slice(0, 4) ? formatarDia(ultima.data) : formatarDataCompleta(ultima.data)}`
                          ) : (
                            "Inativo"
                          )
                        ) : (
                          <>
                            <span className="md:hidden">
                              {nomeDoMes(hoje)}:{" "}
                            </span>
                            {textoCurtoDaFrequencia(b.mes)}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </main>
  );
}
