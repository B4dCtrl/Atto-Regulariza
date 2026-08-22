import process from "node:process";

/**
 * Qual modelo do Claude usar, e o que pode ser pedido a ele.
 *
 * Fica num arquivo só para o briefing e o assistente do chat não divergirem —
 * já tivemos dois fornecedores de IA no mesmo produto e não vamos repetir a
 * dose com dois modelos.
 */

/**
 * Haiku 4.5 por decisão de custo (2026-08-22): US$ 1 por milhão de tokens de
 * entrada contra US$ 5 do Opus 5. Para briefing diário e resposta curta de
 * atendimento, dá conta.
 *
 * Trocar não exige mexer em código: basta definir ANTHROPIC_MODEL na Vercel.
 */
export const MODELO_IA = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

/**
 * `output_config` compatível com o modelo escolhido.
 *
 * `effort` só existe nos modelos mais novos. No Haiku 4.5 ele é **recusado**,
 * e a chamada inteira falha — um detalhe que passaria como "a IA parou de
 * funcionar" se ficasse espalhado por dois arquivos.
 */
export function aceitaEsforco(modelo: string = MODELO_IA): boolean {
  return !modelo.startsWith("claude-haiku");
}
