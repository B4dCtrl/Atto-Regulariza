import { describe, it, expect } from "vitest";
import { schemaEnviar, schemaListar } from "./validacao";

const ok = {
  de: "tais@atoregulariza.com.br",
  para: ["cliente@gmail.com"],
  assunto: "Oi",
  texto: "Olá",
};

describe("schemaEnviar", () => {
  it("aceita envio válido", () => expect(schemaEnviar.safeParse(ok).success).toBe(true));
  it("recusa remetente fora da lista", () =>
    expect(schemaEnviar.safeParse({ ...ok, de: "ceo@atoregulariza.com.br" }).success).toBe(false));
  it("recusa destinatário inválido", () =>
    expect(schemaEnviar.safeParse({ ...ok, para: ["nao-e-email"] }).success).toBe(false));
  it("recusa mais de 10 destinatários", () =>
    expect(
      schemaEnviar.safeParse({ ...ok, para: Array.from({ length: 11 }, (_, i) => `a${i}@x.com`) })
        .success,
    ).toBe(false));
  it("recusa quebra de linha no assunto (injeção de cabeçalho)", () =>
    expect(schemaEnviar.safeParse({ ...ok, assunto: "Oi\r\nBcc: x@y.com" }).success).toBe(false));
  it("recusa texto vazio", () =>
    expect(schemaEnviar.safeParse({ ...ok, texto: "   " }).success).toBe(false));
});

describe("schemaListar", () => {
  it("recusa pasta inventada", () =>
    expect(schemaListar.safeParse({ pasta: "INBOX.Trash", pagina: 0 }).success).toBe(false));
});
