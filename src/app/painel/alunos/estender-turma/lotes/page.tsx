import Link from "next/link";
import { formatarDataCompleta, hojeEmSaoPaulo } from "@/servidor/alunos/datas";
import { listarLotes } from "@/servidor/alunos/lotes";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { FormularioAnularLote } from "../formulario-anular";

export const dynamic = "force-dynamic";

const LINK =
  "-mx-2 flex min-h-12 items-center px-2 text-link underline decoration-link underline-offset-4";
const BOTAO =
  "inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-acao px-6 font-semibold text-fundo hover:bg-acao-escura md:w-auto";

/** Número inteiro do endereço (`?aplicado=12`); qualquer outra coisa vira `null`. */
function numeroDoEndereco(valor: string | string[] | undefined): number | null {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  return texto && /^\d{1,6}$/.test(texto) ? Number(texto) : null;
}

function textoDaQuantidade(n: number, unidade: "dias" | "aulas"): string {
  const base = unidade === "dias" ? "dia" : "aula";
  return `+${n} ${n === 1 ? base : `${base}s`}`;
}

function textoDosAlunos(n: number): string {
  return `${n} ${n === 1 ? "aluno" : "alunos"}`;
}

export default async function PaginaLotes({
  searchParams,
}: {
  searchParams: Promise<{
    aplicado?: string | string[];
    anulado?: string | string[];
  }>;
}) {
  await exigirAdministracao();
  const { aplicado, anulado } = await searchParams;
  const lotes = await listarLotes(obterBanco());
  const nAplicado = numeroDoEndereco(aplicado);
  const aviso =
    nAplicado !== null
      ? `Extensão aplicada a ${textoDosAlunos(nAplicado)}.`
      : numeroDoEndereco(anulado) !== null
        ? "Lote anulado."
        : null;
  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12 md:px-12 md:py-16"
    >
      <div className="flex flex-col gap-2">
        <Link href="/painel/alunos" className={LINK}>
          Voltar para alunos
        </Link>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <h1 className="text-titulo">Extensões em lote</h1>
          <Link href="/painel/alunos/estender-turma" className={BOTAO}>
            Estender turma
          </Link>
        </div>
      </div>

      {aviso && <output className="block font-semibold">{aviso}</output>}

      {lotes.length === 0 ? (
        <section className="flex max-w-prose flex-col gap-4 border-linha border-t pt-6">
          <h2 className="text-base">Nenhuma extensão em lote ainda</h2>
          <p className="text-texto-suave">
            Quando você estender uma turma (ou o estúdio todo), o lote aparece
            aqui e pode ser anulado.
          </p>
        </section>
      ) : (
        <ul className="flex flex-col">
          {lotes.map((l) => (
            <li
              key={l.id}
              className="flex flex-col gap-2 border-linha border-b py-4 first:border-t"
            >
              <p className="text-pequeno text-texto-suave">
                {formatarDataCompleta(hojeEmSaoPaulo(l.criadoEm))} ·{" "}
                {l.criadoPor}
              </p>
              <p
                className={`break-words font-semibold ${l.anulado ? "line-through" : ""}`}
              >
                {l.todoEstudio ? "Estúdio todo" : l.turmas.join(" · ")}
              </p>
              <p className={l.anulado ? "line-through" : ""}>
                {textoDaQuantidade(l.quantidadeDigitada, l.unidadeDigitada)} ·{" "}
                {textoDosAlunos(l.alunos)}
              </p>
              <p
                className={`break-words text-texto-suave ${l.anulado ? "line-through" : ""}`}
              >
                {l.motivo}
              </p>
              {l.anulado ? (
                <p className="break-words font-semibold">
                  Anulado: {l.motivoAnulacao}
                </p>
              ) : (
                <FormularioAnularLote loteId={l.id} />
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
