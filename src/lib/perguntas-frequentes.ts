/**
 * Respostas escritas à mão para as perguntas que sempre se repetem.
 *
 * Existe por dois motivos. O primeiro é dinheiro: cada pergunta ao modelo custa,
 * e as mesmas cinco dúvidas respondem por boa parte do que um cliente pergunta.
 * O segundo é confiabilidade — sobre prazo, documento exigido e o que a Ato faz,
 * a resposta certa não muda, e texto fixo nunca inventa.
 *
 * Regras que valem aqui e no prompt da IA: nunca prometer prazo garantido, nunca
 * dar parecer jurídico, e dizer que o profissional responsável valida cada caso.
 */

export type PerguntaFrequente = {
  id: string;
  pergunta: string;
  resposta: string;
};

export const PERGUNTAS_FREQUENTES: PerguntaFrequente[] = [
  {
    id: "documentos",
    pergunta: "Quais documentos eu preciso enviar?",
    resposta:
      "Começamos sempre com RG e CPF do proprietário, comprovante de endereço, a matrícula " +
      "do imóvel (ou o contrato de compra e venda, se ainda não houver matrícula) e o IPTU " +
      "mais recente. Conforme o caso, o profissional responsável pede o que faltar — e cada " +
      "pedido aparece na sua tela, em “O que falta de você”, com o botão de envio ali mesmo.",
  },
  {
    id: "prazo",
    pergunta: "Quanto tempo demora?",
    resposta:
      "Depende de duas coisas que não estão na nossa mão: a prefeitura e o cartório da sua " +
      "cidade. O que controlamos é a nossa parte — análise, projeto e protocolo — e você " +
      "acompanha cada etapa em tempo real por aqui. Por isso não prometemos prazo fechado: " +
      "prometer o que depende de terceiro seria enganar você.",
  },
  {
    id: "etapa",
    pergunta: "Em que etapa está o meu processo?",
    resposta:
      "A barra no alto da sua tela mostra a etapa atual e o quanto já andou. Cada etapa " +
      "concluída fica marcada, e quando algo depende de você aparece na caixa “O que falta " +
      "de você”. Se estiver parada há dias sem pedido nenhum, é sinal de que estamos " +
      "aguardando um órgão externo.",
  },
  {
    id: "profissional",
    pergunta: "Quem é o profissional que cuida do meu caso?",
    resposta:
      "Assim que a análise inicial termina, a equipe designa um profissional habilitado — " +
      "arquiteto, engenheiro ou advogado, conforme o seu caso. Ele aparece na seção " +
      "“Profissional” com o registro no conselho, e é com ele que você conversa por aqui.",
  },
  {
    id: "custo",
    pergunta: "O que está incluso no valor?",
    resposta:
      "O acompanhamento da equipe, a análise documental e a elaboração das peças técnicas " +
      "estão inclusos. Taxas de prefeitura, cartório e emolumentos são cobradas pelos órgãos " +
      "e não passam por nós — sempre avisamos antes de qualquer uma ser necessária.",
  },
  {
    id: "documento-recusado",
    pergunta: "Enviei um documento e ele não foi aceito. E agora?",
    resposta:
      "Acontece com frequência, e quase sempre por qualidade da imagem ou por o documento " +
      "estar desatualizado. Envie de novo pelo mesmo lugar — o sistema guarda as versões, " +
      "então nada do que você mandou antes se perde, e o profissional vê o histórico completo.",
  },
];
