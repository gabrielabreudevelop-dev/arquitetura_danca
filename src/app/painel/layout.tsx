import { exigirPapel } from "@/servidor/auth/acesso";
import { Marca } from "../marca";
import { BotaoSair } from "./sair";

export const dynamic = "force-dynamic";

/** Toda a área do painel exige alguém da equipe. */
export default async function LayoutPainel({
  children,
}: {
  children: React.ReactNode;
}) {
  await exigirPapel(["administracao", "atendente"]);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-linha border-b">
        <div className="mx-auto flex min-h-16 w-full max-w-5xl items-center justify-between gap-4 px-6 md:px-12">
          <Marca href="/painel" />
          <BotaoSair />
        </div>
      </header>
      {children}
    </div>
  );
}
