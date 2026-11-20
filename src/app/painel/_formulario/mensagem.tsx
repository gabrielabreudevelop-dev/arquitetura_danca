/** Erro geral do formulário (chave `"_"` de `erros`). Não renderiza nada sem texto. Vai acima do botão. */
export function MensagemErroGeral({ erro }: { erro?: string }) {
  if (!erro) return null;
  return (
    <p role="alert" className="text-erro">
      {erro}
    </p>
  );
}
