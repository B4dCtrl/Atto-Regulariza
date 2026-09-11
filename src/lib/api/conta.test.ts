import { describe, it, expect } from "vitest";
import { PALAVRA_DE_CONFIRMACAO } from "./conta.functions";

/**
 * A mesma regra que o servidor aplica antes de excluir. Está aqui porque é a
 * única barreira entre um clique errado e uma conta perdida — e porque o
 * servidor confere de novo: validar só na tela deixaria a exclusão a uma
 * chamada de console de distância.
 */
const confirma = (t: string) => t.trim().toUpperCase() === PALAVRA_DE_CONFIRMACAO;

describe("confirmação de exclusão de conta", () => {
  it("aceita a palavra exata", () => {
    expect(confirma("EXCLUIR")).toBe(true);
  });

  it("aceita em minúsculas e com espaço sobrando", () => {
    expect(confirma("excluir")).toBe(true);
    expect(confirma("  Excluir  ")).toBe(true);
  });

  it("recusa vazio, que é o estado inicial do campo", () => {
    expect(confirma("")).toBe(false);
    expect(confirma("   ")).toBe(false);
  });

  it("recusa qualquer outra coisa", () => {
    for (const t of ["sim", "confirmar", "EXCLUI", "EXCLUIR CONTA", "deletar"]) {
      expect(confirma(t)).toBe(false);
    }
  });
});
