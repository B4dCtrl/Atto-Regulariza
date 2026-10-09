import { describe, expect, it } from "vitest";
import { cadastroRecente, JANELA_DO_AVISO_MS, valoresDoAviso } from "./aviso-cadastro";

const base = {
  client_name: "Ketliyn",
  client_email: "k@exemplo.com",
  client_phone: null,
  tipo_imovel: "casa",
  situacao: "sem_habite",
  objetivo: "Quero vender o imóvel",
  city: "Campo Magro",
  state: "PR",
};

describe("valoresDoAviso", () => {
  it("traduz os ids do wizard na ordem do modelo", () => {
    expect(valoresDoAviso(base)).toEqual([
      "Ketliyn",
      "Casa em Campo Magro/PR",
      "Sem habite-se / averbação",
      "Quero vender o imóvel",
      "k@exemplo.com",
    ]);
  });

  it("junta telefone e e-mail quando há os dois", () => {
    expect(valoresDoAviso({ ...base, client_phone: "41999999999" })[4]).toBe(
      "41999999999 · k@exemplo.com",
    );
  });

  it("id desconhecido passa como veio", () => {
    expect(valoresDoAviso({ ...base, situacao: "novo_tipo" })[2]).toBe("novo_tipo");
  });

  it("sem cidade, o imóvel fica só com o tipo", () => {
    expect(valoresDoAviso({ ...base, city: null, state: null })[1]).toBe("Casa");
  });

  it("dado ausente vira texto vazio, nunca null", () => {
    const v = valoresDoAviso({
      client_name: null,
      client_email: null,
      client_phone: null,
      tipo_imovel: null,
      situacao: null,
      objetivo: null,
      city: null,
      state: null,
    });
    expect(v).toEqual(["", "", "", "", ""]);
  });
});

describe("cadastroRecente", () => {
  const agora = Date.parse("2026-10-09T12:00:00Z");

  it("aceita o que acabou de nascer", () => {
    expect(cadastroRecente("2026-10-09T11:59:30Z", agora)).toBe(true);
  });

  it("recusa o que passou da janela", () => {
    const velho = new Date(agora - JANELA_DO_AVISO_MS - 1000).toISOString();
    expect(cadastroRecente(velho, agora)).toBe(false);
  });

  it("recusa data inválida", () => {
    expect(cadastroRecente("ontem", agora)).toBe(false);
  });
});
