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

/**
 * Os endereços de uma pessoa, não de um setor.
 *
 * São os únicos que viram "caixa de alguém" no painel e os únicos a quem um
 * e-mail pode ser atribuído. contato@ e suporte@ são de todo mundo: o que
 * chega só por eles é "Geral".
 */
export const PESSOAIS = [
  "gabriel@atoregulariza.com.br",
  "tais@atoregulariza.com.br",
  "lauro@atoregulariza.com.br",
] as const satisfies readonly Endereco[];

export type Pessoal = (typeof PESSOAIS)[number];

export function ehPessoal(v: string): v is Pessoal {
  return (PESSOAIS as readonly string[]).includes(v);
}

export function ehEndereco(v: string): v is Endereco {
  return (ENDERECOS as readonly string[]).includes(v.trim().toLowerCase());
}

/**
 * Para qual dos nossos endereços o e-mail foi mandado.
 *
 * É o remetente padrão da resposta: quem escreveu para a Taís recebe a
 * resposta da Taís. `Delivered-To` cobre a cópia oculta, que não aparece em
 * To nem Cc. Alias pessoal ganha de `contato@` quando os dois aparecem — a
 * pessoa quis falar com alguém específico. Pela mesma razão, alias pessoal
 * ganha também de `suporte@`.
 */
// `Delivered-To` e cabeçalhos crus às vezes vêm como `<end@x.com>` ou
// `"Nome" <end@x.com>` em vez do endereço puro — sem isto, `ehEndereco`
// nunca bate e o e-mail cai em contato@ mesmo quando veio por um alias.
function soEndereco(v: string): string {
  const m = /<([^>]+)>/.exec(v);
  return (m ? m[1] : v).trim().toLowerCase();
}

export function descobrirAlias(c: {
  to?: string[];
  cc?: string[];
  deliveredTo?: string[];
}): Endereco {
  const vistos = [...(c.to ?? []), ...(c.cc ?? []), ...(c.deliveredTo ?? [])]
    .map(soEndereco)
    .filter(ehEndereco);
  // Pessoal antes de suporte@, suporte@ antes de contato@. Sem a primeira
  // regra, "To: suporte@, Cc: tais@" caía em suporte@ e o e-mail ia para o
  // "Geral" em vez da caixa da Taís — a mesma regra das visões da caixa.
  return (
    vistos.find(ehPessoal) ??
    vistos.find((e) => e !== PADRAO) ??
    (vistos[0] as Endereco | undefined) ??
    PADRAO
  );
}
