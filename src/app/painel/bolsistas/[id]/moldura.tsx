import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import type { DataIso } from "@/servidor/alunos/datas";
import { obterBanco } from "@/servidor/banco/cliente";
import {
  type BolsistaCarregado,
  carregarBolsistas,
} from "@/servidor/bolsistas/carga";
import { ehUuid } from "@/servidor/cadastros/comum";

const LINK =
  "-mx-2 flex min-h-12 items-center self-start px-2 text-link underline decoration-link underline-offset-4";

/** O bolsista do endereço, ou 404 (id inválido ou inexistente). */
export async function bolsistaOu404(
  id: string,
  hoje: DataIso,
): Promise<BolsistaCarregado> {
  if (!ehUuid(id)) notFound();
  const [bolsista] = await carregarBolsistas(obterBanco(), hoje, {
    ids: [id],
  });
  if (!bolsista) notFound();
  return bolsista;
}

/** Página de uma ação da ficha: "Voltar para a ficha", título, nome e o formulário. */
export function Moldura({
  bolsista,
  titulo,
  detalhe,
  children,
}: {
  bolsista: { id: string; nome: string };
  titulo: string;
  detalhe?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12 md:px-12 md:py-16"
    >
      <div className="flex flex-col gap-2">
        <Link href={`/painel/bolsistas/${bolsista.id}`} className={LINK}>
          Voltar para a ficha
        </Link>
        <h1 className="text-titulo">{titulo}</h1>
        <p className="break-words font-semibold">{bolsista.nome}</p>
        {detalhe && <p className="text-texto-suave">{detalhe}</p>}
      </div>
      {children}
    </main>
  );
}
