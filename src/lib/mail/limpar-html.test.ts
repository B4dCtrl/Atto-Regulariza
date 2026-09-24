// src/lib/mail/limpar-html.test.ts
import { describe, it, expect } from "vitest";
import {
  corpoParaExibir,
  corpoParaExibirDetalhado,
  extrairImagensExternas,
  orcamentoDeImagens,
  pesoNaResposta,
  LIMITE_CORPO,
  LIMITE_RESPOSTA,
  LIMITE_EMBUTIDO_BASE64,
} from "./limpar-html";

const semAnexo = { anexos: [] };

describe("corpoParaExibir", () => {
  it("remove script, iframe, form e handlers", () => {
    const h = corpoParaExibir({
      ...semAnexo,
      html: `<p onclick="x()">oi</p><script>alert(1)</script><iframe src="//e"></iframe><form><input></form>`,
    });
    expect(h).toContain("oi");
    expect(h).not.toMatch(/<script|onclick|<iframe|<form|<input/i);
  });

  it("remove javascript: de links", () => {
    const h = corpoParaExibir({ ...semAnexo, html: `<a href="javascript:alert(1)">x</a>` });
    expect(h).not.toContain("javascript:");
  });

  it("links abrem em nova aba sem opener", () => {
    const h = corpoParaExibir({ ...semAnexo, html: `<a href="https://x.com">x</a>` });
    expect(h).toContain('target="_blank"');
    expect(h).toContain('rel="noopener noreferrer"');
  });

  it("mantém tabela", () => {
    const h = corpoParaExibir({ ...semAnexo, html: `<table><tr><td>a</td></tr></table>` });
    expect(h).toContain("<td>a</td>");
  });

  it("troca cid: pela imagem embutida", () => {
    const h = corpoParaExibir({
      html: `<img src="cid:logo1">`,
      anexos: [{ cid: "logo1", contentType: "image/png", content: Buffer.from("PNG") }],
    });
    expect(h).toContain(`src="data:image/png;base64,${Buffer.from("PNG").toString("base64")}"`);
  });

  it("imagem externa perde o src", () => {
    const h = corpoParaExibir({ ...semAnexo, html: `<img src="https://rastreio.com/p.gif">` });
    expect(h).not.toContain("rastreio.com");
  });

  it("data: que não é imagem é removido", () => {
    const h = corpoParaExibir({ ...semAnexo, html: `<a href="data:text/html,<script>">x</a>` });
    expect(h).not.toContain("data:text/html");
  });

  it("texto puro vira pre escapado", () => {
    const h = corpoParaExibir({ ...semAnexo, text: "a < b & <script>" });
    expect(h).toContain("<pre");
    expect(h).toContain("a &lt; b &amp; &lt;script&gt;");
  });

  it("style com url() é removido (pixel de rastreio via background-image)", () => {
    const h = corpoParaExibir({
      ...semAnexo,
      html: `<div style="background-image:url(https://rastreio.com/p.gif)">x</div>`,
    });
    expect(h).not.toContain("url(");
    expect(h).not.toContain("rastreio.com");
  });

  it("style com expression() é removido", () => {
    const h = corpoParaExibir({
      ...semAnexo,
      html: `<div style="width:expression(alert(1))">x</div>`,
    });
    expect(h).not.toContain("expression(");
  });

  it("mantém estilo seguro (cor, alinhamento)", () => {
    const h = corpoParaExibir({
      ...semAnexo,
      html: `<p style="color:red;text-align:center">x</p>`,
    });
    expect(h).toContain("color:red");
    expect(h).toContain("text-align:center");
  });

  it("muitas referências ao mesmo cid não estouram o documento (teto de embutido)", () => {
    const conteudo = Buffer.alloc(500 * 1024, 1); // 500 KB por imagem
    const N = 200; // 200 referências à mesma imagem: sem teto viraria ~136 MB
    const html = Array.from({ length: N }, () => `<img src="cid:logo">`).join("");
    const h = corpoParaExibir({
      html,
      anexos: [{ cid: "logo", contentType: "image/png", content: conteudo }],
    });

    const embutidas = (h.match(/data:image\/png;base64,/g) ?? []).length;
    expect(embutidas).toBeGreaterThan(0);
    expect(embutidas).toBeLessThan(N);
    expect(h.length).toBeLessThan(10 * 1024 * 1024); // documento fica bem abaixo do total sem teto
  });

  it("botão de e-mail transacional mantém fundo, cantos e espaçamento", () => {
    // O modelo do Supabase usa `background:` abreviado; sem ele o texto branco
    // do botão sumia sobre o fundo claro.
    const h = corpoParaExibir({
      ...semAnexo,
      html: `<a style="display:inline-block;background:#1A1A1A;color:#FFFFFF;padding:14px 26px;border-radius:999px;font-family:Arial,sans-serif;text-decoration:none;line-height:1.4">Confirmar</a>`,
    });
    expect(h).toContain("background:#1A1A1A");
    expect(h).toContain("padding:14px 26px");
    expect(h).toContain("border-radius:999px");
    expect(h).toContain("display:inline-block");
    expect(h).toContain("text-decoration:none");
  });

  it("background abreviado com url() continua bloqueado", () => {
    const h = corpoParaExibir({
      ...semAnexo,
      html: `<td style="background:#fff url(https://rastreio.com/p.gif)">x</td>`,
    });
    expect(h).not.toContain("url(");
  });

  it("display:none é mantido (texto de pré-visualização continua escondido)", () => {
    const h = corpoParaExibir({ ...semAnexo, html: `<div style="display:none">pre</div>` });
    expect(h).toContain("display:none");
  });
});

const png = (n: number) => ({ contentType: "image/png", content: Buffer.alloc(n, 7) });

describe("corpoParaExibir com imagens externas liberadas", () => {
  it("imagem externa presente no mapa vira data:", () => {
    const url = "https://loja.com/banner.png";
    const img = png(10);
    const h = corpoParaExibir({
      ...semAnexo,
      html: `<img src="${url}">`,
      externas: new Map([[url, img]]),
    });
    expect(h).toContain(`src="data:image/png;base64,${img.content.toString("base64")}"`);
    expect(h).not.toContain("loja.com");
  });

  it("imagem externa fora do mapa continua sem src", () => {
    const h = corpoParaExibir({
      ...semAnexo,
      html: `<img src="https://a.com/1.png"><img src="https://rastreio.com/p.gif">`,
      externas: new Map([["https://a.com/1.png", png(10)]]),
    });
    expect(h).not.toContain("rastreio.com");
    expect((h.match(/data:image\/png/g) ?? []).length).toBe(1);
  });

  it("svg e tipos que não são imagem nunca viram data:", () => {
    const h = corpoParaExibir({
      ...semAnexo,
      html: `<img src="https://a.com/x.svg"><img src="https://a.com/x.html">`,
      externas: new Map([
        ["https://a.com/x.svg", { contentType: "image/svg+xml", content: Buffer.from("<svg/>") }],
        ["https://a.com/x.html", { contentType: "text/html", content: Buffer.from("<b>") }],
      ]),
    });
    expect(h).not.toContain("data:");
    expect(h).not.toContain("a.com");
  });

  it("url com &amp; no HTML casa com a chave decodificada", () => {
    const url = "https://a.com/i.png?x=1&y=2";
    const html = `<img src="https://a.com/i.png?x=1&amp;y=2">`;
    expect(extrairImagensExternas(html)).toEqual([url]);
    const h = corpoParaExibir({ ...semAnexo, html, externas: new Map([[url, png(10)]]) });
    expect(h).toContain("data:image/png;base64,");
  });

  it("externas dividem o teto de embutido com as cid (nunca passam do total)", () => {
    // Cada imagem dá ~1,5 MB de base64: a cid entra, a externa não cabe no
    // que sobra dos 2,5 MB e fica sem src.
    const grande = 1.1 * 1024 * 1024;
    const h = corpoParaExibir({
      html: `<img src="cid:logo"><img src="https://a.com/grande.png">`,
      anexos: [{ cid: "logo", ...png(grande) }],
      externas: new Map([["https://a.com/grande.png", png(grande)]]),
    });
    expect((h.match(/data:image\/png/g) ?? []).length).toBe(1);
    expect(h.length).toBeLessThan(2.6 * 1024 * 1024);
  });

  it("muitas referências à mesma externa respeitam o teto", () => {
    const url = "https://a.com/p.png";
    const html = Array.from({ length: 200 }, () => `<img src="${url}">`).join("");
    const h = corpoParaExibir({ ...semAnexo, html, externas: new Map([[url, png(500 * 1024)]]) });
    const n = (h.match(/data:image\/png/g) ?? []).length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(200);
    expect(h.length).toBeLessThan(3 * 1024 * 1024);
  });
});

describe("extrairImagensExternas", () => {
  it("só http/https de <img src>, sem repetição", () => {
    const html = `
      <img src="https://a.com/1.png"><img src="http://b.com/2.gif">
      <img src="https://a.com/1.png"><img src="cid:x"><img src="data:image/png;base64,AA==">
      <img src="javascript:alert(1)"><img src="//c.com/3.png"><img src="ftp://d.com/4.png">
      <a href="https://e.com/link.png">x</a><div style="background:url(https://f.com/5.png)"></div>`;
    expect(extrairImagensExternas(html)).toEqual(["https://a.com/1.png", "http://b.com/2.gif"]);
  });

  it("no máximo 20", () => {
    const html = Array.from({ length: 30 }, (_, i) => `<img src="https://a.com/${i}.png">`).join(
      "",
    );
    const r = extrairImagensExternas(html);
    expect(r).toHaveLength(20);
    expect(r[0]).toBe("https://a.com/0.png");
  });

  it("sem imagem, lista vazia", () => {
    expect(extrairImagensExternas("")).toEqual([]);
    expect(extrairImagensExternas("<p>oi</p>")).toEqual([]);
  });
});

describe("pesoNaResposta", () => {
  it("ASCII sem escape pesa o próprio tamanho", () => {
    expect(pesoNaResposta("abc123")).toBe(6);
  });

  it("conta o escape da serialização: < vira barra-x3C, aspas e barra dobram", () => {
    expect(pesoNaResposta("<")).toBe(4);
    expect(pesoNaResposta('"')).toBe(2);
    expect(pesoNaResposta("\\")).toBe(2);
    expect(pesoNaResposta("\n")).toBe(2);
  });

  it("caractere de controle pesa como barra-u-00XX; acento pesa em bytes UTF-8", () => {
    expect(pesoNaResposta("\u0001")).toBe(6);
    expect(pesoNaResposta("é")).toBe(2);
    expect(pesoNaResposta("\u2028")).toBe(6);
  });

  it("nunca é menor que JSON.stringify", () => {
    const s = `<p class="a">olá\n"x"\\ \u0007 ${"<td>".repeat(50)}</p>`;
    expect(pesoNaResposta(s)).toBeGreaterThanOrEqual(Buffer.byteLength(JSON.stringify(s)) - 2);
  });
});

describe("orcamentoDeImagens", () => {
  it("corpo pequeno: teto normal de embutido", () => {
    expect(orcamentoDeImagens(10_000)).toBe(LIMITE_EMBUTIDO_BASE64);
  });

  it("corpo grande: só o que sobra até o teto da resposta", () => {
    const peso = 3 * 1024 * 1024;
    expect(orcamentoDeImagens(peso)).toBe(LIMITE_RESPOSTA - peso);
    expect(peso + orcamentoDeImagens(peso)).toBeLessThanOrEqual(LIMITE_RESPOSTA);
  });

  it("corpo no teto ou acima: nada", () => {
    expect(orcamentoDeImagens(LIMITE_RESPOSTA)).toBe(0);
    expect(orcamentoDeImagens(LIMITE_RESPOSTA + 1)).toBe(0);
  });

  it("tetos deixam folga para o resto do JSON abaixo dos 4,5 MB da Vercel", () => {
    expect(LIMITE_CORPO).toBeLessThan(LIMITE_RESPOSTA);
    expect(LIMITE_RESPOSTA).toBeLessThanOrEqual(4 * 1024 * 1024);
  });
});

describe("corpoParaExibirDetalhado", () => {
  it("informa quais externas foram de fato embutidas", () => {
    const r = corpoParaExibirDetalhado({
      ...semAnexo,
      html: `<img src="https://a.com/1.png"><img src="https://a.com/2.png"><img src="https://a.com/3.png">`,
      externas: new Map([
        ["https://a.com/1.png", png(10)],
        ["https://a.com/2.png", { contentType: "image/svg+xml", content: Buffer.from("<svg/>") }],
      ]),
    });
    expect([...r.externasEmbutidas]).toEqual(["https://a.com/1.png"]);
  });

  it("externa cortada pelo orçamento não conta como embutida", () => {
    const r = corpoParaExibirDetalhado({
      ...semAnexo,
      html: `<img src="https://a.com/1.png"><img src="https://a.com/2.png">`,
      externas: new Map([
        ["https://a.com/1.png", png(300)],
        ["https://a.com/2.png", png(300)],
      ]),
      limiteEmbutido: 500,
    });
    expect([...r.externasEmbutidas]).toEqual(["https://a.com/1.png"]);
  });

  it("limiteEmbutido 0 tira todas as imagens, inclusive cid", () => {
    const r = corpoParaExibirDetalhado({
      html: `<img src="cid:logo"><img src="https://a.com/1.png">`,
      anexos: [{ cid: "logo", ...png(10) }],
      externas: new Map([["https://a.com/1.png", png(10)]]),
      limiteEmbutido: 0,
    });
    expect(r.html).not.toContain("data:");
    expect(r.externasEmbutidas.size).toBe(0);
  });

  it("o HTML final cresce no máximo o orçamento dado em relação ao sem imagens", () => {
    const html = Array.from(
      { length: 50 },
      (_, i) => `<p>texto ${i}</p><img src="cid:logo"><img src="https://a.com/${i % 3}.png">`,
    ).join("");
    const base = {
      html,
      anexos: [{ cid: "logo", ...png(2000) }],
      externas: new Map([0, 1, 2].map((i) => [`https://a.com/${i}.png`, png(3000)])),
    };
    const sem = corpoParaExibirDetalhado({ ...base, limiteEmbutido: 0 }).html;
    const limite = 40_000;
    const com = corpoParaExibirDetalhado({ ...base, limiteEmbutido: limite }).html;
    expect(com.length).toBeGreaterThan(sem.length);
    expect(com.length - sem.length).toBeLessThanOrEqual(limite);
  });

  it("limiteEmbutido nunca passa do teto fixo de embutido", () => {
    const r = corpoParaExibirDetalhado({
      html: `<img src="cid:a"><img src="cid:b">`,
      anexos: [
        { cid: "a", ...png(1.5 * 1024 * 1024) },
        { cid: "b", ...png(1.5 * 1024 * 1024) },
      ],
      limiteEmbutido: 100 * 1024 * 1024,
    });
    expect((r.html.match(/data:image\/png/g) ?? []).length).toBe(1);
  });
});

describe("fluxo de abrir: corpo grande + imagens", () => {
  it("HTML de ~2 MB com imagens grandes: resposta pesada fica abaixo de LIMITE_RESPOSTA", () => {
    const paragrafo = `<p style="color:red">Texto com "aspas" e acentuação</p>`;
    const html =
      paragrafo.repeat(Math.ceil((2 * 1024 * 1024) / paragrafo.length)) +
      `<img src="cid:logo"><img src="https://a.com/1.png"><img src="https://a.com/2.png">`;
    const texto = "Texto com aspas e acentuação. ".repeat(20_000);
    const entrada = {
      html,
      text: texto,
      anexos: [{ cid: "logo", ...png(900 * 1024) }],
      externas: new Map([
        ["https://a.com/1.png", png(900 * 1024)],
        ["https://a.com/2.png", png(900 * 1024)],
      ]),
    };

    const sem = corpoParaExibirDetalhado({ ...entrada, limiteEmbutido: 0 });
    const pesoCorpo = pesoNaResposta(sem.html) + pesoNaResposta(texto);
    expect(pesoCorpo).toBeLessThan(LIMITE_CORPO);
    const orcamento = orcamentoDeImagens(pesoCorpo);
    const com = corpoParaExibirDetalhado({ ...entrada, limiteEmbutido: orcamento });

    expect(pesoNaResposta(com.html) + pesoNaResposta(texto)).toBeLessThanOrEqual(LIMITE_RESPOSTA);
    // Sem o orçamento dinâmico, os 2,5 MB fixos teriam estourado.
    expect(pesoCorpo + LIMITE_EMBUTIDO_BASE64).toBeGreaterThan(LIMITE_RESPOSTA);
    // A externa cortada pelo orçamento não conta como mostrada.
    expect(com.externasEmbutidas.size).toBeLessThan(2);
  });
});
