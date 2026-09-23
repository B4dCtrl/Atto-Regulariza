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
    // `style` é permitido (attribute allowlist acima), mas o VALOR não é
    // filtrado por padrão pelo sanitize-html — `url(...)` viraria pixel de
    // rastreio/exfiltração e `expression(...)` era execução de script no IE
    // antigo. `allowedStyles` restringe a um conjunto fixo de propriedades
    // visuais inofensivas, cada uma com regex que rejeita `url(`/`expression(`.
    allowedStyles: {
      "*": {
        color: [/^[a-zA-Z]+$/, /^#[0-9a-fA-F]{3,8}$/, /^rgba?\([\d\s,.]+\)$/],
        "background-color": [/^[a-zA-Z]+$/, /^#[0-9a-fA-F]{3,8}$/, /^rgba?\([\d\s,.]+\)$/],
        "text-align": [/^(left|right|center|justify)$/],
        "font-size": [/^\d+(\.\d+)?(px|em|rem|%)$/],
        "font-weight": [/^(normal|bold|\d{3})$/],
        "font-style": [/^(normal|italic)$/],
        padding: [/^[\d\s.]+(px|em|rem|%)?$/],
        margin: [/^[\d\s.]+(px|em|rem|%)?$/],
        border: [/^[\d\s.a-zA-Z#]+$/],
      },
    },
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
