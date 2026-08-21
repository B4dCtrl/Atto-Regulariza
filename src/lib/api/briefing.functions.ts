import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import process from "node:process";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { montarResumo, type DadosGerenciais } from "@/lib/api/resumo-gerencial";

const NIM_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-120b";

/** Um processo sem movimento por mais dias que isto entra no resumo. */
const DIAS_PARADO = 7;
/** Profissional sem acessar o painel por mais dias que isto é sinalizado. */
const DIAS_INATIVO = 5;

export type ItemFila = { titulo: string; motivo: string; destino: string };
export type Briefing = {
  texto: string;
  fila: ItemFila[];
  alertas: string[];
  gerado_em: string;
  dados: DadosGerenciais;
};

const SYSTEM_PROMPT = `Você escreve o briefing gerencial da Ato Regulariza, plataforma de regularização imobiliária.
Recebe um resumo com os dados JÁ APURADOS da operação e escreve para o administrador.

REGRAS:
- NUNCA invente número, nome, prazo ou fato que não esteja no resumo. Se algo não está lá, não existe.
- NUNCA estime nem complete o que falta.
- Escreva em português do Brasil, direto, sem saudação e sem despedida.
- O briefing tem no máximo 4 frases.

Responda SOMENTE com JSON válido, sem cercas de código, neste formato:
{"texto":"<o briefing>","fila":[{"titulo":"<a fazer>","motivo":"<por que é urgente>","destino":"<uma de: aprovacoes|processos|leads>"}],"alertas":["<o que está saindo do radar>"]}
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

  return {
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

    // Cache do dia. Os DADOS são sempre recém-lidos; só o texto vem guardado —
    // assim os números na tela nunca ficam velhos, mesmo com o briefing de
    // algumas horas atrás.
    if (!data.forcar) {
      const { data: cache } = await supabaseAdmin
        .from("briefings_admin")
        .select("texto, fila, alertas, gerado_em")
        .eq("dia", dia)
        .maybeSingle();
      if (cache) {
        return {
          texto: cache.texto,
          fila: cache.fila as ItemFila[],
          alertas: cache.alertas as string[],
          gerado_em: cache.gerado_em,
          dados,
        };
      }
    }

    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) throw new Error("Análise indisponível: IA não configurada no servidor.");

    const resumo = montarResumo(dados, new Date());

    let bruto = "";
    try {
      const res = await fetch(NIM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: process.env.NVIDIA_MODEL || DEFAULT_MODEL,
          temperature: 0.3,
          max_tokens: 900,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: resumo },
          ],
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      bruto = json?.choices?.[0]?.message?.content ?? "";
    } catch {
      throw new Error("Não foi possível gerar a análise agora.");
    }

    // O modelo às vezes embrulha o JSON em cercas de código, mesmo instruído a
    // não fazê-lo. Recortamos do primeiro { ao último } antes de interpretar.
    let texto = "";
    let fila: ItemFila[] = [];
    let alertas: string[] = [];
    try {
      const ini = bruto.indexOf("{");
      const fim = bruto.lastIndexOf("}");
      const parsed = JSON.parse(bruto.slice(ini, fim + 1));
      texto = String(parsed.texto ?? "");
      fila = Array.isArray(parsed.fila) ? parsed.fila.slice(0, 6) : [];
      alertas = Array.isArray(parsed.alertas) ? parsed.alertas.map(String) : [];
    } catch {
      // JSON quebrado não é motivo para deixar o admin sem nada: o texto cru
      // ainda diz algo, e as listas de dados na tela seguem corretas.
      texto = bruto.slice(0, 600);
    }

    const gerado_em = new Date().toISOString();
    await supabaseAdmin
      .from("briefings_admin")
      .upsert({ dia, texto, fila, alertas, gerado_em }, { onConflict: "dia" });

    return { texto, fila, alertas, gerado_em, dados };
  });
