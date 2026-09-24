import { describe, it, expect } from "vitest";
import { cumprimento, montarSaudacao, primeiroNome, type ProcessoPessoal } from "./resumo-pessoal";

// 15h em São Paulo (UTC-3).
const TARDE = new Date("2026-09-24T18:00:00Z");

function proc(diasParado: number, parado = diasParado >= 7): ProcessoPessoal {
  return { id: `id-${diasParado}`, nome: `Casa ${diasParado}`, etapa: 2, diasParado, parado };
}

describe("cumprimento", () => {
  it("usa o relógio de São Paulo, não o do servidor", () => {
    // 14h UTC = 11h em SP: ainda é manhã lá.
    expect(cumprimento(new Date("2026-09-24T14:00:00Z"))).toBe("Bom dia");
    expect(cumprimento(new Date("2026-09-24T15:00:00Z"))).toBe("Boa tarde");
  });

  it("vira boa noite às 18h", () => {
    expect(cumprimento(new Date("2026-09-24T20:59:00Z"))).toBe("Boa tarde");
    expect(cumprimento(new Date("2026-09-24T21:00:00Z"))).toBe("Boa noite");
  });

  it("de madrugada ainda é bom dia", () => {
    expect(cumprimento(new Date("2026-09-24T03:00:00Z"))).toBe("Bom dia");
  });
});

describe("primeiroNome", () => {
  it("pega o primeiro nome do perfil", () => {
    expect(primeiroNome("  Taís Ferreira Lima ", "Taís")).toBe("Taís");
  });

  it("cai no rótulo do alias quando o perfil não tem nome", () => {
    expect(primeiroNome(null, "Gabriel")).toBe("Gabriel");
    expect(primeiroNome("   ", "Lauro")).toBe("Lauro");
  });

  it("devolve nulo sem nome e sem alias", () => {
    expect(primeiroNome(null, null)).toBeNull();
  });
});

describe("montarSaudacao", () => {
  it("monta o exemplo do design", () => {
    expect(montarSaudacao({ agora: TARDE, nome: "Taís", naoLidos: 3, processos: [proc(9)] })).toBe(
      "Boa tarde, Taís. Você tem 3 e-mails não lidos e 1 processo parado há 9 dias.",
    );
  });

  it("usa o singular", () => {
    expect(
      montarSaudacao({ agora: TARDE, nome: "Taís", naoLidos: 1, processos: [proc(1, false)] }),
    ).toBe("Boa tarde, Taís. Você tem 1 e-mail não lido e 1 processo em andamento.");
  });

  it("diz 'há 1 dia' no singular", () => {
    expect(
      montarSaudacao({ agora: TARDE, nome: null, naoLidos: 0, processos: [proc(1, true)] }),
    ).toBe("Boa tarde. Você tem 1 processo parado há 1 dia.");
  });

  it("junta três partes com vírgula e 'e'", () => {
    expect(
      montarSaudacao({
        agora: TARDE,
        nome: "Lauro",
        naoLidos: 12,
        processos: [proc(2), proc(3), proc(8), proc(15)],
      }),
    ).toBe(
      "Boa tarde, Lauro. Você tem 12 e-mails não lidos, 2 processos em andamento e 2 processos parados, o mais antigo há 15 dias.",
    );
  });

  it("diz que não há nada quando tudo é zero", () => {
    expect(montarSaudacao({ agora: TARDE, nome: "Gabriel", naoLidos: 0, processos: [] })).toBe(
      "Boa tarde, Gabriel. Nada pendente com você agora.",
    );
  });

  // Caixa fora do ar não é "zero e-mails": a frase não afirma o que não sabe.
  it("não fala de e-mail quando a caixa não respondeu", () => {
    expect(montarSaudacao({ agora: TARDE, nome: "Gabriel", naoLidos: null, processos: [] })).toBe(
      "Boa tarde, Gabriel. Nenhum processo com você agora.",
    );
    expect(
      montarSaudacao({ agora: TARDE, nome: "Gabriel", naoLidos: null, processos: [proc(9)] }),
    ).toBe("Boa tarde, Gabriel. Você tem 1 processo parado há 9 dias.");
  });

  it("omite a parte de e-mail quando não há não lidos", () => {
    expect(
      montarSaudacao({ agora: TARDE, nome: "Taís", naoLidos: 0, processos: [proc(2), proc(4)] }),
    ).toBe("Boa tarde, Taís. Você tem 2 processos em andamento.");
  });
});
