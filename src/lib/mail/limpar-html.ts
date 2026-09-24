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
 *
 * "Mostrar imagens" é opcional e por e-mail: o SERVIDOR baixa as externas
 * (ver `mail-imagens.server.ts`) e elas chegam aqui em `externas`, já como
 * bytes, para virar `data:` também. Quem fica sabendo da abertura é só o
 * nosso servidor, nunca o navegador do admin — e a CSP não precisa mudar.
 */

export type AnexoEmbutido = { cid?: string; contentType: string; content: Buffer };
export type ImagemBaixada = { contentType: string; content: Buffer };

// Nunca SVG: é documento com script, não imagem. Só os formatos raster que
// o navegador mostra sem interpretar nada.
const TIPO_EXTERNA = /^image\/(png|jpeg|gif|webp)$/i;
// 20 já cobre qualquer newsletter comum; acima disso o e-mail é um mosaico de
// pixels de rastreio e baixar tudo só gastaria o tempo da função serverless.
const MAX_EXTERNAS = 20;

const ESTILO =
  "<style>body{font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#1f2937;margin:16px;word-wrap:break-word}img{max-width:100%;height:auto}pre{white-space:pre-wrap;font-family:inherit;margin:0}</style>";

function escapar(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Um e-mail com uma imagem inline de poucos MB e milhares de `<img src="cid:x">`
// repetidos (HTML em si pode ficar pequeno) explodiria para dezenas de GB se
// cada referência virasse uma cópia base64 completa — derrubando a função que
// serve o painel assim que um admin abrir o e-mail. Por isso há um teto para o
// total de base64 embutido no documento inteiro; passado o teto, as próximas
// referências ficam sem `src` (mesmo que fossem embutíveis).
// A resposta de `abrirEmail` inteira (este HTML + o resto do JSON) precisa
// caber no teto de 4,5 MB de resposta de função serverless da Vercel —
// por isso o teto de base64 embutido é bem menor que isso.
export const LIMITE_EMBUTIDO_BASE64 = 2.5 * 1024 * 1024; // 2,5 MB de texto base64, total no documento

// O teto de imagens sozinho não basta: o próprio HTML limpo pode ter MBs (a
// mensagem vai até 25 MB) e `texto` repete o conteúdo na mesma resposta. Por
// isso `abrir` pesa o corpo SEM imagens e:
// - acima de `LIMITE_CORPO`, nem mostra (aviso para abrir no webmail);
// - abaixo, dá às imagens só o que sobra até `LIMITE_RESPOSTA`.
// Os 0,5 MB entre `LIMITE_RESPOSTA` e os 4,5 MB da Vercel ficam para o resto
// do JSON (cabeçalhos, lista de anexos).
export const LIMITE_CORPO = 3.5 * 1024 * 1024;
export const LIMITE_RESPOSTA = 4 * 1024 * 1024;

/**
 * Quanto uma string pesa depois de serializada na resposta da server function
 * (seroval/JSON), por cima: bytes UTF-8 mais o custo dos escapes — `<` vira
 * `\x3C`, aspas/barra/quebra de linha ganham `\`, controle vira `\u00XX`.
 */
export function pesoNaResposta(s: string): number {
  let extra = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0x3c || c === 0x2028 || c === 0x2029) extra += 3;
    else if (c === 0x22 || c === 0x5c || c === 0x0a || c === 0x0d || c === 0x09) extra += 1;
    else if (c === 0x08 || c === 0x0c) extra += 1;
    else if (c < 0x20) extra += 5;
  }
  return Buffer.byteLength(s, "utf8") + extra;
}

/** Orçamento de `data:` que ainda cabe na resposta, dado o peso do corpo sem imagens. */
export function orcamentoDeImagens(pesoCorpo: number): number {
  return Math.max(0, Math.min(LIMITE_EMBUTIDO_BASE64, LIMITE_RESPOSTA - pesoCorpo));
}

// Um só orçamento por documento, dividido entre imagens `cid:` e externas.
// Conta a URI `data:` inteira (prefixo incluso), que é o quanto o HTML cresce
// em relação à versão sem imagens — é essa a conta que `abrir` precisa.
type Orcamento = { usado: number; limite: number };

function cabe(orcamento: Orcamento, tamanho: number): boolean {
  if (orcamento.usado + tamanho > orcamento.limite) return false;
  orcamento.usado += tamanho;
  return true;
}

function trocarCid(html: string, anexos: AnexoEmbutido[], orcamento: Orcamento): string {
  const cacheBase64 = new Map<string, string>();
  return html.replace(/\bsrc\s*=\s*(["'])cid:([^"']+)\1/gi, (_m, aspas: string, cid: string) => {
    const a = anexos.find((x) => x.cid === cid);
    if (!a || !a.contentType.startsWith("image/")) return `src=${aspas}${aspas}`;

    let b64 = cacheBase64.get(cid);
    if (b64 === undefined) {
      b64 = a.content.toString("base64");
      cacheBase64.set(cid, b64);
    }

    const uri = `data:${a.contentType};base64,${b64}`;
    if (!cabe(orcamento, uri.length)) return `src=${aspas}${aspas}`;
    return `src=${aspas}${uri}${aspas}`;
  });
}

const COR = [/^[a-zA-Z]+$/, /^#[0-9a-fA-F]{3,8}$/, /^rgba?\([\d\s,.%]+\)$/];
const MEDIDA = /^-?\d+(\.\d+)?(px|em|rem|%|pt)?$/;
const MEDIDA_OU_AUTO = [MEDIDA, /^(auto|normal|none)$/];
const ATE_QUATRO_MEDIDAS = [/^((-?\d+(\.\d+)?(px|em|rem|%|pt)?|auto)\s*){1,4}$/];
const BORDA = [/^[\d\s.a-zA-Z#%-]+$/];

const ESTILOS_PERMITIDOS: Record<string, RegExp[]> = {
  color: COR,
  background: COR,
  "background-color": COR,
  "text-align": [/^(left|right|center|justify)$/],
  "vertical-align": [/^(top|middle|bottom|baseline)$/],
  "font-size": [MEDIDA],
  "font-weight": [/^(normal|bold|\d{3})$/],
  "font-style": [/^(normal|italic)$/],
  "font-family": [/^[\w\s,'"-]+$/],
  "line-height": MEDIDA_OU_AUTO,
  "letter-spacing": MEDIDA_OU_AUTO,
  "text-decoration": [/^(none|underline|line-through)$/],
  "text-transform": [/^(none|uppercase|lowercase|capitalize)$/],
  "white-space": [/^(normal|nowrap|pre-wrap|pre-line)$/],
  "word-break": [/^(normal|break-all|break-word)$/],
  "overflow-wrap": [/^(normal|break-word|anywhere)$/],
  display: [/^(none|block|inline|inline-block|table|table-row|table-cell)$/],
  width: MEDIDA_OU_AUTO,
  "max-width": MEDIDA_OU_AUTO,
  "min-width": MEDIDA_OU_AUTO,
  height: MEDIDA_OU_AUTO,
  "max-height": MEDIDA_OU_AUTO,
  padding: ATE_QUATRO_MEDIDAS,
  "padding-top": ATE_QUATRO_MEDIDAS,
  "padding-right": ATE_QUATRO_MEDIDAS,
  "padding-bottom": ATE_QUATRO_MEDIDAS,
  "padding-left": ATE_QUATRO_MEDIDAS,
  margin: ATE_QUATRO_MEDIDAS,
  "margin-top": ATE_QUATRO_MEDIDAS,
  "margin-right": ATE_QUATRO_MEDIDAS,
  "margin-bottom": ATE_QUATRO_MEDIDAS,
  "margin-left": ATE_QUATRO_MEDIDAS,
  "border-radius": ATE_QUATRO_MEDIDAS,
  border: BORDA,
  "border-top": BORDA,
  "border-right": BORDA,
  "border-bottom": BORDA,
  "border-left": BORDA,
  "border-collapse": [/^(collapse|separate)$/],
};

/**
 * URLs das imagens remotas do e-mail, na ordem em que aparecem, sem repetição.
 *
 * Lê com o mesmo parser do `sanitizeHtml` de `corpoParaExibir`: assim a URL
 * listada aqui (entidades como `&amp;` já decodificadas) é exatamente a
 * chave que `corpoParaExibir` vai procurar em `externas`.
 */
export function extrairImagensExternas(html: string): string[] {
  const urls = new Set<string>();
  sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
    transformTags: {
      img: (tagName, attribs) => {
        const src = attribs.src ?? "";
        if (urls.size < MAX_EXTERNAS && /^https?:\/\//i.test(src.trim())) urls.add(src);
        return { tagName, attribs };
      },
    },
  });
  return [...urls];
}

type EntradaCorpo = {
  html?: string | false;
  text?: string;
  anexos: AnexoEmbutido[];
  /** Imagens remotas já baixadas pelo servidor, pela URL original do `src`. */
  externas?: Map<string, ImagemBaixada>;
  /**
   * Quanto o HTML pode crescer com imagens embutidas (`cid:` + externas),
   * nunca acima de `LIMITE_EMBUTIDO_BASE64`. `0` tira todas — é assim que
   * `abrir` mede o corpo antes de decidir o orçamento.
   */
  limiteEmbutido?: number;
};

export function corpoParaExibir(o: EntradaCorpo): string {
  return corpoParaExibirDetalhado(o).html;
}

/** Igual a `corpoParaExibir`, dizendo também quais externas entraram de fato. */
export function corpoParaExibirDetalhado(o: EntradaCorpo): {
  html: string;
  externasEmbutidas: Set<string>;
} {
  const externasEmbutidas = new Set<string>();
  if (!o.html) {
    return {
      html: `<!doctype html><meta charset="utf-8">${ESTILO}<pre>${escapar(o.text ?? "")}</pre>`,
      externasEmbutidas,
    };
  }

  const orcamento: Orcamento = {
    usado: 0,
    limite: Math.max(0, Math.min(o.limiteEmbutido ?? Infinity, LIMITE_EMBUTIDO_BASE64)),
  };
  const cacheExternas = new Map<string, string>();
  // Uma externa liberada vira `data:` se couber no orçamento; qualquer outra
  // (não baixada, SVG, tipo estranho, orçamento esgotado) continua sem src.
  function externaEmbutida(src: string): string {
    const img = o.externas?.get(src);
    if (!img || !TIPO_EXTERNA.test(img.contentType)) return "";
    let b64 = cacheExternas.get(src);
    if (b64 === undefined) {
      b64 = img.content.toString("base64");
      cacheExternas.set(src, b64);
    }
    const uri = `data:${img.contentType.toLowerCase()};base64,${b64}`;
    if (!cabe(orcamento, uri.length)) return "";
    externasEmbutidas.add(src);
    return uri;
  }

  const limpo = sanitizeHtml(trocarCid(o.html, o.anexos, orcamento), {
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
    // `style` é permitido (lista de atributos acima), mas o VALOR não é
    // filtrado por padrão pelo sanitize-html — `url(...)` viraria pixel de
    // rastreio/exfiltração e `expression(...)` era execução de script no IE
    // antigo. `allowedStyles` restringe a propriedades visuais, cada uma com
    // regex sem parêntese (exceto `rgb()` só com números), o que barra
    // `url(`/`expression(`. A lista cobre o que e-mail transacional usa de
    // fato: sem `background` abreviado, o botão do modelo do Supabase perdia o
    // fundo escuro e o texto branco sumia.
    allowedStyles: { "*": ESTILOS_PERMITIDOS },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
      img: (tagName, attribs) => {
        const src = attribs.src ?? "";
        const embutida = /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(src);
        return { tagName, attribs: { ...attribs, src: embutida ? src : externaEmbutida(src) } };
      },
    },
  });

  return { html: `<!doctype html><meta charset="utf-8">${ESTILO}${limpo}`, externasEmbutidas };
}
