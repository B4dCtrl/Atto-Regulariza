import { describe, it, expect } from "vitest";
import { gerarCodigo, ALFABETO } from "./codigo-curto";

describe("gerarCodigo", () => {
  it("tem seis caracteres", () => {
    expect(gerarCodigo()).toHaveLength(6);
  });

  it("usa só o alfabeto sem letras ambíguas", () => {
    for (let i = 0; i < 200; i++) {
      for (const c of gerarCodigo()) expect(ALFABETO).toContain(c);
    }
  });

  it("não contém caracteres que se confundem ao ler em voz alta", () => {
    // O e 0, I e 1, S e 5 — quem dita o código por telefone erra nesses.
    for (const proibido of ["O", "0", "I", "1", "S", "5"]) {
      expect(ALFABETO).not.toContain(proibido);
    }
  });

  it("não repete em mil sorteios", () => {
    const vistos = new Set(Array.from({ length: 1000 }, gerarCodigo));
    expect(vistos.size).toBe(1000);
  });
});
