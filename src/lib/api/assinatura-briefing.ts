import { createHash } from "node:crypto";
import type { DadosGerenciais } from "@/lib/api/resumo-gerencial";

/**
 * Quando o texto da IA precisa ser refeito.
 *
 * Antes o briefing era gerado uma vez por dia e só mudava no botão
 * "Atualizar": conta, admin, documento ou processo que surgisse depois não
 * aparecia no texto até o dia seguinte. Agora cada abertura compara uma
 * ASSINATURA dos dados de agora com a do texto guardado; mudou o que importa,
 * o texto é refeito.
 *
 * Funções puras, de propósito — a server function não roda em Vitest, e a
 * regra de quando se gasta uma chamada de IA precisa de teste.
 */

/**
 * Intervalo mínimo entre duas gerações automáticas.
 *
 * Uma operação ativa troca mensagens o tempo todo; sem este piso, cada
 * mensagem nova custaria uma chamada de IA na próxima abertura do painel. O
 * botão "Atualizar" ignora o piso.
 */
export const INTERVALO_MINIMO_MS = 15 * 60_000;

const porTexto = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * O recorte dos dados que justifica um texto novo, em forma canônica.
 *
 * Fica DE FORA o que muda sem que haja novidade para contar:
 * - acessos ao painel e pessoas que entraram — o próprio admin abrindo a tela
 *   registra acesso, e o texto seria refeito a cada abertura;
 * - datas de "último acesso" e de "desde" que só envelhecem — o tempo passar
 *   não é fato novo; quando o item se resolve, ele sai da lista e a lista muda.
 *
 * Listas vão ORDENADAS: a ordem em que o banco devolve as linhas não é
 * garantida, e a mesma situação não pode gerar duas assinaturas.
 */
export function dadosDaAssinatura(d: DadosGerenciais): string {
  const m = d.movimento;
  const canonico = {
    profissionaisPendentes: d.profissionaisPendentes
      .map((p) => `${p.nome}|${p.desde}`)
      .sort(porTexto),
    aprovacoesPendentes: d.aprovacoesPendentes
      .map((a) => `${a.tipo}|${a.processo}|${a.desde}`)
      .sort(porTexto),
    processosParados: d.processosParados
      .map((p) => `${p.id}|${p.etapa}|${p.documentosPendentes}`)
      .sort(porTexto),
    leadsSemResposta: d.leadsSemResposta.length,
    profissionaisInativos: d.profissionaisInativos
      .map((p) => `${p.nome}|${p.processos}`)
      .sort(porTexto),
    movimento: {
      contasNovas: [m.contasNovas.cliente, m.contasNovas.profissional, m.contasNovas.admin],
      leadsNovos: m.leadsNovos,
      processosNovos: m.processosNovos,
      documentosEnviados: m.documentosEnviados,
      mensagensTrocadas: m.mensagensTrocadas,
      etapasConcluidas: m.etapasConcluidas,
    },
  };
  // Objeto literal com chaves fixas: a ordem das chaves no JSON é a da
  // declaração acima, sempre a mesma.
  return JSON.stringify(canonico);
}

/** sha256 do recorte canônico — curto para guardar e comparar. */
export function assinaturaBriefing(d: DadosGerenciais): string {
  return createHash("sha256").update(dadosDaAssinatura(d)).digest("hex");
}

export type BriefingGuardado = { assinatura: string | null; gerado_em: string };

/**
 * Usa o texto guardado ou gera outro?
 *
 * - `forcar` (botão "Atualizar"): sempre gera.
 * - Sem texto do dia: gera.
 * - Mesma assinatura: nada de novo, usa o guardado.
 * - Assinatura diferente, mas texto com menos de 15 min: usa o guardado — o
 *   piso de custo acima. Os NÚMEROS na tela continuam os de agora; só o texto
 *   espera.
 * - Assinatura diferente e texto mais velho que isso: gera.
 *
 * Texto guardado antes desta coluna existir tem assinatura nula: conta como
 * diferente, e é refeito na primeira abertura passado o piso.
 */
export function decidirBriefing(p: {
  forcar: boolean;
  guardado: BriefingGuardado | null;
  assinaturaAtual: string;
  agora: Date;
}): "usar-guardado" | "gerar" {
  if (p.forcar || !p.guardado) return "gerar";
  if (p.guardado.assinatura === p.assinaturaAtual) return "usar-guardado";
  const idade = p.agora.getTime() - new Date(p.guardado.gerado_em).getTime();
  return idade < INTERVALO_MINIMO_MS ? "usar-guardado" : "gerar";
}
