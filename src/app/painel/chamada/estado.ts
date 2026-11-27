import type { EstadoFormulario } from "../_formulario/estado";

/**
 * Resposta de "Salvar chamada": `vazia` pede a confirmação de chamada sem
 * ninguém; `conflito` traz os ids que a pessoa tinha marcado quando outra
 * pessoa salvou antes (a tela já mostra a chamada atual); `salvo` confirma.
 */
export type EstadoChamada = EstadoFormulario & {
  vazia?: boolean;
  conflito?: string[];
  salvo?: boolean;
};
