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
