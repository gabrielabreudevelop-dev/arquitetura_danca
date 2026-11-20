import Link from "next/link";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { FormularioRitmo } from "../formulario";

export const dynamic = "force-dynamic";

export default async function NovoRitmo() {
  await exigirAdministracao();
  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12 md:px-12 md:py-16"
    >
      <div className="flex flex-col gap-2">
        <Link
          href="/painel/ritmos"
          className="-mx-2 flex min-h-12 items-center px-2 text-link underline decoration-link underline-offset-4"
        >
          Voltar para ritmos
        </Link>
        <h1 className="text-titulo">Novo ritmo</h1>
      </div>
      <FormularioRitmo />
    </main>
  );
}
