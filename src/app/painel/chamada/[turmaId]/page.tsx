import Link from "next/link";
import { redirect } from "next/navigation";
import { hojeEmSaoPaulo } from "@/servidor/alunos/datas";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { obterChamada, turmasDoDia } from "@/servidor/bolsistas/chamada";
import { destinoDoErro, lerData, urlEscolha } from "../endereco";
import {
  FormularioChamada,
  FormularioDesfazerNaoHouve,
  FormularioNaoHouve,
} from "../formulario";
import { comMaiuscula, nomeDoDia, tituloDoDia } from "../textos";

export const dynamic = "force-dynamic";

const LINK =
  "-mx-2 flex min-h-12 items-center self-start px-2 text-link underline decoration-link underline-offset-4";
const SECAO = "flex flex-col gap-4 border-linha border-t pt-6";

/** Chamada de uma turma num dia; endereço inválido volta à escolha do dia com a mensagem. */
export default async function Chamada({
  params,
  searchParams,
}: {
  params: Promise<{ turmaId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirAdministracao();
  const { turmaId } = await params;
  const busca = await searchParams;
  const hoje = hojeEmSaoPaulo();
  const lida = lerData(busca.data, hoje);
  if (!lida.ok) redirect(urlEscolha({ erro: lida.codigo }, hoje));
  const { data } = lida;
  const db = obterBanco();
  const chamada = await obterChamada(db, { turmaId, data }, hoje);
  if (!chamada.ok) redirect(destinoDoErro(busca.data, chamada.erros, hoje));
  const c = chamada.valor;
  const turmas = await turmasDoDia(db, data, hoje);
  const rotulo =
    (turmas.ok && turmas.valor.find((t) => t.turmaId === turmaId)?.rotulo) ||
    "Turma";
  const dia = nomeDoDia(data);
  const id = turmaId.toLowerCase();

  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12 md:px-12 md:py-16"
    >
      <div className="flex flex-col gap-2">
        <Link href={urlEscolha({ data }, hoje)} className={LINK}>
          Voltar para as turmas do dia
        </Link>
        <h1 className="text-titulo">Chamada</h1>
        <p className="break-words font-semibold">{rotulo}</p>
        <p className="text-texto-suave">
          {comMaiuscula(tituloDoDia(data, hoje))}
          {data === hoje && " · hoje"}
        </p>
      </div>

      {c.situacao === "nao_houve" ? (
        <section className={SECAO} aria-labelledby="nao-houve-titulo">
          <h2 id="nao-houve-titulo" className="text-base">
            Não houve aula{c.motivo ? ` · ${c.motivo}` : ""}
          </h2>
          <p className="max-w-prose text-texto-suave">
            Esse dia não conta na frequência de ninguém. Se houve aula, desfaça
            para fazer a chamada.
          </p>
          <FormularioDesfazerNaoHouve turmaId={id} data={data} />
        </section>
      ) : (
        <>
          <FormularioChamada
            turmaId={id}
            data={data}
            versao={c.versao}
            dia={dia}
            salva={c.situacao === "realizada"}
            combinados={c.combinados}
            extras={c.extras}
            disponiveis={c.disponiveis}
          />
          <section
            id="nao-houve"
            className={SECAO}
            aria-labelledby="nao-houve-titulo"
          >
            <h2 id="nao-houve-titulo" className="text-base">
              Não houve aula?
            </h2>
            {c.contagem.vieram > 0 ? (
              <p className="max-w-prose text-texto-suave">
                Esta chamada tem presenças salvas. Para marcar que não houve
                aula, desmarque todos e salve antes.
              </p>
            ) : (
              <FormularioNaoHouve turmaId={id} data={data} />
            )}
          </section>
        </>
      )}
    </main>
  );
}
