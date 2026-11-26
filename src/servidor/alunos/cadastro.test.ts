import { describe, expect, it } from "vitest";
import {
  ehMensagemWhatsappRepetido,
  mensagemWhatsappRepetido,
} from "./cadastro";

describe("mensagem de WhatsApp repetido", () => {
  it("monta o texto com o nome e reconhece o próprio texto", () => {
    const texto = mensagemWhatsappRepetido("Ana Souza");
    expect(texto).toBe("Já existe Ana Souza com esse WhatsApp.");
    expect(ehMensagemWhatsappRepetido(texto)).toBe(true);
  });

  it("não reconhece outras mensagens do campo", () => {
    expect(
      ehMensagemWhatsappRepetido("WhatsApp inválido. Use DDD e número."),
    ).toBe(false);
    expect(ehMensagemWhatsappRepetido(undefined)).toBe(false);
  });
});
