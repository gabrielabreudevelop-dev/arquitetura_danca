import Link from "next/link";
import { notFound } from "next/navigation";
import { carregarAlunos } from "@/servidor/alunos/carga";
import { hojeEmSaoPaulo } from "@/servidor/alunos/datas";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { ehUuid } from "@/servidor/cadastros/comum";
import { formatarWhatsapp } from "@/servidor/pessoas/formatar";
import { FormularioAluno } from "../../formulario";

export const dynamic = "force-dynamic";

export default async function EditarAluno({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirAdministracao();
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const hoje = hojeEmSaoPaulo();
  const [aluno] = await carregarAlunos(obterBanco(), hoje, { ids: [id] });
  if (!aluno) notFound();
  const r = aluno.responsavel;
  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12 md:px-12 md:py-16"
    >
      <div className="flex flex-col gap-2">
        <Link
          href={`/painel/alunos/${aluno.id}`}
          className="-mx-2 flex min-h-12 items-center self-start px-2 text-link underline decoration-link underline-offset-4"
        >
          Voltar para a ficha
        </Link>
        <h1 className="break-words text-titulo">{aluno.nome}</h1>
      </div>
      <FormularioAluno
        hoje={hoje}
        aluno={{
          id: aluno.id,
          nome: aluno.nome,
          nascimento: aluno.nascimento,
          whatsapp: aluno.whatsapp ? formatarWhatsapp(aluno.whatsapp) : "",
          email: aluno.email ?? "",
          instagram: aluno.instagram ? `@${aluno.instagram}` : "",
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
    </main>
  );
}
