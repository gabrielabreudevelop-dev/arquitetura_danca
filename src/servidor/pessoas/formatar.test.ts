import { expect, it } from "vitest";
import { formatarWhatsapp } from "./formatar";

it("formata WhatsApp normalizado como (DDD) número", () => {
  expect(formatarWhatsapp("5527999990000")).toBe("(27) 99999-0000");
  expect(formatarWhatsapp("552733334444")).toBe("(27) 3333-4444");
});

it("devolve o texto como veio quando não reconhece o formato", () => {
  expect(formatarWhatsapp("123")).toBe("123");
});
