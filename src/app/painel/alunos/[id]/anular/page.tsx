import { notFound } from "next/navigation";
import {
  formatarDataCompleta,
  formatarDia,
  hojeEmSaoPaulo,
} from "@/servidor/alunos/datas";
import { obterFicha } from "@/servidor/alunos/ficha";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { ehUuid } from "@/servidor/cadastros/comum";
import { lerAlvoAnular } from "../calculos";
import { FormularioAnular } from "../formularios/anular";
import { Moldura } from "../moldura";

export const dynamic = "force-dynamic";

/** O que a anulação faz, por tipo. */
const EFEITO: Record<string, string> = {
  ajuste: "Os dias deste lançamento deixam de contar no fim do período.",
  periodo: "O período deixa de contar. Só é possível sem lançamentos vivos.",
  trancamento:
    "O trancamento e os dias que ele somou deixam de contar no fim do período.",
  transferencia:
    "Os dias voltam para quem cedeu e saem de quem recebeu, nas duas fichas.",
};

export default async function PaginaAnular({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tipo?: string | string[]; alvo?: string | string[] }>;
}) {
  await exigirAdministracao();
  const { id } = await params;
  const { tipo, alvo: alvoBruto } = await searchParams;
  const alvo = lerAlvoAnular(tipo, alvoBruto);
  if (!alvo || !ehUuid(id)) notFound();
  const hoje = hojeEmSaoPaulo();
  const ficha = await obterFicha(obterBanco(), id, hoje);
  if (!ficha) notFound();
  const item = ficha.historico.find(
    (h) => h.anular?.tipo === alvo.tipo && h.anular.id === alvo.id,
  );
  if (!item) notFound();
  const dia = hojeEmSaoPaulo(item.em);
  const quando =
    dia.slice(0, 4) === hoje.slice(0, 4)
      ? formatarDia(dia)
      : formatarDataCompleta(dia);

  return (
    <Moldura aluno={ficha.aluno} titulo="Anular">
      <div className="flex flex-col gap-2 bg-rosa-suave px-4 py-3">
        <p className="break-words font-semibold">{item.texto}</p>
        <p className="text-pequeno">
          Lançado em {quando} por {item.por}
        </p>
      </div>
      <p className="max-w-prose text-texto-suave">
        {EFEITO[alvo.tipo]} O item continua no histórico, riscado, com o motivo.
      </p>
      <FormularioAnular alunoId={ficha.aluno.id} alvo={alvo} />
    </Moldura>
  );
}
