import { exigirPapel } from "@/servidor/auth/acesso";
import { BotaoSair } from "./sair";

export const dynamic = "force-dynamic";

// Por ora serve só para provar o acesso; o dashboard vem em marcos futuros.
export default async function Painel() {
  const { nome, papeis } = await exigirPapel(["administracao", "atendente"]);
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Painel</h1>
      <p>
        {nome} — {papeis.join(", ")}
      </p>
      <div>
        <BotaoSair />
      </div>
    </main>
  );
}
