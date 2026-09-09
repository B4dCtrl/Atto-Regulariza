import { describe, it, expect } from "vitest";
import { paraWhatsApp, semFormato } from "./enfase";

describe("ênfase por canal", () => {
  it("no WhatsApp vira negrito nativo", () => {
    expect(paraWhatsApp("escreva **Falar com atendente** quando quiser")).toBe(
      "escreva *Falar com atendente* quando quiser",
    );
  });

  it("no Instagram a marcação some, o texto fica", () => {
    expect(semFormato("escreva **Falar com atendente** quando quiser")).toBe(
      "escreva Falar com atendente quando quiser",
    );
  });

  it("marca mais de um trecho na mesma frase", () => {
    expect(paraWhatsApp("**um** e **dois**")).toBe("*um* e *dois*");
    expect(semFormato("**um** e **dois**")).toBe("um e dois");
  });

  it("texto sem marcação passa intacto", () => {
    const t = "Qual a cidade?";
    expect(paraWhatsApp(t)).toBe(t);
    expect(semFormato(t)).toBe(t);
  });

  it("asterisco simples não é tocado", () => {
    expect(paraWhatsApp("2 * 3 = 6")).toBe("2 * 3 = 6");
  });
});
