import Link from "next/link";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { listarProfessores } from "@/servidor/cadastros/professores";
import { formatarWhatsapp } from "@/servidor/pessoas/formatar";

export const dynamic = "force-dynamic";

const BOTAO =
  "inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-acao px-6 font-semibold text-fundo hover:bg-acao-escura md:w-auto";

export default async function Professores() {
  await exigirAdministracao();
  const lista = await listarProfessores(obterBanco());
  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12 md:px-12 md:py-16"
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <h1 className="text-titulo">Professores</h1>
        {lista.length > 0 && (
          <Link href="/painel/professores/novo" className={BOTAO}>
            Novo professor
          </Link>
        )}
      </div>

      {lista.length === 0 ? (
        <section className="flex max-w-prose flex-col gap-4 border-linha border-t pt-6">
          <h2 className="text-base">Nenhum professor cadastrado</h2>
          <p className="text-texto-suave">
            Cadastre quem dá aulas no estúdio para ligar cada turma ao seu
            professor. Os nomes não aparecem no site público.
          </p>
          <Link
            href="/painel/professores/novo"
            className={`${BOTAO} md:self-start`}
          >
            Novo professor
          </Link>
        </section>
      ) : (
        <ul className="flex flex-col">
          {lista.map((p) => (
            <li
              key={p.pessoaId}
              className="flex flex-col gap-2 border-linha border-b py-3 first:border-t md:flex-row md:items-center md:gap-6"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="break-words font-semibold">{p.nome}</span>
                <span className="break-all text-pequeno text-texto-suave">
                  {[p.email, p.whatsapp && formatarWhatsapp(p.whatsapp)]
                    .filter(Boolean)
                    .join(" · ") || "Sem contato cadastrado"}
                </span>
              </div>
              <p className="text-pequeno text-texto-suave md:w-32">
                <span className={p.ativo ? "" : "font-semibold text-texto"}>
                  {p.ativo ? "Ativo" : "Desativado"}
                </span>
              </p>
              <Link
                href={`/painel/professores/${p.pessoaId}`}
                aria-label={`Editar ${p.nome}`}
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
