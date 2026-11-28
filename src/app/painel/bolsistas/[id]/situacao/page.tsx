import {
  formatarDataCompleta,
  formatarDia,
  hojeEmSaoPaulo,
} from "@/servidor/alunos/datas";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { ultimaMudanca } from "@/servidor/bolsistas/regras";
import { FormularioSituacao } from "../formularios/situacao";
import { bolsistaOu404, Moldura } from "../moldura";

export const dynamic = "force-dynamic";

/** Inativar (bolsa ativa) ou reativar (bolsa inativa); o formulário segue a situação de hoje. */
export default async function MudarSituacao({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirAdministracao();
  const { id } = await params;
  const hoje = hojeEmSaoPaulo();
  const b = await bolsistaOu404(id, hoje);
  const ultima = ultimaMudanca(b.historico);
  const inativar = b.ativo;
  return (
    <Moldura
      bolsista={b}
      titulo={inativar ? "Inativar bolsista" : "Reativar bolsista"}
      detalhe={
        ultima &&
        `${ultima.tipo === "ativacao" ? "Ativo" : "Inativo"} desde ${formatarDia(ultima.data)}`
      }
    >
      <p className="max-w-prose text-texto-suave">
        {inativar
          ? "Sai da chamada e da lista de quem está sem vir. As presenças e o histórico ficam guardados, e dá para reativar depois."
          : "Volta para a chamada e para a lista de quem está sem vir, com os dias combinados de antes. Para mudar os dias, use “Alterar dias” na ficha."}
      </p>
      <FormularioSituacao
        bolsistaId={b.id}
        tipo={inativar ? "inativacao" : "ativacao"}
        hoje={hoje}
        desde={
          ultima
            ? { iso: ultima.data, texto: formatarDataCompleta(ultima.data) }
            : null
        }
      />
    </Moldura>
  );
}
