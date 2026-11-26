"use client";

import { type FormEvent, useState } from "react";
import type { EstadoFormulario } from "../../../_formulario/estado";

/**
 * Número que muda a cada resposta do servidor. Use como `key` do `<form>`:
 * depois de uma action o React volta os campos ao valor padrão, mas um
 * `<select>` guarda o padrão da primeira renderização (o React não o
 * atualiza), e voltaria à opção inicial em vez da enviada. Remontar o
 * formulário faz os campos nascerem com os `valores` devolvidos.
 */
export function useVersao(estado: EstadoFormulario): number {
  const [visto, setVisto] = useState(estado);
  const [versao, setVersao] = useState(0);
  if (estado !== visto) {
    setVisto(estado);
    setVersao(versao + 1);
  }
  return versao;
}

/**
 * Acompanha os campos de um formulário para as contas da tela: a cada mudança
 * (evento `change` no `<form>`) e a cada resposta do servidor (os `valores`
 * devolvidos com erro, que o React põe de volta nos campos), relê os campos
 * com `ler`. Devolve os campos, o tratador para o `onChange` do `<form>` e a
 * versão (`useVersao`) para a `key` do `<form>`.
 */
export function useAcompanhar<T>(
  estado: EstadoFormulario,
  inicial: T,
  ler: (campo: (nome: string) => string) => T,
) {
  const [campos, setCampos] = useState(inicial);
  const [visto, setVisto] = useState(estado);
  const versao = useVersao(estado);
  if (estado !== visto) {
    setVisto(estado);
    const valores = estado.valores;
    if (valores) setCampos(ler((nome) => valores[nome] ?? ""));
  }
  function aoMudar(e: FormEvent<HTMLFormElement>) {
    const dados = new FormData(e.currentTarget);
    setCampos(ler((nome) => String(dados.get(nome) ?? "")));
  }
  return [campos, aoMudar, versao] as const;
}
