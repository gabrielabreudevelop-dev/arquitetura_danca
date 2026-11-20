"use client";

import { createAuthClient } from "better-auth/react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

const clienteAuth = createAuthClient();

export default function Entrar() {
  const roteador = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    setEnviando(true);
    setErro(null);
    const { error } = await clienteAuth.signIn.email({
      email: String(dados.get("email") ?? ""),
      password: String(dados.get("senha") ?? ""),
    });
    setEnviando(false);
    if (error) {
      setErro(
        error.status === 429
          ? "Muitas tentativas. Aguarde um minuto e tente de novo."
          : "E-mail ou senha incorretos",
      );
      return;
    }
    roteador.push("/painel");
    roteador.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Entrar</h1>
      <form onSubmit={enviar} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          E-mail
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            className="rounded border p-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          Senha
          <input
            name="senha"
            type="password"
            autoComplete="current-password"
            required
            className="rounded border p-2"
          />
        </label>
        {erro && (
          <p role="alert" className="text-red-700">
            {erro}
          </p>
        )}
        <button
          type="submit"
          disabled={enviando}
          className="rounded bg-black p-2 text-white disabled:opacity-60"
        >
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
