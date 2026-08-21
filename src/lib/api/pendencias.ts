/**
 * Pendências — o que trava o caso.
 *
 * Criadas pela equipe, lidas também pelo cliente: é o que transforma
 * "falta o IPTU" em tarefa na tela dele, em vez de anotação perdida.
 *
 * Não há função para resolver do lado do cliente: quando ele envia o documento
 * do tipo pedido, um gatilho no banco fecha a pendência sozinho.
 */
import { supabase } from "@/integrations/supabase/client";
import { rotuloDoKind, type DocumentKind } from "@/lib/document-kinds";
import type { Tables } from "@/integrations/supabase/types";

export type Pendencia = Tables<"pendencies">;

/** Texto que o cliente lê. A descrição da equipe manda; o tipo é o reserva. */
export function textoDaPendencia(p: Pendencia): string {
  const descricao = p.descricao?.trim();
  if (descricao) return descricao;
  if (p.kind) return `Envie: ${rotuloDoKind(p.kind)}`;
  return "A equipe precisa de um documento seu";
}

export async function listarPendencias(
  propertyId: string,
  apenasAbertas = false,
): Promise<Pendencia[]> {
  let q = supabase
    .from("pendencies")
    .select("*")
    .eq("property_id", propertyId)
    .order("criada_em", { ascending: false });

  if (apenasAbertas) q = q.eq("status", "aberta");

  const { data, error } = await q;
  // Detalhe do Postgres não interessa a quem está na tela.
  if (error) throw new Error("Não foi possível carregar as pendências.");
  return data ?? [];
}

export async function criarPendencia(p: {
  propertyId: string;
  descricao: string;
  kind?: DocumentKind;
  stageNumber?: number;
}): Promise<Pendencia> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("pendencies")
    .insert({
      property_id: p.propertyId,
      descricao: p.descricao.trim(),
      kind: p.kind ?? null,
      stage_number: p.stageNumber ?? null,
      criada_por: user?.id ?? null,
    })
    .select()
    .single();

  if (error || !data) throw new Error("Não foi possível registrar a pendência.");
  return data;
}

export async function resolverPendencia(id: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("pendencies")
    .update({
      status: "resolvida",
      resolvida_em: new Date().toISOString(),
      resolvida_por: user?.id ?? null,
    })
    .eq("id", id);

  if (error) throw new Error("Não foi possível resolver a pendência.");
}

export async function reabrirPendencia(id: string): Promise<void> {
  const { error } = await supabase
    .from("pendencies")
    .update({ status: "aberta", resolvida_em: null, resolvida_por: null })
    .eq("id", id);

  if (error) throw new Error("Não foi possível reabrir a pendência.");
}
