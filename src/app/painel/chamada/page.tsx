import Link from "next/link";
import { redirect } from "next/navigation";
import { hojeEmSaoPaulo } from "@/servidor/alunos/datas";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { turmasDoDia } from "@/servidor/bolsistas/chamada";
import {
  destinoDoErro,
  diasVizinhos,
  lerData,
  mensagemDoErro,
  urlChamada,
  urlEscolha,
} from "./endereco";
import {
  comMaiuscula,
  naDia,
  nomeDoDia,
  textoDaSituacao,
  tituloDoDia,
} from "./textos";

export const dynamic = "force-dynamic";

const SECUNDARIO =
  "inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-sm border border-acao px-4 font-semibold text-link hover:bg-acao hover:text-fundo";
/** Um botão do grupo de dias (anterior, hoje, seguinte). */
const DIA =
  "flex min-h-12 items-center justify-center whitespace-nowrap px-3 font-semibold text-link hover:bg-fundo-suave md:px-4";
const LINK = "text-link underline decoration-link underline-offset-4";
const VAZIO = "flex max-w-prose flex-col gap-4 border-linha border-t pt-6";

/** Escolha do dia (padrão hoje, nunca futuro) e as turmas daquele dia, com a situação da chamada. */
export default async function EscolhaDoDia({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirAdministracao();
  const params = await searchParams;
  const hoje = hojeEmSaoPaulo();
  const lida = lerData(params.data, hoje);
  if (!lida.ok) redirect(urlEscolha({ erro: lida.codigo }, hoje));
  const { data } = lida;
  const turmas = await turmasDoDia(obterBanco(), data, hoje);
  if (!turmas.ok) redirect(destinoDoErro(params.data, turmas.erros, hoje));
  const erro = mensagemDoErro(params.erro);
  const { anterior, seguinte } = diasVizinhos(data, hoje);
  const ehHoje = data === hoje;
  const dia = nomeDoDia(data);

  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12 md:px-12 md:py-16"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-titulo">Chamada</h1>
        <p className="font-semibold">
          {comMaiuscula(tituloDoDia(data, hoje))}
          {ehHoje && (
            <span className="font-normal text-texto-suave"> · hoje</span>
          )}
        </p>
      </div>

      {erro && (
        <p role="alert" className="max-w-prose text-erro">
          {erro}
        </p>
      )}

      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <nav aria-label="Dias">
          <ul className="flex rounded-sm border border-borda">
            {[
              {
                href: urlEscolha({ data: anterior }, hoje),
                texto: (
                  <>
                    <span aria-hidden="true">‹&nbsp;</span>Dia anterior
                  </>
                ),
              },
              ...(ehHoje
                ? []
                : [{ href: urlEscolha({}, hoje), texto: <>Hoje</> }]),
              ...(seguinte
                ? [
                    {
                      href: urlEscolha({ data: seguinte }, hoje),
                      texto: (
                        <>
                          Dia seguinte<span aria-hidden="true">&nbsp;›</span>
                        </>
                      ),
                    },
                  ]
                : []),
            ].map((item) => (
              <li
                key={item.href}
                className="flex-1 border-borda border-l first:border-l-0"
              >
                <Link href={item.href} className={DIA}>
                  {item.texto}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <form
          method="get"
          action="/painel/chamada"
          className="flex flex-col gap-2"
        >
          <label htmlFor="escolher-dia" className="font-semibold">
            Outro dia
          </label>
          <div className="flex gap-2">
            <input
              id="escolher-dia"
              type="date"
              name="data"
              defaultValue={data}
              max={hoje}
              required
              className="min-h-12 min-w-0 flex-1 rounded-sm border border-borda bg-transparent px-3 text-base md:w-48 md:flex-none"
            />
            <button type="submit" className={SECUNDARIO}>
              Ver
            </button>
          </div>
        </form>
      </div>

      {turmas.valor.length === 0 ? (
        <section className={VAZIO}>
          <h2 className="text-base">Nenhuma turma com aula {naDia(data)}</h2>
          <p className="text-texto-suave">
            Aqui aparecem as turmas ativas com aula nesse dia da semana. Escolha
            outro dia, ou veja os dias de cada turma em{" "}
            <Link href="/painel/turmas" className={LINK}>
              Turmas
            </Link>
            .
          </p>
        </section>
      ) : (
        <section className="flex flex-col gap-4">
          <h2 className="text-base">Turmas de {dia}</h2>
          <table className="block w-full md:table">
            <caption className="sr-only">
              Turmas de {dia}, com a situação da chamada
            </caption>
            <thead className="hidden md:table-header-group">
              <tr className="border-linha border-b text-left">
                <th scope="col" className="py-3 pr-6 font-semibold">
                  Turma
                </th>
                <th scope="col" className="py-3 font-semibold">
                  Chamada
                </th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group">
              {turmas.valor.map((t) => (
                <tr
                  key={t.turmaId}
                  className="flex flex-col border-linha border-b py-2 first:border-t md:table-row md:first:border-t-0"
                >
                  <td className="block md:table-cell md:pr-6 md:align-top">
                    <Link
                      href={urlChamada(t.turmaId, data)}
                      className={`-mx-2 inline-flex min-h-12 items-center px-2 font-semibold ${LINK}`}
                    >
                      {t.rotulo}
                    </Link>
                  </td>
                  <td
                    className={`block pb-2 md:table-cell md:py-3 md:align-top ${t.situacao === "sem_chamada" ? "text-texto-suave" : ""}`}
                  >
                    {textoDaSituacao(t)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
