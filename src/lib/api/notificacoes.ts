/**
 * Notificações — o sino do painel.
 *
 * Nenhuma função cria notificação: elas nascem de gatilhos no banco, quando
 * chega mensagem, documento, pendência ou pedido de aprovação. Daqui só se lê
 * e se marca como lida.
 *
 * Não há filtro por usuário nas consultas: a RLS de notifications já restringe
 * a user_id = auth.uid(), e repetir o filtro no cliente só daria a falsa
 * impressão de que é ele quem protege.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Notificacao = Tables<"notifications">;

export async function listarNotificacoes(limite = 30): Promise<Notificacao[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("criada_em", { ascending: false })
    .limit(limite);

  if (error) throw new Error("Não foi possível carregar as notificações.");
  return data ?? [];
}

export async function contarNaoLidas(): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("lida", false);

  // Contador é enfeite: falhar aqui não deve quebrar a tela.
  if (error) return 0;
  return count ?? 0;
}

export async function marcarComoLida(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ lida: true }).eq("id", id);
  if (error) throw new Error("Não foi possível marcar como lida.");
}

export async function marcarTodasComoLidas(): Promise<void> {
  const { error } = await supabase.from("notifications").update({ lida: true }).eq("lida", false);
  if (error) throw new Error("Não foi possível marcar as notificações.");
}
