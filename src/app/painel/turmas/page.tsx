import Link from "next/link";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { listarTurmas, opcoesDeTurma } from "@/servidor/cadastros/turmas";
import { formatarDias, formatarHorario } from "@/servidor/vitrine/texto";
import { cadastrosFaltando, FaltaCadastro } from "./falta-cadastro";

export const dynamic = "force-dynamic";

const BOTAO =
  "inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-acao px-6 font-semibold text-fundo hover:bg-acao-escura md:w-auto";

export default async function Turmas() {
  await exigirAdministracao();
  const banco = obterBanco();
  const lista = await listarTurmas(banco);
  const faltando =
    lista.length === 0 ? cadastrosFaltando(await opcoesDeTurma(banco)) : [];
  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12 md:px-12 md:py-16"
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <h1 className="text-titulo">Turmas</h1>
        {lista.length > 0 && (
          <Link href="/painel/turmas/nova" className={BOTAO}>
            Nova turma
          </Link>
        )}
      </div>

      {lista.length === 0 ? (
        <section className="flex max-w-prose flex-col gap-4 border-linha border-t pt-6">
          <h2 className="text-base">Nenhuma turma cadastrada</h2>
          {faltando.length > 0 ? (
            <FaltaCadastro faltando={faltando} />
          ) : (
            <>
              <p className="text-texto-suave">
                Cadastre as turmas com ritmo, módulo, professor, dias e horário;
                elas formam a grade pública.
              </p>
              <Link
                href="/painel/turmas/nova"
                className={`${BOTAO} md:self-start`}
              >
                Nova turma
              </Link>
            </>
          )}
        </section>
      ) : (
        <ul className="flex flex-col">
          {lista.map((t) => (
            <li
              key={t.id}
              className="flex flex-col gap-2 border-linha border-b py-3 first:border-t md:flex-row md:items-center md:gap-6"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="break-words font-semibold">
                  {t.ritmo} · {t.modulo}
                </span>
                <span className="break-words text-pequeno text-texto-suave">
                  {t.professor}
                </span>
              </div>
              <p className="text-pequeno text-texto-suave md:w-56">
                {formatarDias(t.dias)} ·{" "}
                {formatarHorario(t.horarioInicio, t.horarioFim)}
              </p>
              <p className="text-pequeno text-texto-suave md:w-28">
                <span className={t.ativa ? "" : "font-semibold text-texto"}>
                  {t.ativa ? "Ativa" : "Desativada"}
                </span>
              </p>
              <Link
                href={`/painel/turmas/${t.id}`}
                aria-label={`Editar turma de ${t.ritmo}, ${t.modulo}`}
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
