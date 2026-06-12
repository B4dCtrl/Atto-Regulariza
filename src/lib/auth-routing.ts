import { supabase } from "@/integrations/supabase/client";

export type LandingPath = "/admin" | "/painel-profissional" | "/dashboard";

/**
 * Decide para onde um usuário autenticado deve ir, com base no seu papel:
 * - admin (user_roles)        → /admin
 * - profissional (profiles)   → /painel-profissional
 * - cliente (padrão)          → /dashboard
 *
 * Usado em todos os pontos de redirecionamento pós-login para manter o site coeso.
 */
export async function resolveLandingPath(userId: string): Promise<LandingPath> {
  const [{ data: roles }, { data: profile }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
  ]);

  if (roles?.some((r) => r.role === "admin")) return "/admin";
  if (profile?.role === "profissional") return "/painel-profissional";
  return "/dashboard";
}
