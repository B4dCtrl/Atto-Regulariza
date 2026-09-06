/**
 * Para onde o link curto leva.
 *
 * `/f/K7M2QX` abre a conversa no WhatsApp da equipe com uma saudação que
 * carrega o código do caso. O cliente não precisa repetir nada: quem atende
 * procura o código no painel e já sabe a cidade, o tipo de imóvel, a
 * classificação e o relato.
 *
 * Fica separado do `server.ts` para ser testável sem subir servidor.
 */

import { ATENDIMENTO_PHONE } from "@/lib/brand";

export function destinoDoCodigo(codigo: string): string {
  const texto = `Olá! Terminei a triagem pelo assistente. Meu código é ${codigo}.`;
  return `https://wa.me/${ATENDIMENTO_PHONE}?text=${encodeURIComponent(texto)}`;
}
