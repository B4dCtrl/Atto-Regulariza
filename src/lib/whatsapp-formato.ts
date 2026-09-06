/**
 * Tradução entre a conversa e o formato da WhatsApp Cloud API.
 *
 * Fica separado da conversa de propósito: aqui moram as regras da Meta — que
 * mudam quando ela quer — e lá mora a lógica da triagem, que é nossa. Trocar
 * de canal um dia significa escrever outro arquivo como este, e mais nada.
 */

import type { Envio } from "./conversa-triagem";

/**
 * Limites da API. Estourar qualquer um faz a Meta recusar a mensagem inteira
 * com erro 131009, então cortamos antes em vez de descobrir em produção.
 */
export const LIMITE = {
  corpo: 1024,
  tituloLinha: 24,
  descricaoLinha: 72,
  textoBotao: 20,
  /** Acima disso, botão não serve e a pergunta vira lista. */
  maxBotoes: 3,
} as const;

type Linha = { id: string; title: string; description?: string };

export type Payload = {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "text" | "interactive";
  text?: { body: string; preview_url: false };
  interactive?: {
    type: "button" | "list";
    body: { text: string };
    action: {
      button?: string;
      buttons?: { type: "reply"; reply: { id: string; title: string } }[];
      sections?: { title: string; rows: Linha[] }[];
    };
  };
};

function cortar(texto: string, limite: number): string {
  return texto.length <= limite ? texto : texto.slice(0, limite);
}

export function montarPayload(para: string, envio: Envio): Payload {
  const base = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: para,
  } as const;

  if (envio.tipo === "texto") {
    return {
      ...base,
      type: "text",
      text: { body: cortar(envio.texto, LIMITE.corpo), preview_url: false },
    };
  }

  const corpo = { text: cortar(envio.texto, LIMITE.corpo) };

  if (envio.opcoes.length <= LIMITE.maxBotoes) {
    return {
      ...base,
      type: "interactive",
      interactive: {
        type: "button",
        body: corpo,
        action: {
          buttons: envio.opcoes.map((o) => ({
            type: "reply",
            reply: { id: o.valor, title: cortar(o.rotulo, LIMITE.textoBotao) },
          })),
        },
      },
    };
  }

  return {
    ...base,
    type: "interactive",
    interactive: {
      type: "list",
      body: corpo,
      action: {
        button: "Ver opções",
        sections: [
          {
            title: "Escolha uma",
            // O título tem 24 caracteres; o rótulo que não couber vai inteiro
            // na descrição, para a pessoa nunca ler uma opção pela metade.
            rows: envio.opcoes.map((o) => {
              const title = cortar(o.rotulo, LIMITE.tituloLinha);
              const linha: Linha = { id: o.valor, title };
              if (title !== o.rotulo) {
                linha.description = cortar(o.rotulo, LIMITE.descricaoLinha);
              }
              return linha;
            }),
          },
        ],
      },
    },
  };
}

export type Entrada = { de: string; texto: string };

/**
 * Extrai a mensagem do envelope que a Meta manda.
 *
 * Devolve null para o que não é mensagem de gente — recibo de entrega e de
 * leitura chegam no mesmo webhook e responder a eles daria conversa em loop.
 * Áudio, imagem e figurinha viram texto vazio: a conversa trata como resposta
 * ilegível e repete a pergunta, que é melhor que ignorar em silêncio.
 */
export function lerEntrada(corpo: unknown): Entrada | null {
  if (!corpo || typeof corpo !== "object") return null;

  // O envelope da Meta é aninhado e nem sempre vem completo. Tipar cada nível
  // como opcional é mais honesto que confiar no formato documentado.
  type Envelope = {
    entry?: { changes?: { value?: Record<string, unknown> }[] }[];
  };
  const valor = (corpo as Envelope).entry?.[0]?.changes?.[0]?.value;
  const mensagem = (valor?.messages as Record<string, unknown>[] | undefined)?.[0];
  if (!mensagem) return null;

  const de = typeof mensagem.from === "string" ? mensagem.from : "";
  if (!de) return null;

  if (mensagem.type === "text") {
    const texto = (mensagem.text as { body?: string } | undefined)?.body ?? "";
    return { de, texto: texto.trim() };
  }

  if (mensagem.type === "interactive") {
    const inter = mensagem.interactive as Record<string, { id?: string }> | undefined;
    const id = inter?.list_reply?.id ?? inter?.button_reply?.id ?? "";
    return { de, texto: id };
  }

  return { de, texto: "" };
}
