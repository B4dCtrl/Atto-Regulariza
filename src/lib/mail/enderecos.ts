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
