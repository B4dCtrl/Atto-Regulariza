import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import process from "node:process";
import { avisarErro } from "@/lib/api/avisar-erro.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { montarResumo, DIAS_PARADO, type DadosGerenciais } from "@/lib/api/resumo-gerencial";
import { assinaturaBriefing, decidirBriefing } from "@/lib/api/assinatura-briefing";

import { MODELO_IA, aceitaEsforco } from "@/lib/api/modelo-ia";

/**
 * Formato exigido da resposta.
 *
 * Antes o modelo era instruído a devolver JSON e a gente recortava do primeiro
 * `{` ao último `}`, porque ele às vezes embrulhava em cercas de código. Com
 * `messages.parse` o formato é imposto pela API e validado pelo schema — a
 * gambiarra deixa de existir.
 */
/*
 * Em JSON Schema, e não em Zod, de propósito: o helper de Zod do SDK espera a
 * API do Zod 4, e o projeto está no 3.25 (que funciona em execução, mas não nos
 * tipos). Este caminho não depende da versão.
 */
const FORMATO_BRIEFING = {
  type: "object",
  properties: {
    texto: { type: "string", description: "O briefing, no máximo 4 frases." },
    fila: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "O que fazer." },
          motivo: { type: "string", description: "Por que é urgente." },
          destino: { type: "string", enum: ["aprovacoes", "processos", "leads"] },
        },
        required: ["titulo", "motivo", "destino"],
        additionalProperties: false,
      },
    },
    alertas: {
      type: "array",
      items: { type: "string" },
      description: "O que está saindo do radar.",
    },
  },
  required: ["texto", "fila", "alertas"],
  additionalProperties: false,
} as const;

/** Profissional sem acessar o painel por mais dias que isto é sinalizado. */
const DIAS_INATIVO = 5;
/** Janela do retrospecto: "o que aconteceu" cobre este número de dias. */
const DIAS_MOVIMENTO = 7;

export type ItemFila = { titulo: string; motivo: string; destino: string };
export type Briefing = {
  texto: string;
  fila: ItemFila[];
  alertas: string[];
  gerado_em: string;
  dados: DadosGerenciais;
  /**
   * Preenchido quando a IA falhou.
   *
   * A função NÃO lança nesse caso: os números vêm do banco e continuam
   * corretos sem ela. Lançar levaria os dados junto e deixaria o admin sem
   * nada — justamente quando ele precisa ver o que está pendente.
   */
  erroIA?: string;
};

const SYSTEM_PROMPT = `Você escreve o briefing gerencial da Ato Regulariza, plataforma de regularização imobiliária.
Recebe um resumo com os dados JÁ APURADOS da operação e escreve para o administrador.
O resumo tem duas partes: o MOVIMENTO dos últimos 7 dias (o que aconteceu) e as PENDÊNCIAS de agora (o que falta acontecer).
O briefing deve cobrir as duas: primeiro o que andou, depois o que trava.

REGRAS:
- NUNCA invente número, nome, prazo ou fato que não esteja no resumo. Se algo não está lá, não existe.
- NUNCA estime nem complete o que falta.
- Escreva em português do Brasil, direto, sem saudação e sem despedida.
- O briefing tem no máximo 4 frases.

A fila vem ordenada da mais urgente para a menos urgente, com no máximo 6 itens.`;

/** Fuso de São Paulo, para o "dia" bater com o dia do usuário. */
function hojeSP(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

async function coletarDados(): Promise<DadosGerenciais> {
  const agora = Date.now();
  const limiteParado = new Date(agora - DIAS_PARADO * 86_400_000).toISOString();
  const limiteInativo = new Date(agora - DIAS_INATIVO * 86_400_000).toISOString();

  const [profs, aprovacoes, props, leads, inativos] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("name, created_at")
      .eq("role", "profissional")
      .eq("approval_status", "pendente"),
    supabaseAdmin
      .from("approval_requests")
      .select("tipo, property_id, solicitado_em")
      .eq("status", "pendente"),
    supabaseAdmin
      .from("properties")
      .select("id, name, current_stage, updated_at, client_id, client_name")
      .neq("status", "entregue")
      .lt("updated_at", limiteParado),
    supabaseAdmin.from("leads").select("city, state, created_at").eq("status", "novo"),
    supabaseAdmin
      .from("profiles")
      .select("id, name, ultimo_acesso_em")
      .eq("role", "profissional")
      .eq("approval_status", "aprovado")
      .or(`ultimo_acesso_em.is.null,ultimo_acesso_em.lt.${limiteInativo}`),
  ]);

  // Pendências abertas por processo, para dizer quantos documentos faltam.
  const idsParados = (props.data ?? []).map((p) => p.id);
  const pendPorProcesso = new Map<string, number>();
  if (idsParados.length > 0) {
    const { data: pend } = await supabaseAdmin
      .from("pendencies")
      .select("property_id")
      .eq("status", "aberta")
      .in("property_id", idsParados);
    for (const p of pend ?? []) {
      pendPorProcesso.set(p.property_id, (pendPorProcesso.get(p.property_id) ?? 0) + 1);
    }
  }

  // Último acesso dos clientes desses processos, numa consulta só.
  const idsClientes = (props.data ?? []).map((p) => p.client_id).filter(Boolean) as string[];
  const acessoPorCliente = new Map<string, string | null>();
  if (idsClientes.length > 0) {
    const { data: perfis } = await supabaseAdmin
      .from("profiles")
      .select("id, ultimo_acesso_em")
      .in("id", idsClientes);
    for (const p of perfis ?? []) acessoPorCliente.set(p.id, p.ultimo_acesso_em);
  }

  // Quantos processos cada profissional inativo tem na mão.
  const idsInativos = (inativos.data ?? []).map((p) => p.id);
  const processosPorProf = new Map<string, number>();
  if (idsInativos.length > 0) {
    const { data: atrib } = await supabaseAdmin
      .from("properties")
      .select("assigned_professional_id")
      .neq("status", "entregue")
      .in("assigned_professional_id", idsInativos);
    for (const p of atrib ?? []) {
      const k = p.assigned_professional_id;
      if (k) processosPorProf.set(k, (processosPorProf.get(k) ?? 0) + 1);
    }
  }

  // ---- Retrospecto: o que se moveu na janela ----
  //
  // `head: true` com `count: "exact"` traz só o número, sem as linhas: para
  // contar mensagens de uma operação ativa, buscar tudo seria desperdício.
  const desde = new Date(agora - DIAS_MOVIMENTO * 86_400_000).toISOString();
  const contar = (tabela: "leads" | "properties" | "documents" | "messages") =>
    supabaseAdmin
      .from(tabela)
      .select("id", { count: "exact", head: true })
      .gte("created_at", desde);

  const [
    novasContas,
    acessosJanela,
    leadsNovos,
    processosNovos,
    docsNovos,
    msgsNovas,
    etapasFeitas,
  ] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, role").gte("created_at", desde),
    supabaseAdmin.from("acessos").select("user_id, painel").gte("entrou_em", desde),
    contar("leads"),
    contar("properties"),
    contar("documents"),
    contar("messages"),
    supabaseAdmin
      .from("process_stages")
      .select("id", { count: "exact", head: true })
      .gte("completed_at", desde),
  ]);

  // Admin não se reconhece pelo perfil — o papel mora em `user_roles`. Conta
  // nova que é admin entra só como admin, senão a equipe recém-cadastrada
  // apareceria como "cliente novo" no texto.
  const idsNovos = (novasContas.data ?? []).map((c) => c.id);
  const adminsNovos = new Set<string>();
  if (idsNovos.length > 0) {
    const { data: papeis } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .in("user_id", idsNovos);
    for (const r of papeis ?? []) adminsNovos.add(r.user_id);
  }

  const contasNovas = { cliente: 0, profissional: 0, admin: 0 };
  for (const c of novasContas.data ?? []) {
    if (adminsNovos.has(c.id)) contasNovas.admin++;
    else if (c.role === "profissional") contasNovas.profissional++;
    else if (c.role === "cliente") contasNovas.cliente++;
  }

  const acessos = { cliente: 0, profissional: 0, admin: 0 };
  const pessoas = new Set<string>();
  for (const a of acessosJanela.data ?? []) {
    if (a.painel === "cliente" || a.painel === "profissional" || a.painel === "admin") {
      acessos[a.painel]++;
    }
    pessoas.add(a.user_id);
  }

  return {
    movimento: {
      contasNovas,
      acessos,
      pessoasQueEntraram: pessoas.size,
      leadsNovos: leadsNovos.count ?? 0,
      processosNovos: processosNovos.count ?? 0,
      documentosEnviados: docsNovos.count ?? 0,
      mensagensTrocadas: msgsNovas.count ?? 0,
      etapasConcluidas: etapasFeitas.count ?? 0,
    },
    profissionaisPendentes: (profs.data ?? []).map((p) => ({
      nome: p.name ?? "Sem nome",
      desde: p.created_at,
    })),
    aprovacoesPendentes: (aprovacoes.data ?? []).map((a) => ({
      tipo: a.tipo,
      processo: `#${a.property_id.slice(0, 8).toUpperCase()}`,
      desde: a.solicitado_em,
    })),
    processosParados: (props.data ?? []).map((p) => ({
      id: p.id,
      nome: p.name,
      etapa: p.current_stage ?? 1,
      paradoDesde: p.updated_at,
      cliente: p.client_name ?? "Cliente",
      clienteUltimoAcesso: p.client_id ? (acessoPorCliente.get(p.client_id) ?? null) : null,
      documentosPendentes: pendPorProcesso.get(p.id) ?? 0,
    })),
    leadsSemResposta: (leads.data ?? []).map((l) => ({
      cidade: l.city,
      uf: l.state,
      desde: l.created_at,
    })),
    profissionaisInativos: (inativos.data ?? []).map((p) => ({
      nome: p.name ?? "Sem nome",
      processos: processosPorProf.get(p.id) ?? 0,
      ultimoAcesso: p.ultimo_acesso_em,
    })),
  };
}

export const gerarBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ forcar: z.boolean().optional().default(false) }))
  .handler(async ({ data, context }): Promise<Briefing> => {
    // Papel vem do banco, nunca do cliente.
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!roles?.some((r) => r.role === "admin")) {
      throw new Error("Apenas administradores acessam o painel gerencial.");
    }

    const dia = hojeSP();
    const dados = await coletarDados();
    const assinatura = assinaturaBriefing(dados);

    // Os DADOS são sempre recém-lidos; só o texto vem guardado — assim os
    // números na tela nunca ficam velhos. O texto é refeito quando o que ele
    // descreve mudou (a assinatura), com um piso de 15 min entre gerações
    // automáticas. Regra e testes em `assinatura-briefing.ts`.
    //
    // Se a coluna `assinatura` ainda não existir (código publicado antes da
    // migração 20260924_briefing_assinatura.sql), a leitura cai para a forma
    // antiga com assinatura nula: o texto passa a ser refeito no máximo a cada
    // 15 min, em vez de a cada abertura.
    const lerGuardado = async () => {
      const comAssinatura = await supabaseAdmin
        .from("briefings_admin")
        .select("texto, fila, alertas, gerado_em, assinatura")
        .eq("dia", dia)
        .maybeSingle();
      if (!comAssinatura.error) return comAssinatura.data;
      const { data: linha } = await supabaseAdmin
        .from("briefings_admin")
        .select("texto, fila, alertas, gerado_em")
        .eq("dia", dia)
        .maybeSingle();
      return linha ? { ...linha, assinatura: null } : null;
    };
    const doGuardado = (linha: NonNullable<Awaited<ReturnType<typeof lerGuardado>>>) => ({
      texto: linha.texto,
      fila: linha.fila as ItemFila[],
      alertas: linha.alertas as string[],
      gerado_em: linha.gerado_em,
      dados,
    });

    const guardado = await lerGuardado();
    const decisao = decidirBriefing({
      forcar: data.forcar,
      guardado,
      assinaturaAtual: assinatura,
      agora: new Date(),
    });
    if (decisao === "usar-guardado" && guardado) return doGuardado(guardado);

    // Sem texto novo, o do dia (se houver) ainda é melhor que nenhum: ele vai
    // junto com o aviso, e os números ao lado mostram o que mudou desde então.
    const semTextoNovo = (erroIA: string): Briefing =>
      guardado
        ? { ...doGuardado(guardado), erroIA }
        : { texto: "", fila: [], alertas: [], gerado_em: new Date().toISOString(), dados, erroIA };

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return semTextoNovo("IA não configurada no servidor (ANTHROPIC_API_KEY ausente).");
    }

    // Concorrência: vários admins abrindo o painel juntos não podem disparar
    // várias chamadas de IA. Quem vai gerar primeiro "reserva" a vez com um
    // UPDATE condicional (compare-and-swap) em `gerado_em`: só passa se ela
    // ainda for a que foi lida. O Postgres serializa os UPDATEs da mesma
    // linha, então só um ganha; os outros voltam com o texto guardado — que,
    // com `gerado_em` recém-reservado, está dentro do piso de 15 min de
    // qualquer jeito.
    //
    // Limites, aceitos de propósito: (1) na PRIMEIRA geração do dia não há
    // linha para reservar, e dois admins no mesmo segundo podem gerar os dois
    // (o upsert final deixa um só); (2) durante os ~10 s da chamada, o texto
    // antigo aparece com o horário da reserva. O botão "Atualizar" não
    // reserva: é pedido explícito.
    let reserva: { anterior: string; marcado: string } | null = null;
    if (guardado && !data.forcar) {
      const marcado = new Date().toISOString();
      const { data: reservadas } = await supabaseAdmin
        .from("briefings_admin")
        .update({ gerado_em: marcado })
        .eq("dia", dia)
        .eq("gerado_em", guardado.gerado_em)
        .select("dia");
      if (!reservadas || reservadas.length === 0) {
        // Outro admin chegou antes e está gerando (ou já gerou).
        const atual = await lerGuardado();
        return doGuardado(atual ?? guardado);
      }
      reserva = { anterior: guardado.gerado_em, marcado };
    }

    const resumo = montarResumo(dados, new Date());

    let texto = "";
    let fila: ItemFila[] = [];
    let alertas: string[] = [];
    const inicio = Date.now();

    try {
      const cliente = new Anthropic({ apiKey });
      const resposta = await cliente.messages.parse(
        {
          model: MODELO_IA,
          max_tokens: 4000,
          // O briefing é curto e a entrada é um resumo pequeno. Esforço baixo
          // entrega o mesmo texto por uma fração do tempo e do custo.
          output_config: {
            // `effort` só vai quando o modelo aceita: no Haiku 4.5 ele é
            // recusado e a chamada inteira falha.
            ...(aceitaEsforco() ? { effort: "low" as const } : {}),
            format: jsonSchemaOutputFormat(FORMATO_BRIEFING),
          },
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: resumo }],
        },
        {
          // Prazo do lado do cliente. O limite da Vercel é 60s, e o painel já
          // mostra os números do banco mesmo quando a análise não vem.
          timeout: 45_000,
        },
      );

      console.log(`[briefing] IA respondeu em ${Date.now() - inicio}ms`);

      // `parsed_output` vem nulo se a validação falhar — o schema garante o
      // formato, mas não que a resposta exista.
      const saida = resposta.parsed_output;
      if (!saida) throw new Error("resposta fora do formato esperado");

      texto = saida.texto;
      fila = saida.fila.slice(0, 6);
      alertas = saida.alertas;
    } catch (e) {
      // Devolvemos os dados mesmo assim: a lista de pendências não depende da
      // IA, e é justamente quando a análise falha que ela mais importa.
      console.error(`[briefing] falha ao chamar a IA após ${Date.now() - inicio}ms:`, e);
      avisarErro("briefing do painel", e);

      // Devolve o horário original à linha reservada: sem isto, o texto velho
      // ficaria marcado como recente e a próxima tentativa esperaria 15 min.
      if (reserva) {
        await supabaseAdmin
          .from("briefings_admin")
          .update({ gerado_em: reserva.anterior })
          .eq("dia", dia)
          .eq("gerado_em", reserva.marcado);
      }

      const ehPrazo = e instanceof Anthropic.APIConnectionTimeoutError;
      return semTextoNovo(
        ehPrazo
          ? "A análise demorou demais e foi interrompida. Tente de novo."
          : "Não foi possível gerar a análise agora.",
      );
    }

    const gerado_em = new Date().toISOString();
    const { error: erroGravar } = await supabaseAdmin
      .from("briefings_admin")
      .upsert({ dia, texto, fila, alertas, gerado_em, assinatura }, { onConflict: "dia" });
    if (erroGravar) {
      // Mesma rede de segurança da leitura: sem a coluna, grava sem ela —
      // senão o texto nunca ficaria guardado e cada abertura chamaria a IA.
      await supabaseAdmin
        .from("briefings_admin")
        .upsert({ dia, texto, fila, alertas, gerado_em }, { onConflict: "dia" });
    }

    return { texto, fila, alertas, gerado_em, dados };
  });
