import Link from "next/link";
import { Marca } from "./marca";

const EM_BREVE = [
  {
    nome: "Os passos da aula",
    descricao:
      "Os vídeos que os professores gravam, organizados por ritmo e módulo, para rever quando quiser.",
  },
  {
    nome: "Grade de horários",
    descricao: "Ritmos, módulos, professores, dias e horários de cada turma.",
  },
  {
    nome: "Eventos",
    descricao: "O que vem por aí no estúdio, a começar pelo próximo evento.",
  },
];

// Página provisória até a grade de horários e os eventos públicos existirem.
// Quando houver fotos reais do estúdio, elas entram ao lado da frase principal.
export default function Inicio() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-6 md:px-12">
      <header className="flex min-h-16 items-center justify-between gap-4">
        <Marca />
        <Link
          href="/entrar"
          className="-mx-2 inline-flex min-h-12 items-center px-2 text-link underline decoration-link underline-offset-4 hover:decoration-2"
        >
          Entrar
        </Link>
      </header>

      <main
        id="conteudo"
        className="flex flex-1 flex-col justify-center gap-12 py-12 md:py-24"
      >
        <div className="flex flex-col gap-6">
          <h1 className="max-w-[14ch] text-titulo">
            Onde você <span className="fita">revê o passo</span> e encontra sua
            turma.
          </h1>
          <p className="max-w-prose text-texto-suave">
            A plataforma do estúdio está sendo montada. Em breve, quem dança
            aqui vai rever os passos de cada aula e acompanhar a vida do estúdio
            fora da sala.
          </p>
        </div>

        <section aria-labelledby="em-breve" className="flex flex-col gap-4">
          <h2 id="em-breve" className="text-base">
            Em breve
          </h2>
          <ul className="grid border-linha border-t md:grid-cols-3 md:gap-8">
            {EM_BREVE.map((item) => (
              <li
                key={item.nome}
                className="flex flex-col gap-1 border-linha border-b py-4 md:border-b-0"
              >
                <span className="font-semibold">{item.nome}</span>
                <span className="text-pequeno text-texto-suave">
                  {item.descricao}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
