import { describe, it, expect } from "vitest";
import { assuntoDeResposta, cabecalhosDeResposta, citar } from "./resposta";

describe("assuntoDeResposta", () => {
  it("põe Re:", () => expect(assuntoDeResposta("Orçamento")).toBe("Re: Orçamento"));
  it("não duplica Re:", () => expect(assuntoDeResposta("RE: Orçamento")).toBe("RE: Orçamento"));
  it("aceita Res: e Resp: do Outlook em português", () => {
    expect(assuntoDeResposta("Res: Orçamento")).toBe("Res: Orçamento");
    expect(assuntoDeResposta("Resp: Orçamento")).toBe("Resp: Orçamento");
  });
  it("assunto vazio", () => expect(assuntoDeResposta("")).toBe("Re: (sem assunto)"));
});

describe("cabecalhosDeResposta", () => {
  it("acumula References e aponta In-Reply-To", () => {
    expect(cabecalhosDeResposta({ messageId: "<b@x>", references: ["<a@x>"] })).toEqual({
      inReplyTo: "<b@x>",
      references: ["<a@x>", "<b@x>"],
    });
  });
  it("sem Message-ID não inventa cabeçalho", () => {
    expect(cabecalhosDeResposta({})).toEqual({});
  });
});

describe("citar", () => {
  it("prefixa cada linha com >", () => {
    const c = citar({
      de: "Ana <ana@x.com>",
      data: new Date("2026-09-23T14:00:00Z"),
      texto: "oi\ntudo bem",
    });
    expect(c).toContain("Ana <ana@x.com> escreveu:");
    expect(c).toContain("> oi\n> tudo bem");
  });
});
