# Caixa de e-mail no painel — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tela `/admin/mail` que lê, responde e escreve e-mail da caixa `contato@` da Hostinger, só para admin.

**Architecture:** Server functions do TanStack Start conferem o papel `admin` no banco e só então abrem conexão IMAP (`imapflow`) ou SMTP (`nodemailer`) com a Hostinger. Nenhum e-mail é gravado no Supabase; só um registro de envios (`mail_envios`). Lógica pura (aliases, limpeza de HTML, montagem de resposta, validação) fica em `src/lib/mail/` com testes; I/O fica em `*.server.ts`.

**Tech Stack:** TanStack Start (server functions), Zod, Supabase (`supabaseAdmin`), imapflow, mailparser, nodemailer, sanitize-html, Vitest, React + Tailwind + lucide-react + sonner.

Spec: [[2026-09-23-caixa-de-email-design]] (`docs/superpowers/specs/2026-09-23-caixa-de-email-design.md`).

## Global Constraints

- Endereços aceitos como remetente, exatamente: `contato@atoregulariza.com.br`, `suporte@atoregulariza.com.br`, `gabriel@atoregulariza.com.br`, `tais@atoregulariza.com.br`, `lauro@atoregulariza.com.br`.
- IMAP `imap.hostinger.com:993` TLS; SMTP `smtp.hostinger.com:465` TLS; autenticação sempre com `MAIL_USER` / `MAIL_PASSWORD`.
- Toda server function: `.middleware([requireSupabaseAuth])`, `.inputValidator(zod)`, e `await exigirAdmin(context.userId)` como primeira linha do handler — antes de qualquer conexão.
- Nada de `dangerouslySetInnerHTML`. HTML de e-mail só em `<iframe sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc>`.
- Pastas são lista fechada no servidor: `entrada` → INBOX, `enviados` → caixa com `specialUse === "\\Sent"`.
- 50 e-mails por página. Limite de envio: 30 por hora por usuário. Até 10 destinatários, assunto até 200, texto até 20 000 caracteres. Anexo para download até 3 MB (resposta serverless da Vercel tem teto de 4,5 MB; 3 MB de anexo cru vira ~4 MB em base64+JSON).
- Erro devolvido ao navegador é genérico; detalhe vai para `avisarErro`.
- Comentários e textos de interface em PT-BR, no estilo do código em volta (comentário explica o porquê).
- SQL de migração é colado no chat para o usuário rodar no SQL Editor (nunca só o link do arquivo).
- Line endings: o repositório usa `core.autocrlf=true`; lint local roda com `--rule 'prettier/prettier: [error, {endOfLine: auto}]'`.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/mail/enderecos.ts` | Lista dos 5 endereços, rótulos, `descobrirAlias` |
| `src/lib/mail/resposta.ts` | `assuntoDeResposta`, `cabecalhosDeResposta`, `citar` |
| `src/lib/mail/limpar-html.ts` | `corpoParaExibir`: sanitiza HTML, troca `cid:` por `data:`, texto puro vira `<pre>` |
| `src/lib/mail/validacao.ts` | Schemas Zod de entrada das server functions |
| `src/lib/api/exigir-admin.server.ts` | `exigirAdmin(userId)` compartilhado |
| `src/lib/api/mail-imap.server.ts` | Conexão IMAP: listar, abrir, baixar anexo, gravar em Enviados |
| `src/lib/api/mail-smtp.server.ts` | Montar mensagem crua e enviar |
| `src/lib/api/mail.functions.ts` | As 4 server functions |
| `supabase/migrations/20260923_mail_envios.sql` | Tabela de registro de envios |
| `src/routes/admin/mail.tsx` | Tela |
| `src/components/admin/mail/*.tsx` | Lista, leitor, editor |
| `src/routes/mail.tsx` | Redireciona `/mail` → `/admin/mail` |

---

### Task 1: Dependências e endereços

**Files:**
- Modify: `package.json` (via npm)
- Create: `src/lib/mail/enderecos.ts`
- Test: `src/lib/mail/enderecos.test.ts`

**Interfaces:**
- Produces: `ENDERECOS: readonly Endereco[]`, `type Endereco = (typeof ENDERECOS)[number]`, `ROTULO: Record<Endereco, string>`, `ehEndereco(v: string): v is Endereco`, `descobrirAlias(c: { to?: string[]; cc?: string[]; deliveredTo?: string[] }): Endereco`

- [ ] **Step 1: Instalar dependências**

Run: `npm install imapflow mailparser nodemailer sanitize-html && npm install -D @types/mailparser @types/nodemailer @types/sanitize-html`
Expected: instala sem erro. Se `imapflow` não trouxer tipos (`npx tsc --noEmit` reclamar de `imapflow`), rodar `npm install -D @types/imapflow`.

- [ ] **Step 2: Escrever o teste**

```ts
// src/lib/mail/enderecos.test.ts
import { describe, it, expect } from "vitest";
import { descobrirAlias, ehEndereco } from "./enderecos";

describe("descobrirAlias", () => {
  it("acha o alias no To", () => {
    expect(descobrirAlias({ to: ["tais@atoregulariza.com.br"] })).toBe("tais@atoregulariza.com.br");
  });

  it("ignora maiúsculas", () => {
    expect(descobrirAlias({ to: ["Lauro@AtoRegulariza.com.br"] })).toBe(
      "lauro@atoregulariza.com.br",
    );
  });

  it("acha no Cc quando o To é de fora", () => {
    expect(
      descobrirAlias({ to: ["cliente@gmail.com"], cc: ["suporte@atoregulariza.com.br"] }),
    ).toBe("suporte@atoregulariza.com.br");
  });

  it("usa Delivered-To quando veio em cópia oculta", () => {
    expect(
      descobrirAlias({ to: ["lista@x.com"], deliveredTo: ["gabriel@atoregulariza.com.br"] }),
    ).toBe("gabriel@atoregulariza.com.br");
  });

  it("prefere alias pessoal a contato@ quando os dois aparecem", () => {
    expect(
      descobrirAlias({
        to: ["contato@atoregulariza.com.br", "tais@atoregulariza.com.br"],
      }),
    ).toBe("tais@atoregulariza.com.br");
  });

  it("sem alias conhecido, contato@", () => {
    expect(descobrirAlias({ to: ["outro@x.com"] })).toBe("contato@atoregulariza.com.br");
    expect(descobrirAlias({})).toBe("contato@atoregulariza.com.br");
  });
});

describe("ehEndereco", () => {
  it("aceita só os cinco", () => {
    expect(ehEndereco("suporte@atoregulariza.com.br")).toBe(true);
    expect(ehEndereco("hacker@atoregulariza.com.br")).toBe(false);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/lib/mail/enderecos.test.ts`
Expected: FAIL, módulo `./enderecos` não existe.

- [ ] **Step 4: Implementar**

```ts
// src/lib/mail/enderecos.ts
/**
 * Os endereços da caixa única.
 *
 * A empresa paga uma caixa só, `contato@`; os outros são aliases da Hostinger
 * que entregam nela. Esta lista é também a lista de quem pode aparecer como
 * remetente: o servidor recusa qualquer `de` fora dela, senão o painel viraria
 * um jeito de mandar e-mail em nome de qualquer um.
 */
export const ENDERECOS = [
  "contato@atoregulariza.com.br",
  "suporte@atoregulariza.com.br",
  "gabriel@atoregulariza.com.br",
  "tais@atoregulariza.com.br",
  "lauro@atoregulariza.com.br",
] as const;

export type Endereco = (typeof ENDERECOS)[number];

export const PADRAO: Endereco = "contato@atoregulariza.com.br";

export const ROTULO: Record<Endereco, string> = {
  "contato@atoregulariza.com.br": "Contato",
  "suporte@atoregulariza.com.br": "Suporte",
  "gabriel@atoregulariza.com.br": "Gabriel",
  "tais@atoregulariza.com.br": "Taís",
  "lauro@atoregulariza.com.br": "Lauro",
};

export function ehEndereco(v: string): v is Endereco {
  return (ENDERECOS as readonly string[]).includes(v.trim().toLowerCase());
}

/**
 * Para qual dos nossos endereços o e-mail foi mandado.
 *
 * É o remetente padrão da resposta: quem escreveu para a Taís recebe a
 * resposta da Taís. `Delivered-To` cobre a cópia oculta, que não aparece em
 * To nem Cc. Alias pessoal ganha de `contato@` quando os dois aparecem — a
 * pessoa quis falar com alguém específico.
 */
export function descobrirAlias(c: {
  to?: string[];
  cc?: string[];
  deliveredTo?: string[];
}): Endereco {
  const vistos = [...(c.to ?? []), ...(c.cc ?? []), ...(c.deliveredTo ?? [])]
    .map((e) => e.trim().toLowerCase())
    .filter(ehEndereco);
  return vistos.find((e) => e !== PADRAO) ?? (vistos[0] as Endereco | undefined) ?? PADRAO;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/mail/enderecos.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/mail/enderecos.ts src/lib/mail/enderecos.test.ts
git commit -m "feat(mail): enderecos da caixa e descoberta do alias"
```

---

### Task 2: Montagem da resposta

**Files:**
- Create: `src/lib/mail/resposta.ts`
- Test: `src/lib/mail/resposta.test.ts`

**Interfaces:**
- Produces: `assuntoDeResposta(assunto: string): string`, `cabecalhosDeResposta(o: { messageId?: string; references?: string[] }): { inReplyTo?: string; references?: string[] }`, `citar(o: { de: string; data: Date; texto: string }): string`

- [ ] **Step 1: Escrever o teste**

```ts
// src/lib/mail/resposta.test.ts
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
    const c = citar({ de: "Ana <ana@x.com>", data: new Date("2026-09-23T14:00:00Z"), texto: "oi\ntudo bem" });
    expect(c).toContain("Ana <ana@x.com> escreveu:");
    expect(c).toContain("> oi\n> tudo bem");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/mail/resposta.test.ts`
Expected: FAIL, módulo não existe.

- [ ] **Step 3: Implementar**

```ts
// src/lib/mail/resposta.ts
/**
 * O que faz uma resposta ser reconhecida como resposta.
 *
 * Gmail e Outlook agrupam a conversa por `In-Reply-To` e `References`, não pelo
 * assunto. Sem eles, cada resposta do painel chegaria como e-mail solto, e o
 * cliente perderia o fio do que foi combinado.
 */

const JA_E_RESPOSTA = /^\s*(re|res|resp)\s*:/i;

export function assuntoDeResposta(assunto: string): string {
  const a = assunto.trim();
  if (!a) return "Re: (sem assunto)";
  return JA_E_RESPOSTA.test(a) ? a : `Re: ${a}`;
}

export function cabecalhosDeResposta(o: {
  messageId?: string;
  references?: string[];
}): { inReplyTo?: string; references?: string[] } {
  if (!o.messageId) return {};
  return { inReplyTo: o.messageId, references: [...(o.references ?? []), o.messageId] };
}

export function citar(o: { de: string; data: Date; texto: string }): string {
  const quando = o.data.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const linhas = o.texto.replace(/\r\n/g, "\n").split("\n").map((l) => `> ${l}`);
  return `\n\nEm ${quando}, ${o.de} escreveu:\n${linhas.join("\n")}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/mail/resposta.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mail/resposta.ts src/lib/mail/resposta.test.ts
git commit -m "feat(mail): assunto, cabecalhos e citacao da resposta"
```

---

### Task 3: Limpeza do HTML

**Files:**
- Create: `src/lib/mail/limpar-html.ts`
- Test: `src/lib/mail/limpar-html.test.ts`

**Interfaces:**
- Produces: `type AnexoEmbutido = { cid?: string; contentType: string; content: Buffer }`, `corpoParaExibir(o: { html?: string | false; text?: string; anexos: AnexoEmbutido[] }): string` — devolve documento HTML completo para `srcDoc`.

- [ ] **Step 1: Escrever o teste**

```ts
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
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/mail/limpar-html.test.ts`
Expected: FAIL, módulo não existe.

- [ ] **Step 3: Implementar**

```ts
// src/lib/mail/limpar-html.ts
import sanitizeHtml from "sanitize-html";

/**
 * HTML de e-mail é conteúdo de estranho.
 *
 * Qualquer pessoa manda e-mail para o contato@, e o painel é aberto por admin
 * — quem tem acesso a tudo. Por isso a limpeza é por lista de permitidos, no
 * servidor, e o resultado ainda vai para um iframe sem scripts. Duas barreiras:
 * se uma falhar, a outra segura.
 *
 * Imagem externa perde o `src`: além de pixel de rastreio (avisa ao remetente
 * que e quando o e-mail foi aberto), a CSP do site já a bloquearia. Imagem
 * embutida no próprio e-mail (`cid:`) vira `data:` e aparece.
 */

export type AnexoEmbutido = { cid?: string; contentType: string; content: Buffer };

const ESTILO =
  "<style>body{font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#1f2937;margin:16px;word-wrap:break-word}img{max-width:100%;height:auto}pre{white-space:pre-wrap;font-family:inherit;margin:0}</style>";

function escapar(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function trocarCid(html: string, anexos: AnexoEmbutido[]): string {
  return html.replace(/\bsrc\s*=\s*(["'])cid:([^"']+)\1/gi, (_m, aspas: string, cid: string) => {
    const a = anexos.find((x) => x.cid === cid);
    if (!a || !a.contentType.startsWith("image/")) return `src=${aspas}${aspas}`;
    return `src=${aspas}data:${a.contentType};base64,${a.content.toString("base64")}${aspas}`;
  });
}

export function corpoParaExibir(o: {
  html?: string | false;
  text?: string;
  anexos: AnexoEmbutido[];
}): string {
  if (!o.html) {
    return `<!doctype html><meta charset="utf-8">${ESTILO}<pre>${escapar(o.text ?? "")}</pre>`;
  }

  const limpo = sanitizeHtml(trocarCid(o.html, o.anexos), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "font", "center", "span"]),
    allowedAttributes: {
      "*": ["style", "align", "width", "height", "bgcolor", "color", "dir"],
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      td: ["colspan", "rowspan", "valign"],
      th: ["colspan", "rowspan", "valign"],
      font: ["face", "size", "color"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["data"] },
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
      img: (tagName, attribs) => {
        const src = attribs.src ?? "";
        const embutida = /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(src);
        return { tagName, attribs: { ...attribs, src: embutida ? src : "" } };
      },
    },
  });

  return `<!doctype html><meta charset="utf-8">${ESTILO}${limpo}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/mail/limpar-html.test.ts`
Expected: PASS (8 testes). Se o teste de `data:text/html` falhar, conferir que `allowedSchemes` não inclui `data` (só `allowedSchemesByTag.img`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mail/limpar-html.ts src/lib/mail/limpar-html.test.ts
git commit -m "feat(mail): limpeza do HTML recebido"
```

---

### Task 4: Validação de entrada

**Files:**
- Create: `src/lib/mail/validacao.ts`
- Test: `src/lib/mail/validacao.test.ts`

**Interfaces:**
- Consumes: `ENDERECOS` (Task 1)
- Produces: `PASTAS = ["entrada", "enviados"] as const`, `type Pasta`, `schemaListar`, `schemaAbrir`, `schemaAnexo`, `schemaEnviar` (Zod), `type EntradaEnviar = z.infer<typeof schemaEnviar>`

- [ ] **Step 1: Escrever o teste**

```ts
// src/lib/mail/validacao.test.ts
import { describe, it, expect } from "vitest";
import { schemaEnviar, schemaListar } from "./validacao";

const ok = {
  de: "tais@atoregulariza.com.br",
  para: ["cliente@gmail.com"],
  assunto: "Oi",
  texto: "Olá",
};

describe("schemaEnviar", () => {
  it("aceita envio válido", () => expect(schemaEnviar.safeParse(ok).success).toBe(true));
  it("recusa remetente fora da lista", () =>
    expect(schemaEnviar.safeParse({ ...ok, de: "ceo@atoregulariza.com.br" }).success).toBe(false));
  it("recusa destinatário inválido", () =>
    expect(schemaEnviar.safeParse({ ...ok, para: ["nao-e-email"] }).success).toBe(false));
  it("recusa mais de 10 destinatários", () =>
    expect(
      schemaEnviar.safeParse({ ...ok, para: Array.from({ length: 11 }, (_, i) => `a${i}@x.com`) })
        .success,
    ).toBe(false));
  it("recusa quebra de linha no assunto (injeção de cabeçalho)", () =>
    expect(schemaEnviar.safeParse({ ...ok, assunto: "Oi\r\nBcc: x@y.com" }).success).toBe(false));
  it("recusa texto vazio", () =>
    expect(schemaEnviar.safeParse({ ...ok, texto: "   " }).success).toBe(false));
});

describe("schemaListar", () => {
  it("recusa pasta inventada", () =>
    expect(schemaListar.safeParse({ pasta: "INBOX.Trash", pagina: 0 }).success).toBe(false));
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/mail/validacao.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/lib/mail/validacao.ts
import { z } from "zod";
import { ENDERECOS } from "./enderecos";

/**
 * O que o navegador pode pedir às server functions da caixa.
 *
 * Validado nos dois lados: a tela usa estes schemas para avisar antes de
 * enviar, e o servidor para recusar o que chegar fora deles. Nome de pasta
 * IMAP nunca vem do navegador — só um destes dois apelidos.
 */
export const PASTAS = ["entrada", "enviados"] as const;
export type Pasta = (typeof PASTAS)[number];

const uid = z.number().int().positive();

export const schemaListar = z.object({
  pasta: z.enum(PASTAS),
  pagina: z.number().int().min(0).max(1000),
  alias: z.enum(ENDERECOS).optional(),
});

export const schemaAbrir = z.object({ pasta: z.enum(PASTAS), uid });

export const schemaAnexo = z.object({
  pasta: z.enum(PASTAS),
  uid,
  indice: z.number().int().min(0).max(100),
});

export const schemaEnviar = z.object({
  de: z.enum(ENDERECOS),
  para: z.array(z.string().trim().email()).min(1).max(10),
  // Quebra de linha no assunto é o caminho clássico para injetar cabeçalho.
  assunto: z.string().trim().max(200).regex(/^[^\r\n]*$/),
  texto: z.string().max(20_000).refine((t) => t.trim().length > 0, "Escreva a mensagem."),
  respondendo: z.object({ pasta: z.enum(PASTAS), uid }).optional(),
});

export type EntradaEnviar = z.infer<typeof schemaEnviar>;
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/mail/validacao.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mail/validacao.ts src/lib/mail/validacao.test.ts
git commit -m "feat(mail): validacao das entradas da caixa"
```

---

### Task 5: `exigirAdmin` compartilhado

**Files:**
- Create: `src/lib/api/exigir-admin.server.ts`
- Test: `src/lib/api/exigir-admin.test.ts`

**Interfaces:**
- Produces: `exigirAdmin(userId: string): Promise<void>` — lança `Error("Acesso negado.")` se não for admin.

- [ ] **Step 1: Escrever o teste**

```ts
// src/lib/api/exigir-admin.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const roles = vi.fn();
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({ select: () => ({ eq: () => roles() }) }),
  },
}));

import { exigirAdmin } from "./exigir-admin.server";

describe("exigirAdmin", () => {
  beforeEach(() => roles.mockReset());

  it("deixa passar admin", async () => {
    roles.mockResolvedValue({ data: [{ role: "admin" }], error: null });
    await expect(exigirAdmin("u1")).resolves.toBeUndefined();
  });

  it("barra cliente", async () => {
    roles.mockResolvedValue({ data: [{ role: "cliente" }], error: null });
    await expect(exigirAdmin("u1")).rejects.toThrow("Acesso negado.");
  });

  it("barra quando o banco falha", async () => {
    roles.mockResolvedValue({ data: null, error: { message: "x" } });
    await expect(exigirAdmin("u1")).rejects.toThrow("Acesso negado.");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/api/exigir-admin.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/lib/api/exigir-admin.server.ts
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Confere no banco que quem chamou é admin.
 *
 * O papel vem de `user_roles`, nunca do token nem do `user_metadata` — esses o
 * próprio usuário consegue influenciar. Falha do banco conta como "não": na
 * dúvida, fecha.
 */
export async function exigirAdmin(userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error || !data?.some((r) => r.role === "admin")) {
    throw new Error("Acesso negado.");
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/api/exigir-admin.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/exigir-admin.server.ts src/lib/api/exigir-admin.test.ts
git commit -m "feat(api): exigirAdmin compartilhado"
```

---

### Task 6: Tabela `mail_envios`

**Files:**
- Create: `supabase/migrations/20260923_mail_envios.sql`
- Modify: `src/integrations/supabase/types.ts` (bloco da tabela, em ordem alfabética entre as tabelas)

**Interfaces:**
- Produces: tabela `public.mail_envios(id uuid, user_id uuid, de text, para text[], assunto text, respondendo_message_id text null, enviado_em timestamptz)`

- [ ] **Step 1: Escrever a migração**

```sql
-- ================================================================
-- REGISTRO DE ENVIOS DA CAIXA DE E-MAIL — 2026-09-23
-- ----------------------------------------------------------------
-- A caixa contato@ é lida direto da Hostinger; nenhum e-mail é copiado para
-- cá. Só fica o registro de quem mandou o quê, por dois motivos: com quatro
-- admins na mesma caixa, saber quem já respondeu; e contar envios para o
-- limite de 30 por hora.
--
-- Ninguém escreve aqui pelo navegador: só a server function, com
-- service_role. Admin lê; os demais não veem nada.
--
-- Idempotente — seguro rodar mais de uma vez.
-- Rodar em: Supabase › SQL Editor › New Query › Run (selecione tudo antes)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.mail_envios (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  de                     text NOT NULL,
  para                   text[] NOT NULL,
  assunto                text NOT NULL,
  respondendo_message_id text,
  enviado_em             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mail_envios_user_enviado_idx
  ON public.mail_envios (user_id, enviado_em DESC);

ALTER TABLE public.mail_envios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin lê envios" ON public.mail_envios;
CREATE POLICY "admin lê envios" ON public.mail_envios
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Sem política de INSERT/UPDATE/DELETE: com RLS ligada, isso fecha para todos
-- menos service_role.
REVOKE ALL ON public.mail_envios FROM anon;
```

- [ ] **Step 2: Acrescentar os tipos em `types.ts`**

```ts
      mail_envios: {
        Row: {
          id: string;
          user_id: string;
          de: string;
          para: string[];
          assunto: string;
          respondendo_message_id: string | null;
          enviado_em: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          de: string;
          para: string[];
          assunto: string;
          respondendo_message_id?: string | null;
          enviado_em?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          de?: string;
          para?: string[];
          assunto?: string;
          respondendo_message_id?: string | null;
          enviado_em?: string;
        };
        Relationships: [];
      };
```

- [ ] **Step 3: Colar o SQL no chat para o usuário rodar e esperar confirmação**

Mandar o conteúdo do arquivo em bloco `sql` com o link do SQL Editor do projeto `fmscewpxmqnbodzstiqa`. Não seguir para a Task 8 sem o "rodei".

- [ ] **Step 4: Typecheck e commit**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "^src" | cut -d'(' -f1 | sort -u`
Expected: só os 4 arquivos que já falhavam antes (`HowItWorks.tsx`, `admin/leads.tsx`, `equipe.tsx`, `precos.tsx`).

```bash
git add supabase/migrations/20260923_mail_envios.sql src/integrations/supabase/types.ts
git commit -m "feat(mail): registro de envios com RLS"
```

---

### Task 7: IMAP e SMTP

**Files:**
- Create: `src/lib/api/mail-imap.server.ts`
- Create: `src/lib/api/mail-smtp.server.ts`

Sem teste unitário: é I/O puro contra a Hostinger. A verificação é o teste manual da Task 10. A lógica testável já está nas Tasks 1–4.

**Interfaces:**
- Consumes: `Pasta` (Task 4), `corpoParaExibir` (Task 3), `descobrirAlias`, `Endereco` (Task 1)
- Produces:
  - `type ResumoEmail = { uid: number; de: string; para: string[]; assunto: string; data: string; lido: boolean; temAnexo: boolean; alias: Endereco }`
  - `type EmailAberto = ResumoEmail & { html: string; texto: string; anexos: { indice: number; nome: string; tipo: string; tamanho: number }[]; messageId?: string; references: string[]; responderPara: string }`
  - `listar(pasta: Pasta, pagina: number, alias?: Endereco): Promise<{ itens: ResumoEmail[]; total: number }>`
  - `abrir(pasta: Pasta, uid: number): Promise<EmailAberto | null>`
  - `baixarAnexo(pasta: Pasta, uid: number, indice: number): Promise<{ nome: string; base64: string } | null>`
  - `gravarEmEnviados(bruto: Buffer): Promise<void>`
  - `montarEEnviar(o: { de: Endereco; para: string[]; assunto: string; texto: string; inReplyTo?: string; references?: string[] }): Promise<{ bruto: Buffer; messageId: string }>`

- [ ] **Step 1: Escrever `mail-imap.server.ts`**

```ts
// src/lib/api/mail-imap.server.ts
import process from "node:process";
import { ImapFlow } from "imapflow";
import { simpleParser, type AddressObject } from "mailparser";
import type { Pasta } from "@/lib/mail/validacao";
import { corpoParaExibir } from "@/lib/mail/limpar-html";
import { descobrirAlias, type Endereco } from "@/lib/mail/enderecos";

/**
 * A caixa contato@ na Hostinger, lida por IMAP.
 *
 * Uma conexão por chamada: serverless não guarda conexão aberta entre
 * requisições. Custa de 1 a 2 segundos por tela, e em troca nenhum e-mail
 * fica copiado no nosso banco.
 *
 * A senha só existe aqui, em variável de ambiente. Nunca vai para log: o
 * logger do imapflow fica desligado porque ele imprime o diálogo com o
 * servidor.
 */

const POR_PAGINA = 50;
const LIMITE_ANEXO = 15 * 1024 * 1024;

export type ResumoEmail = {
  uid: number;
  de: string;
  para: string[];
  assunto: string;
  data: string;
  lido: boolean;
  temAnexo: boolean;
  alias: Endereco;
};

export type EmailAberto = ResumoEmail & {
  html: string;
  texto: string;
  anexos: { indice: number; nome: string; tipo: string; tamanho: number }[];
  messageId?: string;
  references: string[];
  responderPara: string;
};

function cliente(): ImapFlow {
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASSWORD;
  if (!user || !pass) throw new Error("MAIL_USER ou MAIL_PASSWORD ausente");
  return new ImapFlow({
    host: "imap.hostinger.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });
}

/** Abre, executa e sempre fecha — inclusive quando dá erro no meio. */
async function comCaixa<T>(fn: (c: ImapFlow) => Promise<T>): Promise<T> {
  const c = cliente();
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.logout().catch(() => c.close());
  }
}

/** Nome real da pasta. O de Enviados muda de servidor para servidor. */
async function caminho(c: ImapFlow, pasta: Pasta): Promise<string> {
  if (pasta === "entrada") return "INBOX";
  const caixas = await c.list();
  const enviados = caixas.find((b) => b.specialUse === "\\Sent");
  if (!enviados) throw new Error("pasta de Enviados não encontrada");
  return enviados.path;
}

function enderecos(a: AddressObject | AddressObject[] | undefined): string[] {
  const lista = Array.isArray(a) ? a : a ? [a] : [];
  return lista.flatMap((x) => x.value.map((v) => v.address ?? "")).filter(Boolean);
}

export async function listar(
  pasta: Pasta,
  pagina: number,
  alias?: Endereco,
): Promise<{ itens: ResumoEmail[]; total: number }> {
  return comCaixa(async (c) => {
    const lock = await c.getMailboxLock(await caminho(c, pasta));
    try {
      const busca = alias
        ? { or: [{ to: alias }, { cc: alias }, { header: { "delivered-to": alias } }] }
        : { all: true };
      const uids = ((await c.search(busca, { uid: true })) || []).sort((a, b) => b - a);
      const pagUids = uids.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);
      if (pagUids.length === 0) return { itens: [], total: uids.length };

      const itens: ResumoEmail[] = [];
      for await (const m of c.fetch(
        pagUids.join(","),
        { uid: true, envelope: true, flags: true, bodyStructure: true, internalDate: true, headers: ["delivered-to"] },
        { uid: true },
      )) {
        const env = m.envelope;
        const para = (env?.to ?? []).map((x) => x.address ?? "").filter(Boolean);
        const cc = (env?.cc ?? []).map((x) => x.address ?? "").filter(Boolean);
        const deliveredTo = m.headers
          ? [...m.headers.toString().matchAll(/delivered-to:\s*(\S+)/gi)].map((r) => r[1])
          : [];
        itens.push({
          uid: m.uid,
          de: env?.from?.[0]?.name || env?.from?.[0]?.address || "(sem remetente)",
          para,
          assunto: env?.subject || "(sem assunto)",
          data: (m.internalDate ?? env?.date ?? new Date()).toISOString(),
          lido: m.flags?.has("\\Seen") ?? false,
          temAnexo: JSON.stringify(m.bodyStructure ?? {}).includes('"disposition":"attachment"'),
          alias: descobrirAlias({ to: para, cc, deliveredTo }),
        });
      }
      itens.sort((a, b) => b.uid - a.uid);
      return { itens, total: uids.length };
    } finally {
      lock.release();
    }
  });
}

export async function abrir(pasta: Pasta, uid: number): Promise<EmailAberto | null> {
  return comCaixa(async (c) => {
    const lock = await c.getMailboxLock(await caminho(c, pasta));
    try {
      const baixado = await c.download(String(uid), undefined, { uid: true });
      if (!baixado) return null;
      const e = await simpleParser(baixado.content);
      await c.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });

      const para = enderecos(e.to);
      const cc = enderecos(e.cc);
      const dt = e.headers.get("delivered-to");
      const deliveredTo = (Array.isArray(dt) ? dt : dt ? [dt] : []).map(String);
      const anexosReais = e.attachments.filter((a) => a.contentDisposition === "attachment");
      const refs = e.references ? (Array.isArray(e.references) ? e.references : [e.references]) : [];
      const deQuem = e.from?.value[0];

      return {
        uid,
        de: e.from?.text ?? "(sem remetente)",
        para,
        assunto: e.subject ?? "(sem assunto)",
        data: (e.date ?? new Date()).toISOString(),
        lido: true,
        temAnexo: anexosReais.length > 0,
        alias: descobrirAlias({ to: para, cc, deliveredTo }),
        html: corpoParaExibir({
          html: e.html,
          text: e.text,
          anexos: e.attachments.map((a) => ({
            cid: a.cid,
            contentType: a.contentType,
            content: a.content,
          })),
        }),
        texto: e.text ?? "",
        anexos: e.attachments
          .map((a, indice) => ({ a, indice }))
          .filter(({ a }) => a.contentDisposition === "attachment")
          .map(({ a, indice }) => ({
            indice,
            nome: a.filename ?? `anexo-${indice + 1}`,
            tipo: a.contentType,
            tamanho: a.size,
          })),
        messageId: e.messageId,
        references: refs,
        responderPara: e.replyTo?.value[0]?.address ?? deQuem?.address ?? "",
      };
    } finally {
      lock.release();
    }
  });
}

export async function baixarAnexo(
  pasta: Pasta,
  uid: number,
  indice: number,
): Promise<{ nome: string; base64: string } | null> {
  return comCaixa(async (c) => {
    const lock = await c.getMailboxLock(await caminho(c, pasta));
    try {
      const baixado = await c.download(String(uid), undefined, { uid: true });
      if (!baixado) return null;
      const e = await simpleParser(baixado.content);
      const a = e.attachments[indice];
      if (!a || a.size > LIMITE_ANEXO) return null;
      return { nome: a.filename ?? `anexo-${indice + 1}`, base64: a.content.toString("base64") };
    } finally {
      lock.release();
    }
  });
}

/**
 * Cópia em Enviados.
 *
 * Envio por SMTP externo não aparece sozinho nos Enviados da Hostinger; sem
 * isto, a resposta dada pelo painel não existiria no webmail nem no celular.
 */
export async function gravarEmEnviados(bruto: Buffer): Promise<void> {
  await comCaixa(async (c) => {
    await c.append(await caminho(c, "enviados"), bruto, ["\\Seen"]);
  });
}
```

- [ ] **Step 2: Escrever `mail-smtp.server.ts`**

```ts
// src/lib/api/mail-smtp.server.ts
import process from "node:process";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import { ROTULO, type Endereco } from "@/lib/mail/enderecos";

/**
 * Envio pela Hostinger.
 *
 * A mensagem é montada uma vez, crua, e a mesma cópia vai para o SMTP e para
 * a pasta Enviados — assim o que ficou registrado é exatamente o que saiu.
 * O login é sempre o do contato@; o alias só muda o `From`, o que a Hostinger
 * permite para aliases da própria caixa.
 */
export async function montarEEnviar(o: {
  de: Endereco;
  para: string[];
  assunto: string;
  texto: string;
  inReplyTo?: string;
  references?: string[];
}): Promise<{ bruto: Buffer; messageId: string }> {
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASSWORD;
  if (!user || !pass) throw new Error("MAIL_USER ou MAIL_PASSWORD ausente");

  const nome = o.de === "contato@atoregulariza.com.br" || o.de === "suporte@atoregulariza.com.br"
    ? "Ato Regulariza"
    : `${ROTULO[o.de]} · Ato Regulariza`;

  const composer = new MailComposer({
    from: { name: nome, address: o.de },
    to: o.para,
    subject: o.assunto,
    text: o.texto,
    inReplyTo: o.inReplyTo,
    references: o.references,
  });
  const no = composer.compile();
  const bruto = await no.build();
  const messageId = no.messageId();

  const transporte = nodemailer.createTransport({
    host: "smtp.hostinger.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  await transporte.sendMail({ envelope: { from: o.de, to: o.para }, raw: bruto });

  return { bruto, messageId };
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "mail-(imap|smtp)"`
Expected: sem saída. Se `imapflow` reclamar do tipo de `search` (pode devolver `false`), manter o `|| []` e ajustar o cast para `(await c.search(busca, { uid: true })) as number[] | false`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api/mail-imap.server.ts src/lib/api/mail-smtp.server.ts
git commit -m "feat(mail): leitura por IMAP e envio por SMTP da Hostinger"
```

---

### Task 8: Server functions

**Files:**
- Create: `src/lib/api/mail.functions.ts`

**Interfaces:**
- Consumes: tudo das Tasks 1–7
- Produces: `listarEmails`, `abrirEmail`, `baixarAnexoEmail`, `enviarEmailDaCaixa` — chamadas do cliente como `fn({ data, headers: await cabecalhoAuth() })`

- [ ] **Step 1: Escrever**

```ts
// src/lib/api/mail.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { exigirAdmin } from "@/lib/api/exigir-admin.server";
import { avisarErro } from "@/lib/api/avisar-erro.server";
import { listar, abrir, baixarAnexo, gravarEmEnviados } from "@/lib/api/mail-imap.server";
import { montarEEnviar } from "@/lib/api/mail-smtp.server";
import { schemaListar, schemaAbrir, schemaAnexo, schemaEnviar } from "@/lib/mail/validacao";
import { cabecalhosDeResposta } from "@/lib/mail/resposta";

/**
 * A caixa de e-mail do painel.
 *
 * `exigirAdmin` é sempre a primeira linha: nenhuma conexão com a Hostinger é
 * aberta antes de saber que quem pediu é admin. O que der errado depois vira
 * mensagem genérica para a tela e detalhe no sino — o detalhe pode conter
 * endereço de servidor e trecho de resposta do IMAP, que não é da conta do
 * navegador.
 */

const ENVIOS_POR_HORA = 30;

async function protegido<T>(origem: string, fn: () => Promise<T>, mensagem: string): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[mail] ${origem}`, (e as Error).message);
    await avisarErro(`caixa de e-mail: ${origem}`, e);
    throw new Error(mensagem);
  }
}

export const listarEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(schemaListar)
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId);
    return protegido(
      "listar",
      () => listar(data.pasta, data.pagina, data.alias),
      "Não foi possível abrir a caixa agora.",
    );
  });

export const abrirEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(schemaAbrir)
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId);
    const e = await protegido(
      "abrir",
      () => abrir(data.pasta, data.uid),
      "Não foi possível abrir este e-mail.",
    );
    if (!e) throw new Error("E-mail não encontrado.");
    return e;
  });

export const baixarAnexoEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(schemaAnexo)
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId);
    const a = await protegido(
      "anexo",
      () => baixarAnexo(data.pasta, data.uid, data.indice),
      "Não foi possível baixar o anexo.",
    );
    if (!a) throw new Error("Anexo não encontrado ou maior que 15 MB.");
    return a;
  });

export const enviarEmailDaCaixa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(schemaEnviar)
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId);

    const umaHoraAtras = new Date(Date.now() - 3_600_000).toISOString();
    const { count } = await supabaseAdmin
      .from("mail_envios")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("enviado_em", umaHoraAtras);
    if ((count ?? 0) >= ENVIOS_POR_HORA) {
      throw new Error("Limite de 30 envios por hora atingido. Tente mais tarde.");
    }

    // Os cabeçalhos da conversa vêm do e-mail original, lido no servidor —
    // nunca do navegador, que poderia forjar um Message-ID qualquer.
    let conversa: { inReplyTo?: string; references?: string[] } = {};
    if (data.respondendo) {
      const original = await protegido(
        "abrir original",
        () => abrir(data.respondendo!.pasta, data.respondendo!.uid),
        "Não foi possível abrir o e-mail respondido.",
      );
      if (original) conversa = cabecalhosDeResposta(original);
    }

    const { bruto } = await protegido(
      "enviar",
      () => montarEEnviar({ ...data, ...conversa }),
      "O e-mail não foi enviado. Tente de novo.",
    );

    // Daqui em diante o e-mail já saiu: falha em registrar não pode dizer à
    // tela que o envio falhou, senão alguém reenvia e o cliente recebe dois.
    await gravarEmEnviados(bruto).catch((e) => avisarErro("caixa de e-mail: gravar enviado", e));
    const { error } = await supabaseAdmin.from("mail_envios").insert({
      user_id: context.userId,
      de: data.de,
      para: data.para,
      assunto: data.assunto,
      respondendo_message_id: conversa.inReplyTo ?? null,
    });
    if (error) await avisarErro("caixa de e-mail: registrar envio", error.message);

    return { ok: true as const };
  });
```

- [ ] **Step 2: Typecheck e testes**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "mail"` → sem saída.
Run: `npx vitest run` → tudo passa.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/mail.functions.ts
git commit -m "feat(mail): server functions da caixa, so para admin"
```

---

### Task 9: Tela, rota curta, menu e robots

**Files:**
- Create: `src/routes/admin/mail.tsx`
- Create: `src/components/admin/mail/ListaEmails.tsx`
- Create: `src/components/admin/mail/LeitorEmail.tsx`
- Create: `src/components/admin/mail/EditorEmail.tsx`
- Create: `src/routes/mail.tsx`
- Modify: `src/components/admin/AdminSidebar.tsx` (`mainItems`, após Leads)
- Modify: `public/robots.txt` (após `Disallow: /admin`)

**Interfaces:**
- Consumes: server functions (Task 8), `ResumoEmail`, `EmailAberto` (Task 7), `ENDERECOS`, `ROTULO`, `Endereco` (Task 1), `Pasta` (Task 4), `assuntoDeResposta`, `citar` (Task 2), `cabecalhoAuth` de `@/integrations/supabase/auth-headers`

- [ ] **Step 1: Rota curta `/mail`**

```tsx
// src/routes/mail.tsx
import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Endereço curto da caixa de e-mail. Só redireciona: a tela mora dentro do
 * admin, que já barra quem não é admin.
 */
export const Route = createFileRoute("/mail")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/mail" });
  },
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
});
```

- [ ] **Step 2: Lista**

```tsx
// src/components/admin/mail/ListaEmails.tsx
import { Paperclip } from "lucide-react";
import type { ResumoEmail } from "@/lib/api/mail-imap.server";
import { ROTULO } from "@/lib/mail/enderecos";

export function ListaEmails({
  itens,
  selecionado,
  onAbrir,
}: {
  itens: ResumoEmail[];
  selecionado: number | null;
  onAbrir: (uid: number) => void;
}) {
  if (itens.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhum e-mail aqui.</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {itens.map((m) => (
        <li key={m.uid}>
          <button
            type="button"
            onClick={() => onAbrir(m.uid)}
            className={`w-full px-4 py-3 text-left hover:bg-surface ${
              selecionado === m.uid ? "bg-surface" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`truncate text-sm ${m.lido ? "" : "font-semibold"}`}>{m.de}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {new Date(m.data).toLocaleDateString("pt-BR")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`truncate text-sm ${m.lido ? "text-muted-foreground" : ""}`}>
                {m.assunto}
              </span>
              {m.temAnexo && <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />}
            </div>
            <span className="text-[11px] text-muted-foreground">para {ROTULO[m.alias]}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Leitor**

```tsx
// src/components/admin/mail/LeitorEmail.tsx
import { Download, Reply } from "lucide-react";
import { toast } from "sonner";
import type { EmailAberto } from "@/lib/api/mail-imap.server";
import type { Pasta } from "@/lib/mail/validacao";
import { baixarAnexoEmail } from "@/lib/api/mail.functions";
import { cabecalhoAuth } from "@/integrations/supabase/auth-headers";

/**
 * O e-mail aberto.
 *
 * O corpo vai num iframe sem scripts e sem mesma origem: mesmo que algo
 * escape da limpeza do servidor, não roda e não alcança a sessão do admin.
 */
export function LeitorEmail({
  email,
  pasta,
  onResponder,
}: {
  email: EmailAberto;
  pasta: Pasta;
  onResponder: () => void;
}) {
  async function baixar(indice: number) {
    try {
      const a = await baixarAnexoEmail({
        data: { pasta, uid: email.uid, indice },
        headers: await cabecalhoAuth(),
      });
      const bytes = Uint8Array.from(atob(a.base64), (c) => c.charCodeAt(0));
      // octet-stream: o navegador baixa, nunca abre o anexo na página.
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = a.nome;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <article className="flex h-full flex-col">
      <header className="border-b border-border p-4">
        <h2 className="text-lg font-semibold">{email.assunto}</h2>
        <p className="text-sm">{email.de}</p>
        <p className="text-xs text-muted-foreground">
          para {email.para.join(", ")} · {new Date(email.data).toLocaleString("pt-BR")}
        </p>
        {email.anexos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {email.anexos.map((a) => (
              <button
                key={a.indice}
                type="button"
                onClick={() => baixar(a.indice)}
                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-surface"
              >
                <Download className="h-3 w-3" /> {a.nome} ({Math.ceil(a.tamanho / 1024)} KB)
              </button>
            ))}
          </div>
        )}
        {pasta === "entrada" && (
          <button
            type="button"
            onClick={onResponder}
            className="mt-3 inline-flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          >
            <Reply className="h-4 w-4" /> Responder
          </button>
        )}
      </header>
      <iframe
        title="Conteúdo do e-mail"
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        srcDoc={email.html}
        className="min-h-[400px] w-full flex-1 bg-white"
      />
    </article>
  );
}
```

- [ ] **Step 4: Editor**

```tsx
// src/components/admin/mail/EditorEmail.tsx
import { useState } from "react";
import { toast } from "sonner";
import { ENDERECOS, ROTULO, type Endereco } from "@/lib/mail/enderecos";
import { schemaEnviar } from "@/lib/mail/validacao";
import { enviarEmailDaCaixa } from "@/lib/api/mail.functions";
import { cabecalhoAuth } from "@/integrations/supabase/auth-headers";
import type { Pasta } from "@/lib/mail/validacao";

export type Rascunho = {
  de: Endereco;
  para: string;
  assunto: string;
  texto: string;
  respondendo?: { pasta: Pasta; uid: number };
};

/** Escrever ou responder. Texto simples: formatação e anexo ficam para depois. */
export function EditorEmail({
  inicial,
  onFechar,
  onEnviado,
}: {
  inicial: Rascunho;
  onFechar: () => void;
  onEnviado: () => void;
}) {
  const [r, setR] = useState(inicial);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    const entrada = {
      de: r.de,
      para: r.para.split(/[,;\s]+/).filter(Boolean),
      assunto: r.assunto,
      texto: r.texto,
      respondendo: r.respondendo,
    };
    // Mesma validação do servidor, para avisar antes de gastar a ida.
    const v = schemaEnviar.safeParse(entrada);
    if (!v.success) {
      toast.error("Confira destinatário, assunto e mensagem.");
      return;
    }
    setEnviando(true);
    try {
      await enviarEmailDaCaixa({ data: v.data, headers: await cabecalhoAuth() });
      toast.success("E-mail enviado.");
      onEnviado();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const campo = "w-full rounded border border-border bg-background px-3 py-2 text-sm";
  return (
    <div className="space-y-2 border-t border-border p-4">
      <select
        className={campo}
        value={r.de}
        onChange={(e) => setR({ ...r, de: e.target.value as Endereco })}
      >
        {ENDERECOS.map((e) => (
          <option key={e} value={e}>
            {ROTULO[e]} — {e}
          </option>
        ))}
      </select>
      <input
        className={campo}
        placeholder="Para (separe vários por vírgula)"
        value={r.para}
        onChange={(e) => setR({ ...r, para: e.target.value })}
      />
      <input
        className={campo}
        placeholder="Assunto"
        maxLength={200}
        value={r.assunto}
        onChange={(e) => setR({ ...r, assunto: e.target.value })}
      />
      <textarea
        className={`${campo} min-h-[200px]`}
        maxLength={20_000}
        value={r.texto}
        onChange={(e) => setR({ ...r, texto: e.target.value })}
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onFechar} className="px-3 py-1.5 text-sm">
          Descartar
        </button>
        <button
          type="button"
          disabled={enviando}
          onClick={enviar}
          className="rounded bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          {enviando ? "Enviando…" : "Enviar"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Página**

```tsx
// src/routes/admin/mail.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, PenSquare, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { listarEmails, abrirEmail } from "@/lib/api/mail.functions";
import { cabecalhoAuth } from "@/integrations/supabase/auth-headers";
import type { ResumoEmail, EmailAberto } from "@/lib/api/mail-imap.server";
import { ENDERECOS, ROTULO, PADRAO, type Endereco } from "@/lib/mail/enderecos";
import type { Pasta } from "@/lib/mail/validacao";
import { assuntoDeResposta, citar } from "@/lib/mail/resposta";
import { ListaEmails } from "@/components/admin/mail/ListaEmails";
import { LeitorEmail } from "@/components/admin/mail/LeitorEmail";
import { EditorEmail, type Rascunho } from "@/components/admin/mail/EditorEmail";

export const Route = createFileRoute("/admin/mail")({
  head: () => ({
    meta: [
      { title: "E-mail — Ato Regulariza" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MailPage,
});

function MailPage() {
  const [pasta, setPasta] = useState<Pasta>("entrada");
  const [alias, setAlias] = useState<Endereco | undefined>();
  const [pagina, setPagina] = useState(0);
  const [itens, setItens] = useState<ResumoEmail[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [aberto, setAberto] = useState<EmailAberto | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await listarEmails({
        data: { pasta, pagina, alias },
        headers: await cabecalhoAuth(),
      });
      setItens(r.itens);
      setTotal(r.total);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }, [pasta, pagina, alias]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function abrir(uid: number) {
    setRascunho(null);
    try {
      const e = await abrirEmail({ data: { pasta, uid }, headers: await cabecalhoAuth() });
      setAberto(e);
      setItens((xs) => xs.map((x) => (x.uid === uid ? { ...x, lido: true } : x)));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function responder() {
    if (!aberto) return;
    setRascunho({
      de: aberto.alias,
      para: aberto.responderPara,
      assunto: assuntoDeResposta(aberto.assunto),
      texto: citar({ de: aberto.de, data: new Date(aberto.data), texto: aberto.texto }),
      respondendo: { pasta, uid: aberto.uid },
    });
  }

  const aba = (p: Pasta, rotulo: string) => (
    <button
      type="button"
      onClick={() => {
        setPasta(p);
        setPagina(0);
        setAberto(null);
      }}
      className={`px-3 py-1.5 text-sm ${pasta === p ? "border-b-2 border-primary font-medium" : ""}`}
    >
      {rotulo}
    </button>
  );

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <h1 className="mr-4 text-lg font-semibold">E-mail</h1>
        {aba("entrada", "Entrada")}
        {aba("enviados", "Enviados")}
        <select
          className="ml-2 rounded border border-border bg-background px-2 py-1 text-sm"
          value={alias ?? ""}
          onChange={(e) => {
            setAlias((e.target.value || undefined) as Endereco | undefined);
            setPagina(0);
          }}
        >
          <option value="">Todos</option>
          {ENDERECOS.map((e) => (
            <option key={e} value={e}>
              {ROTULO[e]}
            </option>
          ))}
        </select>
        <button type="button" onClick={carregar} aria-label="Atualizar" className="p-1.5">
          <RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
        </button>
        <button
          type="button"
          onClick={() => {
            setAberto(null);
            setRascunho({ de: alias ?? PADRAO, para: "", assunto: "", texto: "" });
          }}
          className="ml-auto inline-flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
        >
          <PenSquare className="h-4 w-4" /> Escrever
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* No celular, lista e leitura se alternam. */}
        <aside
          className={`w-full overflow-y-auto border-r border-border md:w-96 ${
            aberto || rascunho ? "hidden md:block" : ""
          }`}
        >
          <ListaEmails itens={itens} selecionado={aberto?.uid ?? null} onAbrir={abrir} />
          {total > 50 && (
            <div className="flex justify-between p-3 text-sm">
              <button type="button" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>
                ← Mais novos
              </button>
              <button
                type="button"
                disabled={(pagina + 1) * 50 >= total}
                onClick={() => setPagina(pagina + 1)}
              >
                Mais antigos →
              </button>
            </div>
          )}
        </aside>

        <section
          className={`min-w-0 flex-1 overflow-y-auto ${aberto || rascunho ? "" : "hidden md:block"}`}
        >
          {(aberto || rascunho) && (
            <button
              type="button"
              onClick={() => {
                setAberto(null);
                setRascunho(null);
              }}
              className="flex items-center gap-1 p-3 text-sm md:hidden"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
          )}
          {aberto && <LeitorEmail email={aberto} pasta={pasta} onResponder={responder} />}
          {rascunho && (
            <EditorEmail
              key={rascunho.respondendo?.uid ?? "novo"}
              inicial={rascunho}
              onFechar={() => setRascunho(null)}
              onEnviado={() => {
                setRascunho(null);
                void carregar();
              }}
            />
          )}
          {!aberto && !rascunho && (
            <p className="p-6 text-sm text-muted-foreground">Escolha um e-mail na lista.</p>
          )}
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Menu e robots**

Em `src/components/admin/AdminSidebar.tsx`, importar `Mail` de `lucide-react` e acrescentar em `mainItems`, logo após Leads:

```ts
  { to: "/admin/mail", label: "E-mail", icon: Mail },
```

Em `public/robots.txt`, logo após `Disallow: /admin`:

```
Disallow: /mail
```

- [ ] **Step 7: Verificar que os tipos de servidor não vazam para o bundle do cliente**

Os componentes importam `ResumoEmail` e `EmailAberto` de `mail-imap.server.ts` só como `import type`, que some na compilação. Conferir que todos os imports desses tipos usam `import type`:

Run: `grep -rn "mail-imap.server" src/routes src/components`
Expected: toda linha contém `import type`.

- [ ] **Step 8: Gerar a árvore de rotas, typecheck, lint e testes**

Run: `npm run build`
Expected: build conclui (gera `routeTree.gen.ts` com `/admin/mail` e `/mail`). Procurar no bundle do cliente se algo do servidor vazou: `grep -rl "imap.hostinger.com\|MAIL_PASSWORD" dist/client .output/public 2>/dev/null` → sem saída.
Run: `npx tsc --noEmit -p . 2>&1 | grep -E "^src" | cut -d'(' -f1 | sort -u` → só os 4 arquivos antigos.
Run: `npx vitest run` → tudo passa.

- [ ] **Step 9: Commit**

```bash
git add src/routes/admin/mail.tsx src/routes/mail.tsx src/components/admin/mail src/components/admin/AdminSidebar.tsx public/robots.txt src/routeTree.gen.ts
git commit -m "feat(mail): tela da caixa de e-mail no admin"
```

---

### Task 10: Configuração, publicação e teste de ponta a ponta

**Files:** nenhum arquivo de código.

- [ ] **Step 1: Usuário cadastra as variáveis na Vercel**

Passo a passo para o usuário: Vercel › projeto **atto-regulariza** › Settings › Environment Variables › Add: `MAIL_USER` = `contato@atoregulariza.com.br`, `MAIL_PASSWORD` = senha do contato@ (digitada pelo usuário, nunca no chat), ambiente Production, marcar **Sensitive**. Esperar confirmação.

- [ ] **Step 2: Push e deploy**

Com autorização do usuário: `git push origin main`. Esperar o deploy ficar Ready.

- [ ] **Step 3: Verificar segurança em produção**

- Aba anônima, sem login: `https://www.atoregulariza.com.br/mail` → termina em `/entrar`.
- Logado como cliente (conta de teste do usuário): `/admin/mail` → redireciona para `/dashboard`.
- Chamada direta da server function sem token (no console de uma aba anônima, `fetch` no endpoint da função `listarEmails` visto em `read_network_requests` numa sessão admin) → erro `Unauthorized`, nenhum e-mail.

- [ ] **Step 4: Teste funcional com o usuário**

1. Abrir `/mail` logado como admin → lista carrega em até ~3 s.
2. Do Gmail pessoal, mandar e-mail para `tais@` com uma imagem colada e um PDF anexo → aparece com "para Taís", imagem embutida visível, PDF baixa.
3. Responder → no Gmail chega de "Taís · Ato Regulariza <tais@…>", agrupado na mesma conversa.
4. A resposta aparece em Enviados no `/mail` **e** no webmail da Hostinger.
5. Escrever e-mail novo como `suporte@` → chega.
6. Verificar o log da Vercel: nenhuma linha com senha ou diálogo IMAP.

- [ ] **Step 5: Se o envio como alias for recusado pela Hostinger**

Sintoma: erro de SMTP `553` ou `sender address rejected`. Nesse caso, remover o alias recusado de `ENDERECOS`, rodar os testes e publicar de novo.

---

### Task 11: `suporte@` no rodapé

**Files:**
- Modify: o componente de rodapé público (localizar com `grep -rln "footer\|Footer" src/components/landing src/components | head`)
- Modify: `src/lib/brand.ts` (constante do e-mail público)

- [ ] **Step 1: Localizar o rodapé e onde ele lista contatos**

Run: `grep -rn "98447\|ATENDIMENTO_PHONE\|mailto" src/components --include=*.tsx | head`

- [ ] **Step 2: Acrescentar a constante em `brand.ts`**

```ts
/** E-mail público de suporte. É alias da caixa contato@, lido em /admin/mail. */
export const SUPORTE_EMAIL = "suporte@atoregulariza.com.br";
```

- [ ] **Step 3: Mostrar no rodapé**

Ao lado do telefone já listado no rodapé, no mesmo estilo dos itens vizinhos:

```tsx
<a href={`mailto:${SUPORTE_EMAIL}`} className="hover:underline">
  {SUPORTE_EMAIL}
</a>
```

- [ ] **Step 4: Verificar no navegador**

`preview_start` do dev server, rolar até o rodapé, conferir o link `mailto:` com `read_page`.

- [ ] **Step 5: Commit e push (com autorização)**

```bash
git add src/lib/brand.ts <arquivo do rodapé>
git commit -m "feat(rodape): e-mail de suporte"
```

---

### Task 12: Documentação e memória

- [ ] **Step 1:** Criar nota no vault `C:\Users\Administrator\Desktop\App\Ozanchet\` sobre a caixa `/mail` (aliases, variáveis, onde fica o código, limites), com wikilinks para [[Contexto Ozanchet]].
- [ ] **Step 2:** Criar memória `project_caixa_email.md` e linha no `MEMORY.md`.
- [ ] **Step 3:** Lembrar o usuário de dar o papel `admin` a cada profissional depois que criarem conta com o alias (SQL no chat, com o e-mail de cada um).
