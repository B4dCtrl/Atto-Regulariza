/**
 * Ênfase que sobrevive à troca de canal.
 *
 * A conversa é escrita uma vez e sai em WhatsApp e Instagram. O WhatsApp
 * entende `*negrito*`; o Instagram não entende nada — mostraria o asterisco
 * cru no meio da frase, que é pior que não ter destaque nenhum.
 *
 * Então o texto da triagem marca com `**assim**`, e cada canal traduz na
 * hora de montar o payload. Escolhemos a marcação de dois asteriscos porque
 * ela não colide com a do WhatsApp: um texto que já viesse com `*` simples
 * passa intacto.
 */

/** Para o WhatsApp: `**x**` vira `*x*`. */
export function paraWhatsApp(texto: string): string {
  return texto.replace(/\*\*(.+?)\*\*/g, "*$1*");
}

/** Para o Instagram e qualquer canal sem formatação: tira a marcação. */
export function semFormato(texto: string): string {
  return texto.replace(/\*\*(.+?)\*\*/g, "$1");
}
