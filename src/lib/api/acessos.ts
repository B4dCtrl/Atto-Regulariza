import { supabase } from "@/integrations/supabase/client";

export type Painel = "cliente" | "profissional" | "admin";

/**
 * Marca que a pessoa entrou num painel.
 *
 * Nunca lança. O registro é telemetria: se falhar, quem está usando o sistema
 * não pode ser impedido de usá-lo por causa disso. O erro fica no console para
 * quem estiver depurando.
 *
 * A função no banco é SECURITY INVOKER e a política de INSERT exige
 * `user_id = auth.uid()` — ninguém registra acesso em nome de outro.
 */
export async function registrarAcesso(painel: Painel): Promise<void> {
  const { error } = await supabase.rpc("registrar_acesso", { _painel: painel });
  if (error) console.warn("[acessos] não foi possível registrar:", error.message);
}
