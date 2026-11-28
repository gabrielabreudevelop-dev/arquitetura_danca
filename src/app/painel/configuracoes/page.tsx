import Link from "next/link";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { listarMensagens } from "@/servidor/configuracoes/mensagens-prontas";
import { formatarDuracao, listarPlanos } from "@/servidor/configuracoes/planos";
import { obterUnidadeAjustes } from "@/servidor/configuracoes/unidade";
import { FormularioUnidade } from "./unidade";

export const dynamic = "force-dynamic";

const BOTAO =
  "inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-acao px-6 font-semibold text-fundo hover:bg-acao-escura md:w-auto";
const EDITAR =
  "-mx-2 flex min-h-12 items-center px-2 font-semibold text-link underline decoration-link underline-offset-4";
const LINHA =
  "flex flex-col gap-2 border-linha border-b py-3 first:border-t md:flex-row md:items-center md:gap-6";

const FINALIDADES = {
  renovacao: "Renovação",
  retorno: "Convite para voltar",
  bolsista: "Bolsista sem vir",
};

export default async function Configuracoes() {
  await exigirAdministracao();
  const db = obterBanco();
  const [unidade, planos, mensagens] = await Promise.all([
    obterUnidadeAjustes(db),
    listarPlanos(db),
    listarMensagens(db),
  ]);
  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-6 py-12 md:px-12 md:py-16"
    >
      <h1 className="text-titulo">Configurações</h1>

      <section className="flex max-w-md flex-col gap-4">
        <FormularioUnidade atual={unidade} />
      </section>

      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h2 className="text-base">Planos</h2>
          <Link href="/painel/configuracoes/planos/novo" className={BOTAO}>
            Novo plano
          </Link>
        </div>
        {planos.length === 0 ? (
          <p className="max-w-prose text-texto-suave">
            Nenhum plano cadastrado. Cadastre os planos que o estúdio vende;
            eles aparecem ao registrar um período.
          </p>
        ) : (
          <ul className="flex flex-col">
            {planos.map((p) => (
              <li key={p.id} className={LINHA}>
                <span className="min-w-0 flex-1 break-words font-semibold">
                  {p.nome}
                </span>
                <p className="text-pequeno text-texto-suave md:w-48">
                  {formatarDuracao(p.duracaoQuantidade, p.duracaoUnidade)} ·{" "}
                  <span className={p.ativo ? "" : "font-semibold text-texto"}>
                    {p.ativo ? "Ativo" : "Desativado"}
                  </span>
                </p>
                <Link
                  href={`/painel/configuracoes/planos/${p.id}`}
                  aria-label={`Editar ${p.nome}`}
                  className={EDITAR}
                >
                  Editar
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h2 className="text-base">Mensagens prontas</h2>
          <Link href="/painel/configuracoes/mensagens/nova" className={BOTAO}>
            Nova mensagem
          </Link>
        </div>
        <ul className="flex flex-col">
          {mensagens.map((m) => (
            <li key={m.id} className={LINHA}>
              <span className="min-w-0 flex-1 break-words font-semibold">
                {m.nome}
              </span>
              <p className="text-pequeno text-texto-suave md:w-64">
                {FINALIDADES[m.finalidade]} ·{" "}
                <span className={m.ativa ? "" : "font-semibold text-texto"}>
                  {m.ativa ? "Ativa" : "Desativada"}
                </span>
              </p>
              <Link
                href={`/painel/configuracoes/mensagens/${m.id}`}
                aria-label={`Editar ${m.nome}`}
                className={EDITAR}
              >
                Editar
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
