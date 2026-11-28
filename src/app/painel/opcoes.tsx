import Link from "next/link";

/** Opções de filtro como links: a escolhida fica marcada, sem ser link. */
export function Opcoes({
  rotulo,
  id,
  opcoes,
  empilhar = false,
}: {
  rotulo: string;
  id: string;
  opcoes: { rotulo: string; href: string; atual: boolean }[];
  /** No celular, uma opção embaixo da outra (rótulos longos). */
  empilhar?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span id={id} className="font-semibold">
        {rotulo}
      </span>
      <ul
        aria-labelledby={id}
        className={`flex rounded-sm border border-borda ${empilhar ? "flex-col md:flex-row" : ""}`}
      >
        {opcoes.map((o) => (
          <li
            key={o.href}
            className={`flex-1 border-borda ${empilhar ? "border-t first:border-t-0 md:border-t-0 md:border-l md:first:border-l-0" : "border-l first:border-l-0"}`}
          >
            {o.atual ? (
              <span
                aria-current="true"
                className="flex min-h-12 items-center justify-center whitespace-nowrap bg-rosa-suave px-4 font-semibold"
              >
                {o.rotulo}
              </span>
            ) : (
              <Link
                href={o.href}
                className="flex min-h-12 items-center justify-center whitespace-nowrap px-4 text-link hover:bg-fundo-suave"
              >
                {o.rotulo}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
