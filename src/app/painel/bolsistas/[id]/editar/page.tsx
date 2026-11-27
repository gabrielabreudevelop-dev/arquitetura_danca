import { hojeEmSaoPaulo } from "@/servidor/alunos/datas";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { formatarWhatsapp } from "@/servidor/pessoas/formatar";
import { FormularioBolsista } from "../../formulario";
import { bolsistaOu404, Moldura } from "../moldura";

export const dynamic = "force-dynamic";

export default async function EditarBolsista({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirAdministracao();
  const { id } = await params;
  const hoje = hojeEmSaoPaulo();
  const b = await bolsistaOu404(id, hoje);
  const r = b.responsavel;
  return (
    <Moldura bolsista={b} titulo="Editar bolsista">
      <FormularioBolsista
        hoje={hoje}
        bolsista={{
          id: b.id,
          nome: b.nome,
          nascimento: b.nascimento,
          whatsapp: b.whatsapp ? formatarWhatsapp(b.whatsapp) : "",
          email: b.email ?? "",
          instagram: b.instagram ? `@${b.instagram}` : "",
          preferencia: b.preferencia,
          responsavel: r
            ? {
                id: r.id,
                nome: r.nome,
                contato: [r.whatsapp && formatarWhatsapp(r.whatsapp), r.email]
                  .filter(Boolean)
                  .join(" · "),
              }
            : null,
        }}
      />
    </Moldura>
  );
}
