// src/lib/api/mail-imagens.server.ts
import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import { isIP, type LookupFunction } from "node:net";
import type { ImagemBaixada } from "@/lib/mail/limpar-html";

/**
 * "Mostrar imagens": o servidor baixa as imagens remotas de um e-mail.
 *
 * As URLs vêm do HTML de um e-mail — ou seja, de qualquer estranho. Sem
 * cuidado, isto vira SSRF: um `<img src="http://169.254.169.254/...">` faria
 * a nossa função buscar os metadados da nuvem, ou sondar a rede interna. Por
 * isso:
 *
 * - só http/https nas portas padrão, sem usuário/senha na URL;
 * - nome e IP passam por `urlPermitida`/`enderecoPermitido` (lista de faixas
 *   privadas/reservadas recusadas);
 * - a checagem do IP acontece DENTRO do `lookup` da própria conexão
 *   (`lookupSeguro`): o endereço validado é o mesmo em que o socket conecta.
 *   Validar antes e depois deixar o `fetch` resolver de novo abriria a porta
 *   para DNS rebinding (o 1º DNS responde público, o 2º responde 127.0.0.1);
 * - redirecionamento é seguido no máximo 3 vezes, e cada salto passa pelas
 *   mesmas duas barreiras (CDN de newsletter redireciona muito; recusar todo
 *   redirecionamento quebraria boa parte das imagens sem ganho de segurança,
 *   já que o salto é validado igual ao primeiro pedido);
 * - resposta tem teto de 1 MB contado enquanto chega (o Content-Length pode
 *   mentir), e só vale se o Content-Type E a assinatura dos bytes forem
 *   PNG/JPEG/GIF/WEBP;
 * - sem cookie, sem Referer, User-Agent neutro — o remetente não aprende nada
 *   sobre quem abriu além de "algum servidor da Vercel";
 * - qualquer falha só pula a imagem; nada é lançado para quem chamou.
 */

const MAX_IMAGENS = 20;
const LIMITE_POR_IMAGEM = 1024 * 1024; // 1 MB crus
// O que passa disto nem caberia no teto de base64 embutido de `limpar-html`
// (2,5 MB de base64 ≈ 1,9 MB crus); baixar mais só gastaria tempo e memória.
const LIMITE_TOTAL = 2 * 1024 * 1024;
const TEMPO_POR_IMAGEM = 5_000;
// Abaixo dos ~10 s da função: o IMAP ainda gasta 1–2 s antes daqui.
const TEMPO_TOTAL = 8_000;
const CONCORRENCIA = 4;
const MAX_REDIRECIONAMENTOS = 3;

const TIPOS_ACEITOS = new Set(["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"]);

// ---------------------------------------------------------------------------
// Barreiras puras (testadas em mail-imagens.test.ts)

function ipv4ParaNumero(ip: string): number | null {
  const partes = ip.split(".");
  if (partes.length !== 4) return null;
  let n = 0;
  for (const p of partes) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

// [início, bits do prefixo]
const FAIXAS_V4_RECUSADAS: [string, number][] = [
  ["0.0.0.0", 8], // "esta rede"
  ["10.0.0.0", 8], // privada
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local (metadados de nuvem: 169.254.169.254)
  ["172.16.0.0", 12], // privada
  ["192.0.0.0", 24], // atribuições do IETF
  ["192.0.2.0", 24], // documentação
  ["192.168.0.0", 16], // privada
  ["198.18.0.0", 15], // testes de desempenho
  ["198.51.100.0", 24], // documentação
  ["203.0.113.0", 24], // documentação
  ["224.0.0.0", 3], // multicast (224/4) + reservado (240/4) + broadcast
];

function ipv4Permitido(ip: string): boolean {
  const n = ipv4ParaNumero(ip);
  if (n === null) return false;
  return !FAIXAS_V4_RECUSADAS.some(([inicio, bits]) => {
    const base = ipv4ParaNumero(inicio)!;
    const tamanho = 2 ** (32 - bits);
    return n >= base && n < base + tamanho;
  });
}

/** IPv6 em 8 grupos de 16 bits; null se não for IPv6 válido. */
function ipv6ParaGrupos(ip: string): number[] | null {
  let s = ip.toLowerCase();
  // Final em IPv4 pontuado (::ffff:1.2.3.4) vira dois grupos hexa.
  const v4 = /^(.*:)(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (v4) {
    const n = ipv4ParaNumero(v4[2]);
    if (n === null) return null;
    s = `${v4[1]}${Math.floor(n / 65536).toString(16)}:${(n % 65536).toString(16)}`;
  }
  const metades = s.split("::");
  if (metades.length > 2) return null;
  const ler = (t: string) => (t === "" ? [] : t.split(":"));
  const esquerda = ler(metades[0]);
  const direita = metades.length === 2 ? ler(metades[1]) : [];
  const faltam = 8 - esquerda.length - direita.length;
  if (metades.length === 1 ? faltam !== 0 : faltam < 1) return null;
  const grupos = [
    ...esquerda,
    ...Array<string>(metades.length === 2 ? faltam : 0).fill("0"),
    ...direita,
  ];
  if (grupos.length !== 8 || grupos.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return grupos.map((g) => parseInt(g, 16));
}

function v4DosGrupos(a: number, b: number): string {
  return [a >> 8, a & 255, b >> 8, b & 255].join(".");
}

function ipv6Permitido(ip: string): boolean {
  // Zona (fe80::1%eth0) só existe em endereço de enlace local: nunca público.
  if (ip.includes("%")) return false;
  const g = ipv6ParaGrupos(ip);
  if (!g) return false;

  // ::ffff:a.b.c.d — IPv4 mapeado: vale a regra do IPv4 embutido.
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {
    return ipv4Permitido(v4DosGrupos(g[6], g[7]));
  }
  // 64:ff9b::/96 — NAT64 bem conhecido: idem, pelo IPv4 embutido.
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    return ipv4Permitido(v4DosGrupos(g[6], g[7]));
  }
  // 2002::/16 — 6to4: o IPv4 vai nos grupos 1 e 2.
  if (g[0] === 0x2002) return ipv4Permitido(v4DosGrupos(g[1], g[2]));

  // Fora de 2000::/3 (unicast global) nada é público: pega ::, ::1,
  // IPv4-compatível (::a.b.c.d), 100::/64, fc00::/7, fe80::/10, ff00::/8, e
  // o NAT64 de uso local 64:ff9b:1::/48.
  if (g[0] < 0x2000 || g[0] > 0x3fff) return false;
  // 2001:0::/32 Teredo (IPv4 embutido ofuscado) e 2001:db8::/32 documentação.
  if (g[0] === 0x2001 && (g[1] === 0 || g[1] === 0xdb8)) return false;
  return true;
}

/** O IP pode ser alvo de uma conexão de saída? Só endereço público. */
export function enderecoPermitido(ip: string): boolean {
  const semColchete = ip.replace(/^\[|\]$/g, "");
  const tipo = isIP(semColchete.split("%")[0]);
  if (tipo === 4) return ipv4Permitido(semColchete);
  if (tipo === 6) return ipv6Permitido(semColchete);
  return false;
}

/**
 * Todos os endereços que o DNS devolveu precisam ser públicos. Basta um
 * interno para recusar: não dá para saber qual deles o socket escolheria.
 */
export function enderecosResolvidosPermitidos(
  lista: { address: string; family: number }[],
): boolean {
  return lista.length > 0 && lista.every((e) => enderecoPermitido(e.address));
}

/**
 * Respeita a família que o socket pediu (`family: 4 | 6`, ou "IPv4"/"IPv6");
 * 0/ausente devolve todas.
 */
export function filtrarPorFamilia<T extends { family: number }>(
  lista: T[],
  familia?: number | string,
): T[] {
  const f = familia === "IPv4" ? 4 : familia === "IPv6" ? 6 : familia;
  return f === 4 || f === 6 ? lista.filter((e) => e.family === f) : lista;
}

function nomePermitido(host: string): boolean {
  // Nome sem ponto (intranet, localhost) só resolve em rede interna.
  if (!host.includes(".")) return false;
  return !/(^|\.)(localhost|local|internal|intranet|lan|home\.arpa|arpa)$/.test(host);
}

/**
 * A URL pode ser pedida? Recusa esquema, porta, credencial e nome/IP
 * internos. IP em forma estranha (decimal, hexa, octal, abreviado) já chega
 * aqui normalizado pelo parser de URL (`http://2130706433/` → `127.0.0.1`).
 */
export function urlPermitida(bruta: string): URL | null {
  let u: URL;
  try {
    u = new URL(bruta.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  // O parser zera `port` quando é a padrão do esquema: qualquer valor aqui é
  // porta fora do padrão (inclusive :443 em http e :80 em https).
  if (u.port !== "") return null;
  if (u.username || u.password) return null;
  const host = u.hostname
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")
    .toLowerCase();
  if (!host) return null;
  if (isIP(host)) return enderecoPermitido(host) ? u : null;
  return nomePermitido(host) ? u : null;
}

/** Tipo real pela assinatura dos bytes; null se não for PNG/JPEG/GIF/WEBP. */
export function tipoPelaAssinatura(b: Buffer): string | null {
  if (
    b.length >= 8 &&
    b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  const cabeca = b.subarray(0, 12).toString("latin1");
  if (cabeca.startsWith("GIF87a") || cabeca.startsWith("GIF89a")) return "image/gif";
  if (cabeca.startsWith("RIFF") && cabeca.slice(8, 12) === "WEBP") return "image/webp";
  return null;
}

// ---------------------------------------------------------------------------
// Rede

/**
 * Resolve, valida TODOS os endereços e só então entrega um deles ao socket.
 * Como é a própria conexão que chama isto, não existe segunda resolução que
 * um DNS malicioso pudesse trocar por um IP interno (DNS rebinding).
 */
const lookupSeguro: LookupFunction = (hostname, opcoes, callback) => {
  const host = hostname.replace(/\.$/, "").toLowerCase();
  if (!nomePermitido(host)) {
    callback(new Error("nome bloqueado"), "", 4);
    return;
  }
  dns.lookup(host, { all: true }, (erro, enderecos) => {
    if (erro) return callback(erro, "", 4);
    // Valida TODOS antes de filtrar: um nome que resolve para um interno em
    // qualquer família é recusado, mesmo que a família pedida seja outra.
    if (!enderecosResolvidosPermitidos(enderecos))
      return callback(new Error("endereço bloqueado"), "", 4);
    const daFamilia = filtrarPorFamilia(enderecos, opcoes.family);
    if (daFamilia.length === 0) return callback(new Error("sem endereço na família"), "", 4);
    // Com `autoSelectFamily` (padrão no Node 20+) o socket pede a lista toda.
    if (opcoes.all) {
      (callback as unknown as (e: null, l: dns.LookupAddress[]) => void)(null, daFamilia);
    } else {
      callback(null, daFamilia[0].address, daFamilia[0].family);
    }
  });
};

type Resposta = { redirecionar: string } | { imagem: ImagemBaixada } | null;

function pedir(u: URL, sinal: AbortSignal): Promise<Resposta> {
  return new Promise((resolve) => {
    let resolvido = false;
    const fim = (r: Resposta) => {
      if (!resolvido) {
        resolvido = true;
        resolve(r);
      }
    };
    const modulo = u.protocol === "https:" ? https : http;
    let req: http.ClientRequest;
    try {
      req = modulo.request(
        u,
        {
          method: "GET",
          // Sem agente compartilhado: nenhuma conexão reaproveitada de outro
          // pedido, cada uma passa pelo `lookupSeguro`.
          agent: false,
          lookup: lookupSeguro,
          signal: sinal,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; ImageFetcher/1.0)",
            Accept: "image/png,image/jpeg,image/gif,image/webp",
            // Sem compressão: o teto de 1 MB vale para os bytes que chegam.
            "Accept-Encoding": "identity",
          },
        },
        (res) => {
          const status = res.statusCode ?? 0;
          if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
            res.destroy();
            return fim({ redirecionar: res.headers.location });
          }
          const tipo = (res.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
          const declarado = Number(res.headers["content-length"] ?? 0);
          if (status !== 200 || !TIPOS_ACEITOS.has(tipo) || declarado > LIMITE_POR_IMAGEM) {
            res.destroy();
            return fim(null);
          }
          const pedacos: Buffer[] = [];
          let recebido = 0;
          res.on("data", (c: Buffer) => {
            recebido += c.length;
            if (recebido > LIMITE_POR_IMAGEM) {
              res.destroy();
              return fim(null);
            }
            pedacos.push(c);
          });
          res.on("end", () => {
            const corpo = Buffer.concat(pedacos);
            const real = tipoPelaAssinatura(corpo);
            fim(real ? { imagem: { contentType: real, content: corpo } } : null);
          });
          res.on("error", () => fim(null));
          res.on("close", () => fim(null));
        },
      );
    } catch {
      return fim(null);
    }
    req.on("error", () => fim(null));
    req.end();
  });
}

async function baixarUma(bruta: string, total: AbortSignal): Promise<ImagemBaixada | null> {
  const prazo = new AbortController();
  const relogio = setTimeout(() => prazo.abort(), TEMPO_POR_IMAGEM);
  const aoAcabarOTotal = () => prazo.abort();
  total.addEventListener("abort", aoAcabarOTotal);
  try {
    let u = urlPermitida(bruta);
    for (let salto = 0; u && salto <= MAX_REDIRECIONAMENTOS; salto++) {
      const r = await pedir(u, prazo.signal);
      if (!r) return null;
      if ("imagem" in r) return r.imagem;
      // Location relativa é resolvida contra a URL atual; o salto passa
      // pela mesma validação da URL original.
      let proxima: string;
      try {
        proxima = new URL(r.redirecionar, u).href;
      } catch {
        return null;
      }
      u = urlPermitida(proxima);
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(relogio);
    total.removeEventListener("abort", aoAcabarOTotal);
  }
}

/**
 * Baixa as imagens (no máximo 20, 4 por vez, 8 s no total) e devolve as que
 * deram certo, pela URL original. Nunca lança.
 */
export async function baixarImagens(urls: string[]): Promise<Map<string, ImagemBaixada>> {
  const resultado = new Map<string, ImagemBaixada>();
  const fila = [...new Set(urls)].slice(0, MAX_IMAGENS);
  const total = new AbortController();
  const relogio = setTimeout(() => total.abort(), TEMPO_TOTAL);
  let proxima = 0;
  let bytes = 0;

  async function trabalhador() {
    while (proxima < fila.length && !total.signal.aborted && bytes < LIMITE_TOTAL) {
      const url = fila[proxima++];
      const img = await baixarUma(url, total.signal);
      if (img && bytes + img.content.length <= LIMITE_TOTAL) {
        bytes += img.content.length;
        resultado.set(url, img);
      }
    }
  }

  try {
    await Promise.all(Array.from({ length: CONCORRENCIA }, trabalhador));
  } catch {
    // `baixarUma` já não lança; isto é só garantia de "nunca lança".
  } finally {
    clearTimeout(relogio);
  }
  return resultado;
}
