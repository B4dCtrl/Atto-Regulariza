/**
 * Campos técnicos das etapas.
 *
 * Guardados em process_stages.fields (jsonb). A tabela é legível pelo cliente
 * de propósito: data de vistoria e número de protocolo são o andamento do caso
 * DELE. O que é interno vai para process_notes.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type CamposEtapa = Record<string, unknown>;

export async function carregarCampos(
  propertyId: string,
  stageNumber: number,
): Promise<CamposEtapa> {
  const { data, error } = await supabase
    .from("process_stages")
    .select("fields")
    .eq("property_id", propertyId)
    .eq("stage_number", stageNumber)
    .maybeSingle();

  if (error) throw new Error("Não foi possível carregar os dados da etapa.");
  return (data?.fields as CamposEtapa) ?? {};
}

export async function salvarCampos(
  propertyId: string,
  stageNumber: number,
  campos: CamposEtapa,
): Promise<void> {
  const { error } = await supabase
    .from("process_stages")
    .update({ fields: campos as Json, updated_at: new Date().toISOString() })
    .eq("property_id", propertyId)
    .eq("stage_number", stageNumber);

  if (error) throw new Error("Não foi possível salvar os dados da etapa.");
}

export type EstadoEtapa = "pending" | "active" | "done";

export interface EtapaResumo {
  stage_number: number;
  state: string;
  fields: Record<string, unknown>;
}

export async function carregarEtapas(propertyId: string): Promise<EtapaResumo[]> {
  const { data, error } = await supabase
    .from("process_stages")
    .select("stage_number, state, fields")
    .eq("property_id", propertyId)
    .order("stage_number");

  if (error) throw new Error("Não foi possível carregar as etapas.");
  return (data ?? []).map((e) => ({
    stage_number: e.stage_number,
    state: e.state,
    fields: (e.fields as Record<string, unknown>) ?? {},
  }));
}

export async function marcarEtapa(
  propertyId: string,
  stageNumber: number,
  estado: EstadoEtapa,
): Promise<void> {
  const { error } = await supabase
    .from("process_stages")
    .update({
      state: estado,
      completed_at: estado === "done" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("property_id", propertyId)
    .eq("stage_number", stageNumber);

  if (error) throw new Error("Não foi possível atualizar a etapa.");
}

/**
 * Números das etapas concluídas, em ordem.
 *
 * Função pura, separada da consulta, para o cálculo de progresso ser testável
 * sem banco — e porque o painel precisa dela em três lugares.
 */
export function etapasConcluidas(etapas: EtapaResumo[]): number[] {
  return etapas
    .filter((e) => e.state === "done")
    .map((e) => e.stage_number)
    .sort((a, b) => a - b);
}

export function progressoDasEtapas(etapas: EtapaResumo[], total = 5): number {
  if (total <= 0) return 0;
  const feitas = etapasConcluidas(etapas).length;
  return Math.min(100, Math.round((feitas / total) * 100));
}

/** Momento da última leitura do chat, ou null se nunca leu. */
export async function carregarLeituraChat(propertyId: string): Promise<string | null> {
  const { data } = await supabase
    .from("chat_reads")
    .select("lido_ate")
    .eq("property_id", propertyId)
    .maybeSingle();
  // Sem leitura registrada é estado normal, não erro: tudo conta como não lido.
  return data?.lido_ate ?? null;
}

export async function marcarChatLido(propertyId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("chat_reads")
    .upsert(
      { user_id: user.id, property_id: propertyId, lido_ate: new Date().toISOString() },
      { onConflict: "user_id,property_id" },
    );

  // Falhar aqui só desalinha o contador de não lidas; não vale quebrar a tela.
  if (error) console.warn("[chat] não foi possível marcar como lido:", error.message);
}
