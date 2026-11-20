import { exigirPapel } from "@/servidor/auth/acesso";
import { Marca } from "../marca";
import { Navegacao } from "./navegacao";
import { BotaoSair } from "./sair";

export const dynamic = "force-dynamic";

/** Toda a área do painel exige alguém da equipe. */
export default async function LayoutPainel({
  children,
}: {
  children: React.ReactNode;
}) {
  const { papeis } = await exigirPapel(["administracao", "atendente"]);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-linha border-b">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 px-6 lg:flex-nowrap md:px-12">
          <div className="flex min-h-16 items-center">
            <Marca href="/painel" />
          </div>
          {/* No celular a navegação desce para a própria linha e rola na horizontal. */}
          <div className="order-last w-full min-w-0 lg:order-none lg:w-auto lg:flex-1">
            <Navegacao administracao={papeis.includes("administracao")} />
          </div>
          <BotaoSair />
        </div>
      </header>
      {children}
    </div>
  );
}
