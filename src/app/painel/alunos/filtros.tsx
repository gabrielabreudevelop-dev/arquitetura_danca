"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useTransition } from "react";

type Opcao = { id: string; nome: string };

export type ValoresFiltros = {
  busca: string;
  turma: string;
  ritmo: string;
  modulo: string;
  professor: string;
  periodo: string;
  situacao: string;
  janela: string;
};

/** Valores que não vão para o endereço por serem o padrão. */
const PADRAO: Partial<Record<string, string>> = {
  situacao: "cadastrado",
  janela: "7",
};

const PERIODOS = [
  { id: "vigente", nome: "Vigente" },
  { id: "vence_em_breve", nome: "Vence em breve" },
  { id: "vencido", nome: "Vencido" },
  { id: "trancado", nome: "Trancado" },
  { id: "comeca_em_breve", nome: "Começa em breve" },
  { id: "sem_periodo", nome: "Sem período" },
];

const CONTROLE =
  "min-h-12 w-full rounded-sm border border-borda bg-transparent px-3 text-base";

function Selecao({
  nome,
  rotulo,
  valor,
  todos,
  opcoes,
}: {
  nome: string;
  rotulo: string;
  valor: string;
  /** Texto da opção vazia; sem ele, não há opção vazia. */
  todos?: string;
  opcoes: Opcao[];
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={`filtro-${nome}`} className="font-semibold">
        {rotulo}
      </label>
      <select
        id={`filtro-${nome}`}
        name={nome}
        defaultValue={valor}
        className={CONTROLE}
      >
        {todos !== undefined && <option value="">{todos}</option>}
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Busca e filtros da lista de alunos, num formulário GET. Com JavaScript,
 * mudar uma seleção já filtra (e o endereço fica sem os campos vazios); sem
 * JavaScript, vale o botão "Filtrar".
 */
export function FiltrosAlunos({
  valores,
  turmas,
  ritmos,
  modulos,
  professores,
  temFiltro,
}: {
  valores: ValoresFiltros;
  turmas: Opcao[];
  ritmos: Opcao[];
  modulos: Opcao[];
  professores: Opcao[];
  temFiltro: boolean;
}) {
  const router = useRouter();
  const [filtrando, iniciar] = useTransition();

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const busca = new URLSearchParams();
    for (const [nome, valor] of new FormData(e.currentTarget)) {
      const texto = String(valor).trim();
      if (texto && PADRAO[nome] !== texto) busca.set(nome, texto);
    }
    // A janela só vale para "vence em breve".
    if (busca.get("periodo") !== "vence_em_breve") busca.delete("janela");
    const consulta = busca.toString();
    iniciar(() =>
      router.push(`/painel/alunos${consulta ? `?${consulta}` : ""}`),
    );
  }

  return (
    <search>
      <form
        method="get"
        action="/painel/alunos"
        onSubmit={enviar}
        onChange={(e) => {
          if ((e.target as HTMLElement).tagName === "SELECT")
            e.currentTarget.requestSubmit();
        }}
        aria-busy={filtrando || undefined}
        className="flex flex-col gap-6"
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="filtro-busca" className="font-semibold">
            Buscar
          </label>
          <input
            id="filtro-busca"
            type="search"
            name="busca"
            defaultValue={valores.busca}
            placeholder="Nome, WhatsApp ou e-mail"
            autoComplete="off"
            className={CONTROLE}
          />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-3">
          <Selecao
            nome="turma"
            rotulo="Turma"
            valor={valores.turma}
            todos="Todas"
            opcoes={turmas}
          />
          <Selecao
            nome="ritmo"
            rotulo="Ritmo"
            valor={valores.ritmo}
            todos="Todos"
            opcoes={ritmos}
          />
          <Selecao
            nome="modulo"
            rotulo="Módulo"
            valor={valores.modulo}
            todos="Todos"
            opcoes={modulos}
          />
          <Selecao
            nome="professor"
            rotulo="Professor"
            valor={valores.professor}
            todos="Todos"
            opcoes={professores}
          />
          <Selecao
            nome="periodo"
            rotulo="Período"
            valor={valores.periodo}
            todos="Todos"
            opcoes={PERIODOS}
          />
          {valores.periodo === "vence_em_breve" && (
            <Selecao
              nome="janela"
              rotulo="Vence nos próximos"
              valor={valores.janela}
              opcoes={["7", "15", "30"].map((d) => ({
                id: d,
                nome: `${d} dias`,
              }))}
            />
          )}
          <Selecao
            nome="situacao"
            rotulo="Situação"
            valor={valores.situacao}
            opcoes={[
              { id: "cadastrado", nome: "Cadastrado" },
              { id: "inativo", nome: "Inativo (encerrado)" },
            ]}
          />
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
          <button
            type="submit"
            disabled={filtrando}
            className="min-h-12 w-full rounded-sm border border-acao px-6 font-semibold text-link hover:bg-acao hover:text-fundo disabled:cursor-wait md:w-auto"
          >
            {filtrando ? "Filtrando…" : "Filtrar"}
          </button>
          {temFiltro && (
            <Link
              href="/painel/alunos"
              className="-mx-2 flex min-h-12 items-center self-start px-2 text-link underline decoration-link underline-offset-4"
            >
              Limpar filtros
            </Link>
          )}
        </div>
      </form>
    </search>
  );
}
