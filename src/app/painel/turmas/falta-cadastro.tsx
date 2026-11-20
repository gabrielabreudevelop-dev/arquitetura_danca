import Link from "next/link";

type Opcoes = {
  ritmos: unknown[];
  modulos: unknown[];
  professores: unknown[];
};

/** Links para os cadastros que ainda não têm nenhum item ativo; `null` se nada falta. */
export function cadastrosFaltando(opcoes: Opcoes) {
  return [
    { ok: opcoes.ritmos.length > 0, href: "/painel/ritmos", rotulo: "Ritmos" },
    {
      ok: opcoes.modulos.length > 0,
      href: "/painel/modulos",
      rotulo: "Módulos",
    },
    {
      ok: opcoes.professores.length > 0,
      href: "/painel/professores",
      rotulo: "Professores",
    },
  ].filter((c) => !c.ok);
}

/** Aviso "cadastre antes…" com um link para cada cadastro que falta. */
export function FaltaCadastro({
  faltando,
}: {
  faltando: { href: string; rotulo: string }[];
}) {
  return (
    <>
      <p className="text-texto-suave">
        Cadastre antes os ritmos, os módulos e os professores.
      </p>
      <ul className="flex flex-col">
        {faltando.map((c) => (
          <li key={c.href}>
            <Link
              href={c.href}
              className="-mx-2 flex min-h-12 items-center px-2 font-semibold text-link underline decoration-link underline-offset-4"
            >
              Cadastrar {c.rotulo.toLowerCase()}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
