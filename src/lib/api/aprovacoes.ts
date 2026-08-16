/**
 * Pedidos de aprovação do admin.
 *
 * A regra é imposta por gatilho no banco: concluir processo e excluir
 * documento falham sem pedido aprovado. Estas funções só criam e decidem o
 * pedido — não são elas que garantem a regra, e é por isso que a garantia
 * sobrevive a qualquer chamada direta à API.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Aprovacao = Tables<"approval_requests">;
export type TipoAprovacao = "conclusao" | "exclusao_documento";

export async function pedirAprovacao(p: {
  propertyId: string;
  tipo: TipoAprovacao;
  documentId?: string;
  justificativa?: string;
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("approval_requests").insert({
    property_id: p.propertyId,
    tipo: p.tipo,
    document_id: p.documentId ?? null,
    justificativa: p.justificativa ?? null,
    solicitado_por: user?.id ?? null,
  });

  if (error) throw new Error("Não foi possível enviar o pedido.");
}

/**
 * Pedidos ainda por decidir.
 *
 * Sem filtro de papel na consulta: a RLS de approval_requests só devolve os
 * processos que o usuário gerencia, e o admin passa por `is_admin()` dentro
 * de `pode_gerenciar_processo`. Um profissional que chame isto vê apenas os
 * pedidos dos processos dele — inclusive os que ele mesmo abriu.
 */
export async function listarAprovacoesPendentes(): Promise<Aprovacao[]> {
  const { data, error } = await supabase
    .from("approval_requests")
    .select("*")
    .eq("status", "pendente")
    .order("solicitado_em", { ascending: false });

  if (error) throw new Error("Não foi possível carregar os pedidos.");
  return data ?? [];
}

export async function decidirAprovacao(
  id: string,
  aprovado: boolean,
  motivo?: string,
): Promise<void> {
  const { error } = await supabase
    .from("approval_requests")
    .update({
      status: aprovado ? "aprovado" : "recusado",
      motivo_recusa: aprovado ? null : (motivo ?? null),
    })
    .eq("id", id);

  // O gatilho recusa decidir de novo um pedido já decidido.
  if (error) throw new Error("Não foi possível registrar a decisão.");
}
