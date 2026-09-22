import { describe, it, expect } from "vitest";
import { deveIgnorar } from "./mensagens.server";

describe("mensagem sem texto", () => {
  it("figurinha, foto ou marcação em story não iniciam conversa", () => {
    expect(deveIgnorar("", false)).toBe(true);
    expect(deveIgnorar("   ", false)).toBe(true);
  });

  it("mas no meio da triagem o bot responde, para a pessoa não travar", () => {
    expect(deveIgnorar("", true)).toBe(false);
  });

  it("mensagem com texto sempre passa", () => {
    expect(deveIgnorar("oi", false)).toBe(false);
    expect(deveIgnorar("oi", true)).toBe(false);
  });
});
