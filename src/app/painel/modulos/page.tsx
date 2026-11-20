import Link from "next/link";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { listarModulos } from "@/servidor/cadastros/modulos";

export const dynamic = "force-dynamic";

const BOTAO =
  "inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-acao px-6 font-semibold text-fundo hover:bg-acao-escura md:w-auto";

export default async function Modulos() {
  await exigirAdministracao();
  const lista = await listarModulos(obterBanco());
  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12 md:px-12 md:py-16"
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <h1 className="text-titulo">Módulos</h1>
        {lista.length > 0 && (
          <Link href="/painel/modulos/novo" className={BOTAO}>
            Novo módulo
          </Link>
        )}
      </div>

      {lista.length === 0 ? (
        <section className="flex max-w-prose flex-col gap-4 border-linha border-t pt-6">
          <h2 className="text-base">Nenhum módulo cadastrado</h2>
          <p className="text-texto-suave">
            Cadastre os níveis de cada ritmo, como iniciante e avançado; eles
            aparecem na grade pública na ordem definida aqui.
          </p>
          <Link
            href="/painel/modulos/novo"
            className={`${BOTAO} md:self-start`}
          >
            Novo módulo
          </Link>
        </section>
      ) : (
        <ul className="flex flex-col">
          {lista.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-2 border-linha border-b py-3 first:border-t md:flex-row md:items-center md:gap-6"
            >
              <span className="min-w-0 flex-1 break-words font-semibold">
                {r.nome}
              </span>
              <p className="text-pequeno text-texto-suave md:w-48">
                Ordem {r.ordem} ·{" "}
                <span className={r.ativo ? "" : "font-semibold text-texto"}>
                  {r.ativo ? "Ativo" : "Desativado"}
                </span>
              </p>
              <Link
                href={`/painel/modulos/${r.id}`}
                aria-label={`Editar ${r.nome}`}
                className="-mx-2 flex min-h-12 items-center px-2 font-semibold text-link underline decoration-link underline-offset-4"
              >
                Editar
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
