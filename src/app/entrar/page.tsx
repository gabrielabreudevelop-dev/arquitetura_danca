"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { clienteAuth } from "../cliente-auth";
import { Marca } from "../marca";

const ERRO_CREDENCIAIS = "E-mail ou senha incorretos";
const ERRO_REDE =
  "Não foi possível conectar. Verifique sua internet e tente de novo.";
const ERRO_LIMITE = "Muitas tentativas. Aguarde um minuto e tente de novo.";

const estiloCampo =
  "min-h-12 w-full rounded-sm border border-borda bg-transparent px-3 text-base aria-invalid:border-erro";

export default function Entrar() {
  const roteador = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Só o erro de credenciais aponta para os campos; o de limite não.
  const camposInvalidos = erro === ERRO_CREDENCIAIS ? true : undefined;

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    setEnviando(true);
    setErro(null);
    // `undefined` = a chamada lançou exceção (rede fora do ar).
    const erroLogin = await clienteAuth.signIn
      .email({
        email: String(dados.get("email") ?? ""),
        password: String(dados.get("senha") ?? ""),
      })
      .then((resposta) => resposta.error)
      .catch(() => undefined);
    setEnviando(false);
    // Exceção ou erro sem status: a requisição nem chegou ao servidor.
    if (erroLogin === undefined || (erroLogin && !erroLogin.status)) {
      setErro(ERRO_REDE);
      return;
    }
    if (erroLogin) {
      setErro(erroLogin.status === 429 ? ERRO_LIMITE : ERRO_CREDENCIAIS);
      return;
    }
    roteador.push("/painel");
    roteador.refresh();
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6">
      <header className="flex min-h-16 items-center">
        <Marca />
      </header>

      <main
        id="conteudo"
        className="flex flex-1 flex-col justify-center gap-8 py-12"
      >
        <div className="flex flex-col gap-2">
          <h1 className="text-titulo">Entrar</h1>
          <p className="text-texto-suave">
            Por enquanto, só a equipe do estúdio entra por aqui.
          </p>
        </div>

        <form
          onSubmit={enviar}
          aria-busy={enviando}
          className="flex flex-col gap-6"
        >
          <label className="flex flex-col gap-2">
            <span className="font-semibold">E-mail</span>
            <input
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              aria-invalid={camposInvalidos}
              aria-describedby={erro ? "erro-entrar" : undefined}
              className={estiloCampo}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-semibold">Senha</span>
            <input
              name="senha"
              type="password"
              autoComplete="current-password"
              required
              aria-invalid={camposInvalidos}
              aria-describedby={erro ? "erro-entrar" : undefined}
              className={estiloCampo}
            />
          </label>

          {erro && (
            <p id="erro-entrar" role="alert" className="text-erro">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="min-h-12 w-full rounded-sm bg-acao px-6 font-semibold text-fundo hover:bg-acao-escura disabled:cursor-wait disabled:bg-texto-suave"
          >
            {enviando ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="text-pequeno text-texto-suave">
          Esqueceu a senha? Fale com a administração do estúdio.
        </p>
      </main>
    </div>
  );
}
