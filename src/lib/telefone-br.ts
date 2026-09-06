/**
 * O nono dígito.
 *
 * Celular brasileiro ganhou um 9 na frente em 2012, mas o WhatsApp ainda
 * identifica muita conta antiga pelo número curto. Na prática existem duas
 * grafias do mesmo telefone — 55 41 8447-1404 e 55 41 98447-1404 — e nem toda
 * parte da API da Meta trata as duas como iguais: a mensagem chega com uma, e
 * a lista de permitidos pode ter a outra.
 *
 * Daí esta função: dada uma grafia, devolve a outra. Quem envia tenta a
 * segunda quando a primeira é recusada por número desconhecido.
 */

/** Devolve a outra grafia do mesmo celular, ou null se não houver. */
export function formaAlternativa(numero: string): string | null {
  const so = numero.replace(/\D/g, "");
  if (!so.startsWith("55")) return null;

  const ddd = so.slice(2, 4);
  const assinante = so.slice(4);

  // Forma curta: 8 dígitos. Vira longa ganhando o 9 — mas só se for celular.
  // Fixo começa com 2 a 5 e nunca teve nono dígito.
  if (assinante.length === 8) {
    return /^[6-9]/.test(assinante) ? `55${ddd}9${assinante}` : null;
  }

  // Forma longa: 9 dígitos começando com 9. Vira curta perdendo esse 9.
  if (assinante.length === 9 && assinante.startsWith("9")) {
    return `55${ddd}${assinante.slice(1)}`;
  }

  return null;
}
