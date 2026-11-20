import { ESTUDIO } from "@/estudio";
import { linkWhatsapp } from "@/servidor/vitrine/eventos";

const estiloLink =
  "-mx-2 inline-flex min-h-12 items-center px-2 font-semibold text-link underline decoration-link underline-offset-4 hover:decoration-2";

/**
 * Rodapé das páginas públicas: Instagram primeiro (é onde o estúdio fala
 * todo dia), WhatsApp para contato geral, endereço, funcionamento e o site.
 */
export function Rodape() {
  return (
    <footer className="bg-fundo-suave">
      <div className="mx-auto grid w-full max-w-5xl gap-8 px-6 py-12 md:grid-cols-[auto_1fr] md:gap-x-12 lg:gap-x-24 md:px-12">
        <ul aria-label="Contato" className="flex flex-col">
          <li className="flex flex-wrap items-center gap-x-2">
            <span className="text-texto-suave">Instagram</span>
            <a href={ESTUDIO.instagram.url} className={estiloLink}>
              {ESTUDIO.instagram.usuario}
            </a>
          </li>
          <li className="flex flex-wrap items-center gap-x-2">
            <span className="text-texto-suave">WhatsApp</span>
            <a href={linkWhatsapp()} className={estiloLink}>
              {ESTUDIO.whatsapp.exibicao}
            </a>
          </li>
        </ul>
        <div className="flex flex-col gap-4 md:pt-3">
          <address className="flex flex-col gap-1 not-italic">
            {ESTUDIO.endereco.split(" · ").map((parte) => (
              <span key={parte}>{parte}</span>
            ))}
            <span className="text-texto-suave">{ESTUDIO.funcionamento}</span>
          </address>
          <a href={ESTUDIO.site} className={`${estiloLink} self-start`}>
            Site do estúdio
          </a>
        </div>
      </div>
    </footer>
  );
}
