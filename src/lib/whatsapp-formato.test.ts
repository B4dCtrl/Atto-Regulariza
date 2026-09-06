import { describe, it, expect } from "vitest";
import { PERGUNTAS } from "./triagem";
import { iniciar } from "./conversa-triagem";
import { montarPayload, lerEntrada, LIMITE } from "./whatsapp-formato";

describe("montarPayload", () => {
  it("texto vira mensagem simples", () => {
    const p = montarPayload("5541999999999", { tipo: "texto", texto: "Olá" });
    expect(p.type).toBe("text");
    expect(p.to).toBe("5541999999999");
  });

  it("até três opções cabem em botões", () => {
    const p = montarPayload("55", {
      tipo: "opcoes",
      texto: "Escolha",
      opcoes: [
        { valor: "a", rotulo: "A" },
        { valor: "b", rotulo: "B" },
      ],
    });
    expect(p.type).toBe("interactive");
    expect(p.interactive?.type).toBe("button");
  });

  it("quatro opções viram lista, porque botão só aceita três", () => {
    const p = montarPayload("55", {
      tipo: "opcoes",
      texto: "Escolha",
      opcoes: ["a", "b", "c", "d"].map((v) => ({ valor: v, rotulo: v.toUpperCase() })),
    });
    expect(p.interactive?.type).toBe("list");
    expect(p.interactive?.action.sections?.[0].rows).toHaveLength(4);
  });

  it("nenhum título de opção estoura o limite da Meta", () => {
    for (const pergunta of PERGUNTAS) {
      if (pergunta.tipo !== "opcoes") continue;
      const p = montarPayload("55", {
        tipo: "opcoes",
        texto: pergunta.texto,
        opcoes: pergunta.opcoes.map((o) => ({ valor: o.valor as string, rotulo: o.rotulo })),
      });
      for (const row of p.interactive?.action.sections?.[0].rows ?? []) {
        expect(row.title.length).toBeLessThanOrEqual(LIMITE.tituloLinha);
      }
    }
  });

  it("rótulo cortado no título aparece inteiro na descrição", () => {
    const longo = "Construção nunca averbada no cartório de registro";
    const p = montarPayload("55", {
      tipo: "opcoes",
      texto: "Escolha",
      opcoes: [
        { valor: "a", rotulo: longo },
        { valor: "b", rotulo: "B" },
        { valor: "c", rotulo: "C" },
        { valor: "d", rotulo: "D" },
      ],
    });
    const row = p.interactive?.action.sections?.[0].rows[0];
    expect(row?.title.length).toBeLessThanOrEqual(LIMITE.tituloLinha);
    expect(row?.description).toBe(longo);
  });

  it("o id da linha é o valor, que é o que a conversa espera de volta", () => {
    const p = montarPayload("55", iniciar().envios[1]);
    const ids = p.interactive?.action.sections?.[0].rows.map((r) => r.id);
    expect(ids).toEqual(["vender", "heranca", "notificacao", "regularizar"]);
  });

  it("corta corpo maior que o limite em vez de deixar a Meta recusar", () => {
    const p = montarPayload("55", { tipo: "texto", texto: "x".repeat(5000) });
    expect(p.text?.body.length).toBe(LIMITE.corpo);
  });
});

describe("lerEntrada", () => {
  const envelope = (mensagem: Record<string, unknown>) => ({
    entry: [{ changes: [{ value: { messages: [mensagem] } }] }],
  });

  it("lê mensagem de texto", () => {
    const r = lerEntrada(envelope({ from: "5541988887777", type: "text", text: { body: " oi " } }));
    expect(r).toEqual({ de: "5541988887777", texto: "oi" });
  });

  it("lê o id da linha escolhida numa lista", () => {
    const r = lerEntrada(
      envelope({
        from: "55",
        type: "interactive",
        interactive: { type: "list_reply", list_reply: { id: "gaveta", title: "Contrato" } },
      }),
    );
    expect(r?.texto).toBe("gaveta");
  });

  it("lê o id do botão", () => {
    const r = lerEntrada(
      envelope({
        from: "55",
        type: "interactive",
        interactive: { type: "button_reply", button_reply: { id: "casa", title: "Casa" } },
      }),
    );
    expect(r?.texto).toBe("casa");
  });

  it("ignora recibo de entrega, que não é mensagem de ninguém", () => {
    expect(
      lerEntrada({ entry: [{ changes: [{ value: { statuses: [{ status: "read" }] } }] }] }),
    ).toBeNull();
  });

  it("ignora áudio e figurinha sem quebrar", () => {
    expect(lerEntrada(envelope({ from: "55", type: "audio", audio: { id: "1" } }))).toEqual({
      de: "55",
      texto: "",
    });
  });

  it("aguenta corpo malformado", () => {
    expect(lerEntrada({})).toBeNull();
    expect(lerEntrada(null)).toBeNull();
  });
});
