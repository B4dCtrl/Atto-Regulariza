/**
 * Montagem do resumo que vai para a IA.
 *
 * Funções puras, de propósito: a server function não roda em Vitest, e o que
 * mais importa aqui — que nenhum dado sensível escape para um terceiro e que
 * as contas de dias estejam certas — precisa de teste.
 *
 * A IA recebe este texto e ESCREVE sobre ele. Ela não calcula nada: todo
 * número já vem pronto daqui, e a tela mostra os mesmos dados ao lado do
 * texto, de modo que qualquer invenção fique visível.
 */

export type ProfissionalPendente = {
  nome: string;
  /** Quando entrou na fila de aprovação. */
  desde: string;
};

export type AprovacaoPendente = {
  tipo: string;
  processo: string;
  desde: string;
};

export type ProcessoParado = {
  id: string;
  nome: string;
  etapa: number;
  paradoDesde: string;
  cliente: string;
  /** Nulo quando o cliente nunca entrou no painel. */
  clienteUltimoAcesso: string | null;
  documentosPendentes: number;
};

export type LeadSemResposta = {
  cidade: string | null;
  uf: string | null;
  desde: string;
};

export type ProfissionalInativo = {
  nome: string;
  processos: number;
  ultimoAcesso: string | null;
};

export type DadosGerenciais = {
  profissionaisPendentes: ProfissionalPendente[];
  aprovacoesPendentes: AprovacaoPendente[];
  processosParados: ProcessoParado[];
  leadsSemResposta: LeadSemResposta[];
  profissionaisInativos: ProfissionalInativo[];
};

/** Dias inteiros entre uma data e agora. Nulo quando nunca aconteceu. */
export function diasDesde(iso: string | null, agora: Date): number | null {
  if (!iso) return null;
  const ms = agora.getTime() - new Date(iso).getTime();
  return Math.floor(ms / 86_400_000);
}

/** "há 3 dias", "hoje" — ou "nunca acessou" quando não há data. */
function espera(iso: string | null, agora: Date): string {
  const d = diasDesde(iso, agora);
  if (d === null) return "nunca acessou";
  if (d === 0) return "hoje";
  if (d === 1) return "há 1 dia";
  return `há ${d} dias`;
}

/** Só os 8 primeiros caracteres do uuid: identifica sem poluir o texto. */
function curto(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

export function montarResumo(d: DadosGerenciais, agora: Date): string {
  const linhas: string[] = [];

  if (d.profissionaisPendentes.length > 0) {
    const itens = d.profissionaisPendentes
      .map((p) => `${p.nome} (aguarda ${espera(p.desde, agora)})`)
      .join("; ");
    linhas.push(`Profissionais aguardando liberação: ${itens}`);
  }

  if (d.aprovacoesPendentes.length > 0) {
    const itens = d.aprovacoesPendentes
      .map((a) => `${a.tipo} no processo ${a.processo} (${espera(a.desde, agora)})`)
      .join("; ");
    linhas.push(`Aprovações pendentes: ${itens}`);
  }

  for (const p of d.processosParados) {
    const docs =
      p.documentosPendentes > 0
        ? `, ${p.documentosPendentes} documento(s) pendente(s) do cliente ${p.cliente} (${espera(p.clienteUltimoAcesso, agora)})`
        : `, cliente ${p.cliente} (${espera(p.clienteUltimoAcesso, agora)})`;
    linhas.push(
      `Processo parado: ${curto(p.id)} "${p.nome}" — etapa ${p.etapa}, sem movimento ${espera(p.paradoDesde, agora)}${docs}`,
    );
  }

  if (d.leadsSemResposta.length > 0) {
    const maisAntigo = d.leadsSemResposta.reduce((a, b) =>
      new Date(a.desde) < new Date(b.desde) ? a : b,
    );
    const onde = [maisAntigo.cidade, maisAntigo.uf].filter(Boolean).join("/");
    linhas.push(
      `Leads sem resposta: ${d.leadsSemResposta.length}, o mais antigo ${espera(maisAntigo.desde, agora)}${onde ? ` (${onde})` : ""}`,
    );
  }

  for (const p of d.profissionaisInativos) {
    linhas.push(
      `Profissional inativo: ${p.nome} — ${p.processos} processo(s), ${espera(p.ultimoAcesso, agora)}`,
    );
  }

  if (linhas.length === 0) return "Nada pendente no momento.";
  return linhas.join("\n");
}
