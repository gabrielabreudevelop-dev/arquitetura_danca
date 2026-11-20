import Link from "next/link";

export default function SemAcesso() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Sem acesso</h1>
      <p>Você não tem permissão para ver esta página.</p>
      <Link href="/" className="underline">
        Voltar ao início
      </Link>
    </main>
  );
}
