"use client";

import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { DIAS_SEMANA, urlDaGrade } from "@/servidor/vitrine/texto";

const NOMES_DIAS: Record<string, string> = {
  dom: "Domingo",
  seg: "Segunda",
  ter: "Terça",
  qua: "Quarta",
  qui: "Quinta",
  sex: "Sexta",
  sab: "Sábado",
};

const estiloControle =
  "min-h-12 w-full rounded-sm border border-borda bg-transparent px-3 text-base";

const semAssinatura = () => () => {};

/**
 * Filtros da grade. Sem JavaScript, o formulário envia pelo botão "Filtrar".
 * Com JavaScript, envia ao mudar a seleção e o botão some.
 */
export function Filtros({
  ritmoSlug,
  modulos,
  modulo,
  dia,
}: {
  ritmoSlug: string;
  modulos: { nome: string; slug: string }[];
  modulo?: string;
  dia?: string;
}) {
  const router = useRouter();
  const comJs = useSyncExternalStore(
    semAssinatura,
    () => true,
    () => false,
  );

  return (
    <form
      method="get"
      action={`/grade/${ritmoSlug}`}
      aria-label="Filtros da grade"
      className="flex flex-col gap-4 sm:flex-row sm:items-end"
      onChange={(e) => {
        const dados = new FormData(e.currentTarget);
        router.push(
          urlDaGrade(ritmoSlug, {
            modulo: String(dados.get("modulo") ?? ""),
            dia: String(dados.get("dia") ?? ""),
          }),
        );
      }}
    >
      <div className="flex flex-1 flex-col gap-2 sm:max-w-56">
        <label htmlFor="filtro-modulo" className="font-semibold">
          Módulo
        </label>
        <select
          id="filtro-modulo"
          name="modulo"
          defaultValue={modulo ?? ""}
          className={estiloControle}
        >
          <option value="">Todos</option>
          {modulos.map((m) => (
            <option key={m.slug} value={m.slug}>
              {m.nome}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-1 flex-col gap-2 sm:max-w-56">
        <label htmlFor="filtro-dia" className="font-semibold">
          Dia
        </label>
        <select
          id="filtro-dia"
          name="dia"
          defaultValue={dia ?? ""}
          className={estiloControle}
        >
          <option value="">Todos</option>
          {DIAS_SEMANA.map((d) => (
            <option key={d.curto} value={d.curto}>
              {NOMES_DIAS[d.curto]}
            </option>
          ))}
        </select>
      </div>
      {!comJs && (
        <button
          type="submit"
          className="min-h-12 rounded-sm bg-acao px-6 font-semibold text-fundo hover:bg-acao-escura"
        >
          Filtrar
        </button>
      )}
    </form>
  );
}
