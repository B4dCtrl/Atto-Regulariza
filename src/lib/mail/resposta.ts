/**
 * O que faz uma resposta ser reconhecida como resposta.
 *
 * Gmail e Outlook agrupam a conversa por `In-Reply-To` e `References`, não pelo
 * assunto. Sem eles, cada resposta do painel chegaria como e-mail solto, e o
 * cliente perderia o fio do que foi combinado.
 */

const JA_E_RESPOSTA = /^\s*(re|res|resp)\s*:/i;

export function assuntoDeResposta(assunto: string): string {
  const a = assunto.trim();
  if (!a) return "Re: (sem assunto)";
  return JA_E_RESPOSTA.test(a) ? a : `Re: ${a}`;
}

export function cabecalhosDeResposta(o: { messageId?: string; references?: string[] }): {
  inReplyTo?: string;
  references?: string[];
} {
  if (!o.messageId) return {};
  return { inReplyTo: o.messageId, references: [...(o.references ?? []), o.messageId] };
}

export function citar(o: { de: string; data: Date; texto: string }): string {
  const quando = o.data.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const linhas = o.texto
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => `> ${l}`);
  return `\n\nEm ${quando}, ${o.de} escreveu:\n${linhas.join("\n")}`;
}
