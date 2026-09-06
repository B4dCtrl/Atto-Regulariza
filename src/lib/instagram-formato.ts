/**
 * Tradução entre a conversa e as mensagens diretas do Instagram.
 *
 * Mesmo papel do `whatsapp-formato.ts`, outro canal. A triagem não muda: são
 * as mesmas 8 perguntas e a mesma classificação, desenhadas de outro jeito.
 *
 * A diferença que importa: no Instagram as opções viram **respostas rápidas**,
 * os botões acima do teclado. Cabem 13, então as 4 de cada pergunta entram
 * folgadas — mas o título só aceita 20 caracteres e não existe descrição para
 * o resto. Por isso as opções longas carregam um `curto`.
 */

import type { Envio } from "./conversa-triagem";

export const LIMITE_IG = {
  /** A Meta conta **bytes**, não caracteres: cada "ã" ocupa dois. */
  textoBytes: 1000,
  titulo: 20,
  /** Acima disso o Instagram recusa a mensagem. Nossas perguntas têm 4. */
  maxRespostasRapidas: 13,
} as const;

type RespostaRapida = { content_type: "text"; title: string; payload: string };

export type PayloadIg = {
  recipient: { id: string };
  message: { text: string; quick_replies?: RespostaRapida[] };
};

function cortar(texto: string, limite: number): string {
  return texto.length <= limite ? texto : texto.slice(0, limite);
}

/**
 * Corta pelo tamanho em bytes, sem partir um caractere ao meio.
 *
 * `slice` conta caracteres; a Meta conta bytes. Em português a diferença
 * aparece rápido — "não" tem 3 caracteres e 4 bytes.
 */
function cortarBytes(texto: string, limite: number): string {
  const bytes = new TextEncoder().encode(texto);
  if (bytes.length <= limite) return texto;
  // decode com stream:false descarta a sobra de um caractere partido.
  return new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.slice(0, limite))
    .replace(/�$/, "");
}

export function montarPayloadIg(para: string, envio: Envio): PayloadIg {
  if (envio.tipo === "texto") {
    return {
      recipient: { id: para },
      message: { text: cortarBytes(envio.texto, LIMITE_IG.textoBytes) },
    };
  }

  return {
    recipient: { id: para },
    message: {
      text: cortarBytes(envio.texto, LIMITE_IG.textoBytes),
      quick_replies: envio.opcoes.slice(0, LIMITE_IG.maxRespostasRapidas).map((o) => ({
        content_type: "text",
        // O curto vem primeiro: cortar "Construção nunca averbada" em 20
        // deixaria "Construção nunca ave", e a pessoa escolheria às cegas.
        title: cortar(o.curto ?? o.rotulo, LIMITE_IG.titulo),
        payload: o.valor,
      })),
    },
  };
}

export type EntradaIg = { de: string; texto: string };

/**
 * Extrai a mensagem do envelope do Instagram.
 *
 * Dois cuidados que o formato exige:
 *
 * - **Eco.** Toda mensagem que NÓS enviamos volta pelo webhook marcada como
 *   `is_echo`. Sem filtrar, o bot responderia às próprias falas, em laço.
 * - **Resposta rápida.** Quando a pessoa toca num botão, o `text` traz o que
 *   está escrito nele e o `quick_reply.payload` traz o valor. É o payload que
 *   vale — o texto visível pode ser o rótulo curto, que a conversa não conhece.
 */
export function lerEntradaIg(corpo: unknown): EntradaIg | null {
  if (!corpo || typeof corpo !== "object") return null;

  type Envelope = {
    entry?: {
      messaging?: {
        sender?: { id?: string };
        message?: {
          text?: string;
          is_echo?: boolean;
          quick_reply?: { payload?: string };
          attachments?: unknown[];
        };
      }[];
    }[];
  };

  const evento = (corpo as Envelope).entry?.[0]?.messaging?.[0];
  const mensagem = evento?.message;
  // Sem `message` é confirmação de leitura, reação ou entrega — não é fala.
  if (!mensagem || mensagem.is_echo) return null;

  const de = evento?.sender?.id;
  if (!de) return null;

  const payload = mensagem.quick_reply?.payload;
  if (payload) return { de, texto: payload };

  return { de, texto: (mensagem.text ?? "").trim() };
}
