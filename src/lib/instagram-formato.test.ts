import { describe, it, expect } from "vitest";
import { PERGUNTAS } from "./triagem";
import { iniciar } from "./conversa-triagem";
import { montarPayloadIg, lerEntradaIg, LIMITE_IG } from "./instagram-formato";

describe("montarPayloadIg", () => {
  it("texto vira mensagem simples", () => {
    const p = montarPayloadIg("123", { tipo: "texto", texto: "Olá" });
    expect(p.recipient.id).toBe("123");
    expect(p.message.text).toBe("Olá");
    expect(p.message.quick_replies).toBeUndefined();
  });

  it("opções viram respostas rápidas", () => {
    const p = montarPayloadIg("123", iniciar().envios[1]);
    expect(p.message.quick_replies).toHaveLength(4);
    expect(p.message.quick_replies?.[0].content_type).toBe("text");
  });

  it("o payload da resposta é o valor, que a conversa espera de volta", () => {
    const p = montarPayloadIg("123", iniciar().envios[1]);
    expect(p.message.quick_replies?.map((q) => q.payload)).toEqual([
      "vender",
      "heranca",
      "notificacao",
      "regularizar",
    ]);
  });

  it("nenhum título estoura os 20 caracteres do Instagram", () => {
    for (const pergunta of PERGUNTAS) {
      if (pergunta.tipo !== "opcoes") continue;
      const p = montarPayloadIg("123", {
        tipo: "opcoes",
        texto: pergunta.texto,
        opcoes: pergunta.opcoes.map((o) => ({
          valor: o.valor as string,
          rotulo: o.rotulo,
          ...(o.curto ? { curto: o.curto } : {}),
        })),
      });
      for (const q of p.message.quick_replies ?? []) {
        expect(q.title.length).toBeLessThanOrEqual(LIMITE_IG.titulo);
      }
    }
  });

  it("usa o rótulo curto quando existe, em vez de cortar no meio", () => {
    const p = montarPayloadIg("123", {
      tipo: "opcoes",
      texto: "O que está diferente?",
      opcoes: [{ valor: "a", rotulo: "Construção nunca averbada", curto: "Nunca averbada" }],
    });
    expect(p.message.quick_replies?.[0].title).toBe("Nunca averbada");
  });

  it("corta texto acima do limite", () => {
    const p = montarPayloadIg("123", { tipo: "texto", texto: "x".repeat(3000) });
    expect(p.message.text.length).toBe(LIMITE_IG.texto);
  });
});

describe("lerEntradaIg", () => {
  const envelope = (mensagem: Record<string, unknown>) => ({
    object: "instagram",
    entry: [{ messaging: [{ sender: { id: "999" }, message: mensagem }] }],
  });

  it("lê mensagem de texto", () => {
    expect(lerEntradaIg(envelope({ mid: "m1", text: " oi " }))).toEqual({
      de: "999",
      texto: "oi",
    });
  });

  it("resposta rápida chega pelo payload, não pelo texto visível", () => {
    const r = lerEntradaIg(
      envelope({ mid: "m2", text: "Nunca averbada", quick_reply: { payload: "nunca_averbada" } }),
    );
    expect(r?.texto).toBe("nunca_averbada");
  });

  it("ignora eco da própria mensagem, senão o bot conversa sozinho", () => {
    const corpo = {
      object: "instagram",
      entry: [
        {
          messaging: [{ sender: { id: "999" }, message: { mid: "m3", is_echo: true, text: "oi" } }],
        },
      ],
    };
    expect(lerEntradaIg(corpo)).toBeNull();
  });

  it("ignora confirmação de leitura", () => {
    expect(
      lerEntradaIg({
        object: "instagram",
        entry: [{ messaging: [{ sender: { id: "9" }, read: {} }] }],
      }),
    ).toBeNull();
  });

  it("figurinha e áudio viram texto vazio", () => {
    const r = lerEntradaIg(envelope({ mid: "m4", attachments: [{ type: "audio" }] }));
    expect(r).toEqual({ de: "999", texto: "" });
  });

  it("aguenta corpo malformado", () => {
    expect(lerEntradaIg({})).toBeNull();
    expect(lerEntradaIg(null)).toBeNull();
  });
});
