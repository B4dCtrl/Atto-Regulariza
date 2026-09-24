import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Confere no banco que quem chamou é admin.
 *
 * O papel vem de `user_roles`, nunca do token nem do `user_metadata` — esses o
 * próprio usuário consegue influenciar. Falha do banco conta como "não": na
 * dúvida, fecha.
 */
export async function exigirAdmin(userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error || !data?.some((r) => r.role === "admin")) {
    throw new Error("Acesso negado.");
  }
}
