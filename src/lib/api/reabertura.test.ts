import { describe, it, expect } from "vitest";
import { podeReabrir } from "./mensagens.server";

/** Quantos dias atrás, em texto ISO. */
const diasAtras = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

describe("podeReabrir", () => {
  it("conversa encerrada hoje continua fechada", () => {
    expect(podeReabrir(diasAtras(0), "oi")).toBe(false);
  });

  it("continua fechada dentro do prazo", () => {
    expect(podeReabrir(diasAtras(6), "oi")).toBe(false);
  });

  it("reabre depois de sete dias", () => {
    expect(podeReabrir(diasAtras(7), "oi")).toBe(true);
    expect(podeReabrir(diasAtras(30), "bom dia")).toBe(true);
  });

  it("a palavra de reinício reabre na hora", () => {
    for (const p of ["recomeçar", "Reiniciar", "  começar de novo  ", "recomecar!"]) {
      expect(podeReabrir(diasAtras(0), p)).toBe(true);
    }
  });

  it("a palavra dentro de uma frase não reabre", () => {
    expect(podeReabrir(diasAtras(0), "quero recomeçar o processo do meu imóvel")).toBe(false);
  });
});
