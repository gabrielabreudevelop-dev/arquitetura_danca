import Link from "next/link";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { listarEventosPainel } from "@/servidor/cadastros/eventos";
import { formatarDataEvento } from "@/servidor/vitrine/texto";
import { AlternarEsgotado } from "./alternar-esgotado";

export const dynamic = "force-dynamic";

const BOTAO =
  "inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-acao px-6 font-semibold text-fundo hover:bg-acao-escura md:w-auto";

type Linha = Awaited<ReturnType<typeof listarEventosPainel>>[number];

function Situacao({ evento }: { evento: Linha }) {
  if (evento.passou) return <>Já aconteceu</>;
  if (!evento.publicado) return <>Rascunho</>;
  if (evento.esgotado) {
    return (
      <span className="faixa-esgotado rounded-sm px-2 py-1">Esgotado</span>
    );
  }
  return <>Publicado</>;
}

function Lista({ titulo, eventos }: { titulo: string; eventos: Linha[] }) {
  if (eventos.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base">{titulo}</h2>
      <ul className="flex flex-col">
        {eventos.map((e) => (
          <li
            key={e.id}
            className="flex flex-col gap-2 border-linha border-b py-3 first:border-t md:flex-row md:items-center md:gap-6"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="break-words font-semibold">{e.titulo}</span>
              <span className="break-words text-pequeno text-texto-suave">
                {formatarDataEvento(e.inicio, e.fim)}
              </span>
            </div>
            <p className="text-pequeno text-texto-suave md:w-32">
              <Situacao evento={e} />
            </p>
            <div className="flex flex-wrap items-center gap-x-6 md:w-72 md:justify-end">
              {e.publicado && !e.passou && (
                <AlternarEsgotado
                  id={e.id}
                  esgotado={e.esgotado}
                  titulo={e.titulo}
                />
              )}
              <Link
                href={`/painel/eventos/${e.id}`}
                aria-label={`Editar ${e.titulo}`}
                className="-mx-2 flex min-h-12 items-center px-2 font-semibold text-link underline decoration-link underline-offset-4"
              >
                Editar
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function Eventos() {
  await exigirAdministracao();
  const lista = await listarEventosPainel(obterBanco(), new Date());
  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12 md:px-12 md:py-16"
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <h1 className="text-titulo">Eventos</h1>
        {lista.length > 0 && (
          <Link href="/painel/eventos/novo" className={BOTAO}>
            Novo evento
          </Link>
        )}
      </div>

      {lista.length === 0 ? (
        <section className="flex max-w-prose flex-col gap-4 border-linha border-t pt-6">
          <h2 className="text-base">Nenhum evento cadastrado</h2>
          <p className="text-texto-suave">
            Cadastre os eventos do estúdio com data, preço e capa. Os publicados
            aparecem no site; os rascunhos ficam só aqui.
          </p>
          <Link
            href="/painel/eventos/novo"
            className={`${BOTAO} md:self-start`}
          >
            Novo evento
          </Link>
        </section>
      ) : (
        <>
          <Lista titulo="Próximos" eventos={lista.filter((e) => !e.passou)} />
          <Lista
            titulo="Já aconteceram"
            eventos={lista.filter((e) => e.passou)}
          />
        </>
      )}
    </main>
  );
}
