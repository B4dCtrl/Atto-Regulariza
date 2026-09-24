import { caixaDoAdmin } from "@/lib/api/resumo-pessoal";
import { PADRAO, PESSOAIS, ROTULO, ehPessoal, type Endereco, type Pessoal } from "./enderecos";
import type { Pasta } from "./validacao";

/**
 * As "caixas" do painel: recortes da única caixa real, contato@.
 *
 * Tudo chega em contato@ (os outros endereços são aliases entregues nela),
 * então uma "caixa da Taís" é só um filtro. Não é sigilo — qualquer admin
 * troca de visão —, é organização: cada um abre o painel no que é seu.
 *
 * - Todos: a caixa inteira.
 * - Geral: o que não foi mandado a nenhuma pessoa (só contato@/suporte@).
 * - Uma por pessoa: o mandado ao alias dela MAIS o atribuído a ela.
 *
 * Em Enviados o critério é o remetente: a pessoa vê o que saiu do alias dela,
 * o Geral vê o que saiu de contato@/suporte@.
 *
 * Este arquivo é puro: a regra (`visoesDaMensagem`) e a busca IMAP que a
 * implementa (`buscaDaVisao`) ficam lado a lado e têm teste de equivalência.
 */

export const VISOES = ["todos", "geral", ...PESSOAIS] as const;
export type Visao = (typeof VISOES)[number];

export const ROTULO_VISAO: Record<Visao, string> = {
  todos: "Todos",
  geral: "Geral",
  "gabriel@atoregulariza.com.br": ROTULO["gabriel@atoregulariza.com.br"],
  "tais@atoregulariza.com.br": ROTULO["tais@atoregulariza.com.br"],
  "lauro@atoregulariza.com.br": ROTULO["lauro@atoregulariza.com.br"],
};

/** Os endereços de todo mundo: o que sai deles é "Geral" em Enviados. */
const SETORES: Endereco[] = [PADRAO, "suporte@atoregulariza.com.br"];

/**
 * Teto de atribuições que entram na busca IMAP de uma pessoa.
 *
 * Cada atribuição vira um `HEADER Message-ID <...>` dentro de um OR — a busca
 * inteira sai numa linha de comando só, e o Dovecot da Hostinger recusa linha
 * acima de 64 KB. 200 ids é o teto por contagem; como um Message-ID pode ter
 * até 250 bytes (`schemaMessageId`), 200 ids no pior caso dariam ~50 KB
 * sozinhos — por isso `LIMITE_BYTES_ATRIBUIDOS_NA_BUSCA` abaixo também corta
 * por tamanho somado, o que manda primeiro. As que ficam de fora saem da
 * visão da pessoa (continuam em "Todos", com a etiqueta) — ver o relatório.
 */
export const LIMITE_ATRIBUIDOS_NA_BUSCA = 200;

/**
 * Teto, em bytes, da soma dos Message-IDs que entram na busca — além do teto
 * por contagem acima. 40 KB deixa folga sob o limite de 64 KB do Dovecot
 * mesmo somando o resto da busca (alias, `OR`, `HEADER Message-ID` por id).
 * As mais recentes entram primeiro; a lista já chega ordenada por
 * `atribuido_em DESC` do banco.
 */
export const LIMITE_BYTES_ATRIBUIDOS_NA_BUSCA = 40_000;

/** Corta a lista de ids (mais recentes primeiro) pela contagem e pelo tamanho. */
function limitarAtribuidos(atribuidos: string[]): string[] {
  const porContagem = atribuidos.slice(0, LIMITE_ATRIBUIDOS_NA_BUSCA);
  const resultado: string[] = [];
  let bytes = 0;
  for (const id of porContagem) {
    bytes += Buffer.byteLength(id, "utf8");
    if (bytes > LIMITE_BYTES_ATRIBUIDOS_NA_BUSCA) break;
    resultado.push(id);
  }
  return resultado;
}

/**
 * O que o imapflow entende como busca — só as chaves que usamos. Chaves no
 * mesmo objeto são E; `or` é OU; `not` é NÃO.
 */
export type Busca = {
  all?: true;
  seen?: boolean;
  to?: string;
  cc?: string;
  from?: string;
  header?: Record<string, string>;
  or?: Busca[];
  not?: Busca;
};

function mandadoA(e: Endereco): Busca[] {
  return [{ to: e }, { cc: e }, { header: { "delivered-to": e } }];
}

/**
 * A busca IMAP de uma visão.
 *
 * Uma busca só, no servidor, devolve TODOS os UIDs da visão — por isso a
 * paginação continua exata (fatia sobre a lista inteira, como antes), sem
 * baixar envelope de mensagem que não vai para a tela.
 *
 * Nunca devolve `or: []`: o imapflow ignora OR vazio, e a busca viraria
 * "tudo" calada. Por isso as atribuições são somadas aos termos do alias, que
 * sempre existem.
 */
export function buscaDaVisao(pasta: Pasta, visao: Visao, atribuidos: string[] = []): Busca {
  if (visao === "todos") return { all: true };
  const porId = limitarAtribuidos(atribuidos).map(
    (id): Busca => ({ header: { "message-id": id } }),
  );

  if (pasta === "enviados") {
    if (visao === "geral") return { or: SETORES.map((e) => ({ from: e })) };
    return { or: [{ from: visao }, ...porId] };
  }

  // `Delivered-To: contato@` pode estar em TODA mensagem (é a caixa onde os
  // aliases entregam), então "Geral" não pode ser "mandado a contato@" — isso
  // pegaria o e-mail da Taís também. Geral é o que NÃO foi mandado a nenhuma
  // pessoa: a mesma precedência de `descobrirAlias`.
  if (visao === "geral") return { not: { or: PESSOAIS.flatMap(mandadoA) } };
  return { or: [...mandadoA(visao), ...porId] };
}

function soEndereco(v: string): string {
  const m = /<([^>]+)>/.exec(v);
  return (m ? m[1] : v).trim().toLowerCase();
}

/**
 * Em quais visões uma mensagem aparece. Referência da regra; a busca IMAP
 * acima é a implementação, e o teste confere que as duas concordam.
 */
export function visoesDaMensagem(
  pasta: Pasta,
  m: {
    to?: string[];
    cc?: string[];
    deliveredTo?: string[];
    from?: string[];
    atribuido?: Pessoal | null;
  },
): Visao[] {
  const visoes = new Set<Visao>(["todos"]);
  if (pasta === "enviados") {
    const de = (m.from ?? []).map(soEndereco);
    for (const p of PESSOAIS) if (de.includes(p)) visoes.add(p);
    if (de.some((e) => SETORES.includes(e as Endereco))) visoes.add("geral");
  } else {
    const destinos = [...(m.to ?? []), ...(m.cc ?? []), ...(m.deliveredTo ?? [])].map(soEndereco);
    const pessoas = PESSOAIS.filter((p) => destinos.includes(p));
    for (const p of pessoas) visoes.add(p);
    if (pessoas.length === 0) visoes.add("geral");
  }
  // Atribuir põe na caixa da pessoa sem tirar de onde já estava: um e-mail do
  // Geral atribuído à Taís continua no Geral, com a etiqueta "com Taís".
  if (m.atribuido) visoes.add(m.atribuido);
  return VISOES.filter((v) => visoes.has(v));
}

/**
 * Com que visão o painel abre para este login.
 *
 * Sai do e-mail do `auth.users`, lido no servidor — nunca do navegador. Quem
 * entra com o alias (tais@…) abre na própria caixa; o dono e qualquer outro
 * admin abrem em "Todos" (são admins: ver tudo não expõe nada a mais).
 */
export function visaoPadrao(email: string | null | undefined): Visao {
  const caixa = caixaDoAdmin(email);
  return caixa && ehPessoal(caixa) ? caixa : "todos";
}

/**
 * Qual visão o cartão "O que é seu" conta como não lidos.
 *
 * Alias pessoal conta a visão da pessoa (alias + atribuídos), igual à caixa
 * que ela abre. Um login contato@/suporte@ conta o Geral: contar "mandado a
 * contato@" pegaria a caixa inteira (ver `buscaDaVisao`). Nulo: não conta.
 */
export function visaoParaContar(caixa: Endereco | "inteira" | null): Visao | null {
  if (caixa === null) return null;
  if (caixa === "inteira") return "todos";
  return ehPessoal(caixa) ? caixa : "geral";
}
