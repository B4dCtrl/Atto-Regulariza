// src/lib/mail/limpar-html.test.ts
import { describe, it, expect } from "vitest";
import { corpoParaExibir } from "./limpar-html";

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
