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

/** O que aconteceu no período — a parte retrospectiva do resumo. */
export type Movimento = {
  /** Contas criadas, por papel. */
  contasNovas: { cliente: number; profissional: number };
  /** Entradas nos painéis, por painel. */
  acessos: { cliente: number; profissional: number; admin: number };
  /** Quantas pessoas distintas entraram. */
  pessoasQueEntraram: number;
  leadsNovos: number;
  processosNovos: number;
  documentosEnviados: number;
  mensagensTrocadas: number;
  etapasConcluidas: number;
};

export type DadosGerenciais = {
  profissionaisPendentes: ProfissionalPendente[];
  aprovacoesPendentes: AprovacaoPendente[];
  processosParados: ProcessoParado[];
  leadsSemResposta: LeadSemResposta[];
  profissionaisInativos: ProfissionalInativo[];
  /** Últimos 7 dias. */
  movimento: Movimento;
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

/** A parte retrospectiva: o que se moveu nos últimos 7 dias. */
function linhasDeMovimento(m: Movimento): string[] {
  const partes: string[] = [];

  const contas = m.contasNovas.cliente + m.contasNovas.profissional;
  if (contas > 0) {
    partes.push(
      `Contas novas: ${contas} (${m.contasNovas.cliente} cliente(s), ${m.contasNovas.profissional} profissional(is))`,
    );
  }

  const entradas = m.acessos.cliente + m.acessos.profissional + m.acessos.admin;
  if (entradas > 0) {
    partes.push(
      `Acessos ao painel: ${entradas} de ${m.pessoasQueEntraram} pessoa(s) — ` +
        `${m.acessos.cliente} cliente, ${m.acessos.profissional} profissional, ${m.acessos.admin} admin`,
    );
  }

  if (m.leadsNovos > 0) partes.push(`Leads recebidos: ${m.leadsNovos}`);
  if (m.processosNovos > 0) partes.push(`Processos abertos: ${m.processosNovos}`);
  if (m.documentosEnviados > 0) partes.push(`Documentos enviados: ${m.documentosEnviados}`);
  if (m.mensagensTrocadas > 0) partes.push(`Mensagens trocadas: ${m.mensagensTrocadas}`);
  if (m.etapasConcluidas > 0) partes.push(`Etapas concluídas: ${m.etapasConcluidas}`);

  // Silêncio total é informação: sem esta linha, a IA não teria como saber a
  // diferença entre "não houve movimento" e "o resumo esqueceu de contar".
  if (partes.length === 0) return ["Movimento dos últimos 7 dias: nenhum."];

  return ["Movimento dos últimos 7 dias:", ...partes.map((p) => `- ${p}`)];
}

export function montarResumo(d: DadosGerenciais, agora: Date): string {
  const pendencias: string[] = [];

  if (d.profissionaisPendentes.length > 0) {
    const itens = d.profissionaisPendentes
      .map((p) => `${p.nome} (aguarda ${espera(p.desde, agora)})`)
      .join("; ");
    pendencias.push(`Profissionais aguardando liberação: ${itens}`);
  }

  if (d.aprovacoesPendentes.length > 0) {
    const itens = d.aprovacoesPendentes
      .map((a) => `${a.tipo} no processo ${a.processo} (${espera(a.desde, agora)})`)
      .join("; ");
    pendencias.push(`Aprovações pendentes: ${itens}`);
  }

  for (const p of d.processosParados) {
    const docs =
      p.documentosPendentes > 0
        ? `, ${p.documentosPendentes} documento(s) pendente(s) do cliente ${p.cliente} (${espera(p.clienteUltimoAcesso, agora)})`
        : `, cliente ${p.cliente} (${espera(p.clienteUltimoAcesso, agora)})`;
    pendencias.push(
      `Processo parado: ${curto(p.id)} "${p.nome}" — etapa ${p.etapa}, sem movimento ${espera(p.paradoDesde, agora)}${docs}`,
    );
  }

  if (d.leadsSemResposta.length > 0) {
    const maisAntigo = d.leadsSemResposta.reduce((a, b) =>
      new Date(a.desde) < new Date(b.desde) ? a : b,
    );
    const onde = [maisAntigo.cidade, maisAntigo.uf].filter(Boolean).join("/");
    pendencias.push(
      `Leads sem resposta: ${d.leadsSemResposta.length}, o mais antigo ${espera(maisAntigo.desde, agora)}${onde ? ` (${onde})` : ""}`,
    );
  }

  for (const p of d.profissionaisInativos) {
    pendencias.push(
      `Profissional inativo: ${p.nome} — ${p.processos} processo(s), ${espera(p.ultimoAcesso, agora)}`,
    );
  }

  // O retrospecto sempre entra; as pendências entram se houver. As duas partes
  // são separadas porque a IA precisa distinguir o que ACONTECEU do que
  // FALTA acontecer.
  return [
    ...linhasDeMovimento(d.movimento),
    "",
    ...(pendencias.length > 0
      ? ["Pendências agora:", ...pendencias.map((l) => `- ${l}`)]
      : ["Nada pendente no momento."]),
  ].join("\n");
}
