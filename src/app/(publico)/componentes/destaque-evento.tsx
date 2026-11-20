import type { ReactNode } from "react";
import type { EventoPublico } from "@/servidor/vitrine/consultas";
import { formatarDataEvento } from "@/servidor/vitrine/texto";
import { BotaoIngresso } from "./botao-ingresso";

/** Capa mais larga que alta (ex.: 16:9) ganha mais espaço que um post vertical. */
function capaDeitada(capa: { largura: number; altura: number }): boolean {
  return capa.largura / capa.altura >= 1.2;
}

const estiloFaixa = "faixa-esgotado px-3 py-1";

/**
 * Um evento em destaque: capa inteira, na proporção original (sem cortes),
 * título, data, local, preço e o botão de ingresso. Quando esgotado, a faixa
 * "Esgotado" fica no canto da capa ou, sem capa, ao lado do título.
 *
 * - `rotulo`: linha acima do título (ex.: "Próximo evento").
 * - `nivelTitulo`: `h1` quando o evento é o assunto da página.
 * - `acoes`: links numa linha abaixo do botão (ex.: "Ver detalhes").
 * - Sem capa, `fita` marca o rótulo com a fita do estúdio; com capa, a capa
 *   já é a ousadia da tela e a fita não aparece.
 */
export function DestaqueEvento({
  evento,
  rotulo,
  nivelTitulo: Titulo = "h2",
  acoes,
  fita = false,
}: {
  evento: EventoPublico;
  rotulo?: string;
  nivelTitulo?: "h1" | "h2";
  acoes?: ReactNode;
  fita?: boolean;
}) {
  const { capa } = evento;
  const deitada = capa ? capaDeitada(capa) : false;
  const colunas = !capa
    ? ""
    : deitada
      ? "lg:grid-cols-[7fr_5fr]"
      : "md:grid-cols-2 lg:grid-cols-[5fr_7fr]";

  return (
    <article
      aria-labelledby={`evento-${evento.id}`}
      className={`grid items-center gap-6 md:gap-12 ${colunas}`}
    >
      {capa && (
        // No celular a capa tem altura limitada, para o título e o botão de
        // ingresso aparecerem já na primeira tela; a proporção é mantida.
        <div className="relative w-fit">
          {/* biome-ignore lint/performance/noImgElement: rota própria que serve os bytes do banco; largura e altura reais evitam o pulo do layout. */}
          <img
            src={`/capas/${capa.id}`}
            alt={`Arte de divulgação de ${evento.titulo}`}
            width={capa.largura}
            height={capa.altura}
            className="block h-auto max-h-[45svh] w-auto max-w-full md:max-h-[80svh]"
          />
          {evento.esgotado && (
            <span className={`absolute top-0 left-0 ${estiloFaixa}`}>
              Esgotado
            </span>
          )}
        </div>
      )}

      <div className="flex max-w-prose flex-col gap-6">
        <div className="flex flex-col gap-3">
          {rotulo && (
            <p className="font-semibold">
              {fita && !capa ? (
                <span className="fita">{rotulo}</span>
              ) : (
                <span className="text-texto-suave">{rotulo}</span>
              )}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <Titulo id={`evento-${evento.id}`} className="text-titulo">
              {evento.titulo}
            </Titulo>
            {evento.esgotado && !capa && (
              <span className={estiloFaixa}>Esgotado</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <p className="font-semibold">
            {formatarDataEvento(evento.inicio, evento.fim)}
          </p>
          {evento.local && <p className="text-texto-suave">{evento.local}</p>}
          {evento.preco && <p>{evento.preco}</p>}
        </div>

        <div className="flex flex-col gap-2 md:items-start">
          <BotaoIngresso evento={evento} />
          {acoes && (
            <div className="flex flex-wrap items-center gap-x-8">{acoes}</div>
          )}
        </div>
      </div>
    </article>
  );
}
