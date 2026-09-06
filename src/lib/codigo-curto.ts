/**
 * Código curto do caso.
 *
 * Vira o link que o cliente recebe no fim da triagem:
 * `atoregulariza.com.br/f/K7M2QX`. Curto o bastante para caber numa mensagem
 * sem assustar, e legível o bastante para alguém ditar por telefone.
 *
 * Fora do alfabeto ficam O/0, I/1 e S/5 — os pares que quem lê em voz alta
 * confunde. Sobram 30 símbolos; com 6 posições dá 729 milhões de combinações,
 * o que torna adivinhar um código alheio inviável na prática.
 */

export const ALFABETO = "ABCDEFGHJKLMNPQRTUVWXYZ2346789";

const TAMANHO = 6;

export function gerarCodigo(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TAMANHO));
  let saida = "";
  for (const b of bytes) saida += ALFABETO[b % ALFABETO.length];
  return saida;
}
