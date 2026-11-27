import Link from "next/link";
import { numerosDeBolsistas } from "@/app/painel/dash/bolsistas";
import { lerVisaoDoDash } from "@/app/painel/dash/endereco";
import { NumerosDeBolsistas, NumerosDoDash } from "@/app/painel/dash/numeros";
import { carregarAlunos } from "@/servidor/alunos/carga";
import { hojeEmSaoPaulo } from "@/servidor/alunos/datas";
import { contarDash } from "@/servidor/alunos/listas";
import { exigirPapel } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { carregarBolsistas } from "@/servidor/bolsistas/carga";
import { listarPlanos } from "@/servidor/configuracoes/planos";

export const dynamic = "force-dynamic";

const BOTAO =
  "inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-acao px-6 font-semibold text-fundo hover:bg-acao-escura md:w-auto";
const LINK = "text-link underline decoration-link underline-offset-4";

export default async function Painel({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { nome, papeis } = await exigirPapel(["administracao", "atendente"]);
  if (!papeis.includes("administracao")) {
    return (
      <main
        id="conteudo"
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-6 py-12 md:px-12 md:py-16"
      >
        <h1 className="break-words text-titulo">Olá, {nome}</h1>
        <section
          aria-labelledby="painel-vazio"
          className="flex max-w-prose flex-col gap-2 border-linha border-t pt-6"
        >
          <h2 id="painel-vazio" className="text-base">
            Nada por aqui ainda
          </h2>
          <p className="text-texto-suave">
            O painel ainda está vazio para o atendimento. A administração cuida
            dos cadastros por enquanto.
          </p>
        </section>
      </main>
    );
  }

  const visao = lerVisaoDoDash(await searchParams);
  const hoje = hojeEmSaoPaulo();
  const db = obterBanco();
  const [alunos, planos, bolsistas] = await Promise.all([
    carregarAlunos(db, hoje),
    listarPlanos(db),
    carregarBolsistas(db, hoje),
  ]);
  const numerosDosBolsistas = numerosDeBolsistas(bolsistas);
  const dash = contarDash(alunos, hoje, visao.janela, new Date());

  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-12 md:px-12 md:py-16"
    >
      <h1 className="break-words text-titulo">Olá, {nome}</h1>

      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <search className="md:flex-1">
          <form
            method="get"
            action="/painel/alunos"
            className="flex flex-col gap-2"
          >
            <label htmlFor="dash-busca" className="font-semibold">
              Buscar aluno
            </label>
            <div className="flex flex-col gap-4 md:flex-row">
              <input
                id="dash-busca"
                type="search"
                name="busca"
                placeholder="Nome, WhatsApp ou e-mail"
                autoComplete="off"
                className="min-h-12 w-full rounded-sm border border-borda bg-transparent px-3 text-base"
              />
              <button
                type="submit"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-sm border border-acao px-6 font-semibold text-link hover:bg-acao hover:text-fundo md:w-auto"
              >
                Buscar
              </button>
            </div>
          </form>
        </search>
        {alunos.length > 0 && (
          <Link href="/painel/alunos/novo" className={BOTAO}>
            Novo aluno
          </Link>
        )}
      </div>

      {alunos.length === 0 ? (
        <section
          aria-labelledby="dash-vazio"
          className="flex max-w-prose flex-col gap-4 border-linha border-t pt-6"
        >
          <h2 id="dash-vazio" className="text-base">
            Cadastre o primeiro aluno
          </h2>
          <p className="text-texto-suave">
            Com os alunos e os períodos contratados cadastrados, os números
            aparecem aqui.
          </p>
          {planos.length === 0 && (
            <p>
              Antes, cadastre os planos do estúdio em{" "}
              <Link
                href="/painel/configuracoes"
                className={`-mx-2 inline-flex min-h-12 items-center px-2 ${LINK}`}
              >
                Configurações.
              </Link>
            </p>
          )}
          <Link href="/painel/alunos/novo" className={`${BOTAO} md:self-start`}>
            Novo aluno
          </Link>
        </section>
      ) : (
        <NumerosDoDash dash={dash} visao={visao} />
      )}

      {bolsistas.length > 0 && (
        <NumerosDeBolsistas numeros={numerosDosBolsistas} />
      )}
    </main>
  );
}
