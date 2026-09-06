/**
 * A conversa da triagem, passo a passo.
 *
 * Recebe uma entrada por vez e devolve o que responder. Não conhece WhatsApp:
 * fala em "envios" — texto ou pergunta com opções — e quem entende de canal
 * traduz para o formato de lá. Assim a mesma conversa serve no WhatsApp hoje e
 * no site amanhã, e dá para testar sem rede nem credencial.
 *
 * O estado é um objeto simples de propósito: cabe numa coluna JSON e não
 * depende de a instância do servidor ser a mesma entre uma mensagem e outra —
 * em função serverless, nunca é.
 */

import { PERGUNTAS, classificar, type Respostas, type Resultado } from "./triagem";

export type Envio =
  | { tipo: "texto"; texto: string }
  | { tipo: "opcoes"; texto: string; opcoes: { valor: string; rotulo: string; curto?: string }[] };

export type Estado = {
  /** Índice da próxima pergunta em PERGUNTAS. 8 = acabou. */
  passo: number;
  respostas: Partial<Respostas>;
  encerrada: boolean;
  /** Saiu do bot por pedido da pessoa, não por ter respondido tudo. */
  pediuHumano: boolean;
  resultado: Resultado | null;
};

const SAUDACAO =
  "Olá! Sou o assistente da Ato Regulariza. Vou fazer algumas perguntas rápidas " +
  "para entender seu caso e te encaminhar para a pessoa certa. Leva menos de dois minutos.";

const SAIDA_HUMANA =
  "Claro. Já avisei a equipe — em breve uma pessoa da equipe assume esta conversa por aqui.";

/**
 * Pedidos de atendimento humano.
 *
 * Só valem enquanto a pergunta é de múltipla escolha. Num campo de texto livre
 * a pessoa está contando o caso dela, e "falei com um atendente da prefeitura"
 * não é pedido de transferência — é o relato.
 */
const PEDE_HUMANO = /\b(atendente|humano|pessoa|consultor|especialista)\b/i;

function estadoInicial(): Estado {
  return { passo: 0, respostas: {}, encerrada: false, pediuHumano: false, resultado: null };
}

function perguntaDe(passo: number): Envio {
  const p = PERGUNTAS[passo];
  if (p.tipo === "texto") return { tipo: "texto", texto: p.texto };
  return {
    tipo: "opcoes",
    texto: p.texto,
    opcoes: p.opcoes.map((o) => ({
      valor: o.valor as string,
      rotulo: o.rotulo,
      ...(o.curto ? { curto: o.curto } : {}),
    })),
  };
}

/**
 * Primeira mensagem da pessoa.
 *
 * O texto dela importa: quem abre a conversa pedindo atendente não deve
 * receber um questionário como resposta. Nesse caso a triagem nem começa.
 */
export function iniciar(primeiraMensagem = ""): { estado: Estado; envios: Envio[] } {
  if (PEDE_HUMANO.test(primeiraMensagem.trim())) {
    return {
      estado: { ...estadoInicial(), encerrada: true, pediuHumano: true },
      envios: [{ tipo: "texto", texto: SAIDA_HUMANA }],
    };
  }

  return {
    estado: estadoInicial(),
    envios: [{ tipo: "texto", texto: SAUDACAO }, perguntaDe(0)],
  };
}

export function avancar(estado: Estado, entrada: string): { estado: Estado; envios: Envio[] } {
  // Conversa encerrada não responde mais. Quem escreve depois disso está
  // falando com a equipe, e o bot interromper seria pior que o silêncio.
  if (estado.encerrada) return { estado, envios: [] };

  const pergunta = PERGUNTAS[estado.passo];
  const texto = entrada.trim();

  if (pergunta.tipo === "opcoes" && PEDE_HUMANO.test(texto)) {
    return {
      estado: { ...estado, encerrada: true, pediuHumano: true },
      envios: [{ tipo: "texto", texto: SAIDA_HUMANA }],
    };
  }

  if (pergunta.tipo === "texto") {
    if (!texto) {
      return {
        estado,
        envios: [
          { tipo: "texto", texto: "Não consegui ler sua resposta. Pode escrever de novo?" },
          perguntaDe(estado.passo),
        ],
      };
    }
    return seguir(estado, pergunta.id, texto);
  }

  const escolhida = pergunta.opcoes.find((o) => (o.valor as string) === texto);
  if (!escolhida) {
    return {
      estado,
      envios: [
        { tipo: "texto", texto: "Para seguir, toque em uma das opções abaixo." },
        perguntaDe(estado.passo),
      ],
    };
  }
  return seguir(estado, pergunta.id, escolhida.valor as string);
}

function seguir(estado: Estado, campo: string, valor: string): { estado: Estado; envios: Envio[] } {
  const respostas = { ...estado.respostas, [campo]: valor } as Partial<Respostas>;
  const passo = estado.passo + 1;

  if (passo < PERGUNTAS.length) {
    return { estado: { ...estado, passo, respostas }, envios: [perguntaDe(passo)] };
  }

  // Última pergunta respondida: classifica e devolve o veredito.
  const resultado = classificar(respostas as Respostas);
  return {
    estado: { ...estado, passo, respostas, encerrada: true, resultado },
    envios: [{ tipo: "texto", texto: resultado.mensagem }],
  };
}
