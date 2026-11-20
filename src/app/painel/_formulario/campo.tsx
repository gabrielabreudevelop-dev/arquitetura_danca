import type { ReactNode } from "react";

const estiloControle =
  "min-h-12 w-full rounded-sm border border-borda bg-transparent px-3 text-base aria-invalid:border-erro";

type PropsCampo = {
  /** Nome do campo no formulário (também o id e a chave em `erros`). */
  nome: string;
  /** Rótulo, acima do controle. */
  rotulo: string;
  /**
   * Tipo do controle. `"texto"` (padrão), `"email"`, `"numero"`, `"data"`,
   * `"hora"`, `"url"` e `"senha"` geram `<input>`; `"area"` gera `<textarea>`;
   * `"selecao"` gera `<select>` (opções em `children`, como `<option>`);
   * `"caixa"` gera checkbox com o rótulo ao lado; `"arquivo"` gera `<input type=file>`.
   */
  tipo?:
    | "texto"
    | "email"
    | "numero"
    | "data"
    | "hora"
    | "url"
    | "senha"
    | "area"
    | "selecao"
    | "caixa"
    | "arquivo";
  /** Valor inicial (texto, área, seleção, data...). Para `"caixa"`, use `marcado`. */
  valor?: string;
  /** Só para `"caixa"`: começa marcada? Nunca pré-marque consentimentos. */
  marcado?: boolean;
  /** Ajuda abaixo do rótulo, em `text-pequeno`. */
  ajuda?: string;
  /** Mensagem de erro do campo (de `EstadoFormulario.erros[nome]`). */
  erro?: string;
  obrigatorio?: boolean;
  /** Atributos extras do controle: `accept`, `min`, `max`, `maxLength`, `rows`, `autoComplete`... */
  atributos?: Record<string, string | number | boolean | undefined>;
  /** Opções (`<option>`) quando `tipo="selecao"`. */
  children?: ReactNode;
};

const TIPOS_INPUT = {
  texto: "text",
  email: "email",
  numero: "number",
  data: "date",
  hora: "time",
  url: "url",
  senha: "password",
  arquivo: "file",
} as const;

/**
 * Campo de formulário: rótulo acima, ajuda opcional e erro abaixo, ligados ao
 * controle por `aria-describedby`; com erro, o controle recebe `aria-invalid`.
 * Funciona em formulários de server action (sem estado próprio, `defaultValue`).
 */
export function Campo({
  nome,
  rotulo,
  tipo = "texto",
  valor,
  marcado,
  ajuda,
  erro,
  obrigatorio,
  atributos,
  children,
}: PropsCampo) {
  const idAjuda = ajuda ? `${nome}-ajuda` : undefined;
  const idErro = erro ? `${nome}-erro` : undefined;
  const descricao = [idAjuda, idErro].filter(Boolean).join(" ") || undefined;
  const comum = {
    id: nome,
    name: nome,
    required: obrigatorio,
    "aria-invalid": erro ? true : undefined,
    "aria-describedby": descricao,
    ...atributos,
  };

  let controle: ReactNode;
  if (tipo === "area") {
    controle = (
      <textarea
        rows={4}
        defaultValue={valor}
        {...comum}
        className={`${estiloControle} py-3`}
      />
    );
  } else if (tipo === "selecao") {
    controle = (
      <select defaultValue={valor} {...comum} className={estiloControle}>
        {children}
      </select>
    );
  } else if (tipo === "caixa") {
    controle = (
      <input
        type="checkbox"
        defaultChecked={marcado}
        {...comum}
        className="size-6 shrink-0 accent-acao aria-invalid:outline-2 aria-invalid:outline-erro"
      />
    );
  } else if (tipo === "arquivo") {
    controle = (
      <input
        type="file"
        {...comum}
        className={`${estiloControle} py-2 file:mr-3 file:min-h-8 file:rounded-sm file:border-0 file:bg-fundo-suave file:px-3 file:font-semibold file:text-texto`}
      />
    );
  } else {
    controle = (
      <input
        type={TIPOS_INPUT[tipo]}
        defaultValue={valor}
        {...comum}
        className={estiloControle}
      />
    );
  }

  const mensagens = (
    <>
      {ajuda && (
        <p id={idAjuda} className="text-pequeno text-texto-suave">
          {ajuda}
        </p>
      )}
      {erro && (
        <p id={idErro} className="text-erro">
          {erro}
        </p>
      )}
    </>
  );

  if (tipo === "caixa") {
    return (
      <div className="flex flex-col gap-2">
        <label
          htmlFor={nome}
          className="-mx-2 flex min-h-12 items-center gap-3 px-2 font-semibold"
        >
          {controle}
          <span>{rotulo}</span>
        </label>
        {mensagens}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={nome} className="font-semibold">
        {rotulo}
      </label>
      {controle}
      {mensagens}
    </div>
  );
}
