import { describe, it, expect } from "vitest";
import { etapasConcluidas, progressoDasEtapas, type EtapaResumo } from "./etapas";

function etapa(n: number, state: string): EtapaResumo {
  return { stage_number: n, state, fields: {} };
}

describe("etapasConcluidas", () => {
  it("devolve só os números das etapas concluídas", () => {
    const etapas = [etapa(1, "done"), etapa(2, "active"), etapa(3, "pending"), etapa(4, "done")];
    expect(etapasConcluidas(etapas)).toEqual([1, 4]);
  });

  it("devolve lista vazia quando nada foi concluído", () => {
    expect(etapasConcluidas([etapa(1, "pending")])).toEqual([]);
  });

  it("ordena, mesmo se o banco devolver fora de ordem", () => {
    expect(etapasConcluidas([etapa(3, "done"), etapa(1, "done")])).toEqual([1, 3]);
  });
});

describe("progressoDasEtapas", () => {
  it("calcula a porcentagem sobre 5 etapas por padrão", () => {
    expect(progressoDasEtapas([etapa(1, "done"), etapa(2, "done")])).toBe(40);
  });

  it("devolve 0 sem nenhuma concluída", () => {
    expect(progressoDasEtapas([etapa(1, "pending")])).toBe(0);
  });

  it("devolve 100 com todas concluídas", () => {
    const todas = [1, 2, 3, 4, 5].map((n) => etapa(n, "done"));
    expect(progressoDasEtapas(todas)).toBe(100);
  });

  it("aceita um total diferente de 5", () => {
    expect(progressoDasEtapas([etapa(1, "done")], 4)).toBe(25);
  });

  it("não estoura 100 se vierem mais concluídas que o total", () => {
    const seis = [1, 2, 3, 4, 5, 6].map((n) => etapa(n, "done"));
    expect(progressoDasEtapas(seis)).toBe(100);
  });
});
