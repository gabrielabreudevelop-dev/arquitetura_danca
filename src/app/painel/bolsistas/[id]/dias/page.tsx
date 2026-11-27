import { formatarDia, hojeEmSaoPaulo } from "@/servidor/alunos/datas";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { diasCurtos } from "@/servidor/bolsistas/textos";
import { FormularioDias } from "../formularios/dias";
import { bolsistaOu404, Moldura } from "../moldura";

export const dynamic = "force-dynamic";

export default async function AlterarDias({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirAdministracao();
  const { id } = await params;
  const hoje = hojeEmSaoPaulo();
  const b = await bolsistaOu404(id, hoje);
  const atuais = b.diasHoje ?? [];
  // Início da versão vigente: o maior "vigente desde" até hoje.
  const desde = b.acordos
    .map((a) => a.vigenteDesde)
    .filter((d) => d <= hoje)
    .sort()
    .at(-1);
  const detalhe =
    atuais.length > 0 && desde
      ? `Hoje: ${diasCurtos(atuais)} (desde ${formatarDia(desde)})`
      : "Sem dias combinados hoje.";
  return (
    <Moldura bolsista={b} titulo="Alterar dias" detalhe={detalhe}>
      <FormularioDias bolsistaId={b.id} diasAtuais={atuais} hoje={hoje} />
    </Moldura>
  );
}
