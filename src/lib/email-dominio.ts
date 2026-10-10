/**
 * O domínio de um e-mail, para conferir se ele existe antes de criar a conta.
 *
 * Lógica pura, separada da consulta ao DNS (que só roda no servidor), para
 * ser testada sem rede.
 */

/** "Maria@Gmail.com " → "gmail.com". Nulo quando não parece e-mail. */
export function dominioDoEmail(email: string): string | null {
  const limpo = email.trim().toLowerCase();
  const arroba = limpo.lastIndexOf("@");
  if (arroba < 1) return null;
  const dominio = limpo.slice(arroba + 1);
  // Precisa de um ponto e de algo dos dois lados dele: "gmail" sozinho não é domínio.
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(dominio)) return null;
  return dominio;
}

/** Texto para a tela quando o domínio não recebe e-mail. */
export function avisoDominioInexistente(dominio: string): string {
  return `O endereço @${dominio} não recebe e-mail. Confira se digitou certo — é para ele que mandamos o link de confirmação.`;
}
