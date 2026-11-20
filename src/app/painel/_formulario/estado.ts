/**
 * Estado de um formulário ligado a `useActionState`. `erros` usa o nome do
 * campo como chave; `"_"` é o erro geral. `valores` devolve o que a pessoa
 * digitou, para o formulário não esvaziar quando há erro.
 */
export type EstadoFormulario = {
  erros?: Record<string, string>;
  valores?: Record<string, string>;
};

export const ESTADO_INICIAL: EstadoFormulario = {};
