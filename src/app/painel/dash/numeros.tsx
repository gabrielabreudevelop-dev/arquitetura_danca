import Link from "next/link";
import {
  type Dash,
  JANELAS,
  urlAlunos,
  urlContatos,
} from "@/servidor/alunos/listas";
import type { numerosDeBolsistas } from "./bolsistas";
import {
  DIMENSOES_DO_DASH,
  type Por,
  urlDash,
  type VisaoDoDash,
} from "./endereco";

const LINK = "text-link underline decoration-link underline-offset-4";

/** Uma linha do dash: o rótulo à esquerda, o número (que é o link) à direita. */
function Linha({
  rotulo,
  href,
  numero,
  nota,
}: {
  rotulo: string;
  href: string;
  numero: number;
  nota?: string;
}) {
  return (
    <li className="border-linha border-b first:border-t">
      <Link
        href={href}
        className="-mx-2 flex min-h-12 items-center justify-between gap-4 px-2 py-3 hover:bg-fundo-suave"
      >
        <span className="flex min-w-0 flex-col">
          <span className="break-words">{rotulo}</span>
          {nota && <span className="text-texto-suave">{nota}</span>}
        </span>
        <span className={`shrink-0 whitespace-nowrap font-semibold ${LINK}`}>
          {numero}
          <span aria-hidden="true"> →</span>
        </span>
      </Link>
    </li>
  );
}

const ROTULO_POR: Record<Por, string> = {
  turma: "Turma",
  ritmo: "Ritmo",
  modulo: "Módulo",
  professor: "Professor",
};

export function NumerosDoDash({
  dash,
  visao,
}: {
  dash: Dash;
  visao: VisaoDoDash;
}) {
  const { janela, por } = visao;
  const grupos = dash.por[por];
  return (
    <>
      <section aria-labelledby="dash-periodos" className="flex flex-col gap-6">
        <h2 id="dash-periodos" className="text-base">
          Períodos
        </h2>
        <ul>
          <Linha
            rotulo="Períodos vigentes"
            numero={dash.vigentes}
            href={urlAlunos({ periodo: "vigente" })}
          />
          <Linha
            rotulo={`Vencem em breve (${janela} dias)`}
            numero={dash.vencemEmBreve}
            href={urlAlunos({ periodo: "vence_em_breve", janela })}
          />
          <Linha
            rotulo="Vencidos sem contato"
            nota={`(dos ${dash.vencidos90} vencidos nos últimos 90 dias)`}
            numero={dash.vencidosSemContato}
            href={urlContatos({ lista: "vencido", semContato: true })}
          />
          <Linha
            rotulo="Trancados"
            numero={dash.trancados}
            href={urlAlunos({ periodo: "trancado" })}
          />
          <Linha
            rotulo="Cadastrados sem período"
            numero={dash.semPeriodo}
            href={urlAlunos({ periodo: "sem_periodo" })}
          />
        </ul>
        <nav
          aria-label="Janela de Vencem em breve"
          className="flex flex-col gap-2"
        >
          <span className="font-semibold">Vencem em breve nos próximos</span>
          <ul className="flex rounded-sm border border-borda md:self-start">
            {JANELAS.map((j) => (
              <li
                key={j}
                className="flex-1 border-borda border-l first:border-l-0"
              >
                {j === janela ? (
                  <span
                    aria-current="true"
                    className="flex min-h-12 items-center justify-center whitespace-nowrap bg-rosa-suave px-4 font-semibold"
                  >
                    {j} dias
                  </span>
                ) : (
                  <Link
                    href={urlDash({ janela: j, por })}
                    className="flex min-h-12 items-center justify-center whitespace-nowrap px-4 text-link hover:bg-fundo-suave"
                  >
                    {j} dias
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </section>

      <section aria-labelledby="dash-por" className="flex flex-col gap-6">
        <h2 id="dash-por" className="text-base">
          Vigentes por
        </h2>
        <nav aria-label="Agrupar vigentes por">
          <ul className="flex border-linha border-b">
            {DIMENSOES_DO_DASH.map((d) => (
              <li key={d} className="flex-1 md:flex-none">
                <Link
                  href={urlDash({ janela, por: d })}
                  aria-current={d === por ? "page" : undefined}
                  className={`-mb-px flex min-h-12 items-center justify-center border-b-2 px-2 text-center md:px-6 ${
                    d === por
                      ? "border-marca font-semibold"
                      : "border-transparent text-link hover:border-linha"
                  }`}
                >
                  {ROTULO_POR[d]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {grupos.length === 0 ? (
          <p className="text-texto-suave">
            Nenhum aluno com período vigente em turmas.
          </p>
        ) : (
          <ul>
            {grupos.map((g) => (
              <Linha
                key={g.id}
                rotulo={g.rotulo}
                numero={g.quantidade}
                href={g.url}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/** Bolsistas: cada número abre a lista que o contou (ver `numerosDeBolsistas`). */
export function NumerosDeBolsistas({
  numeros,
}: {
  numeros: ReturnType<typeof numerosDeBolsistas>;
}) {
  return (
    <section aria-labelledby="dash-bolsistas" className="flex flex-col gap-6">
      <h2 id="dash-bolsistas" className="text-base">
        Bolsistas
      </h2>
      <ul>
        <Linha
          rotulo="Bolsistas ativos"
          numero={numeros.ativos.numero}
          href={numeros.ativos.href}
        />
        <Linha
          rotulo="Bolsistas sem vir há 15 dias"
          numero={numeros.semVir.numero}
          href={numeros.semVir.href}
        />
      </ul>
    </section>
  );
}
