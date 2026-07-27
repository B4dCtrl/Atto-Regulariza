import { supabase } from "@/integrations/supabase/client";

export type LandingPath = "/admin" | "/painel-profissional" | "/dashboard" | "/cursos";

/**
 * Decide para onde um usuário autenticado deve ir, com base no seu papel:
 * - comprou curso (course_access) → /cursos (prioridade — público diferente
 *   do cliente/admin/profissional; não mostra as demais funções da Ato)
 * - admin (user_roles)            → /admin
 * - profissional (profiles)       → /painel-profissional
 * - cliente (padrão)               → /dashboard
 *
 * Usado em todos os pontos de redirecionamento pós-login para manter o site coeso.
 */
export async function resolveLandingPath(userId: string): Promise<LandingPath> {
  const [{ data: roles }, { data: profile }, { data: userRes }, { data: courseAccess }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
    supabase.auth.getUser(),
    supabase.from("course_access").select("course_id").eq("user_id", userId).limit(1),
  ]);

  if (courseAccess && courseAccess.length > 0) return "/cursos";

  if (roles?.some((r) => r.role === "admin")) return "/admin";

  // Papel vem de profiles OU dos metadados do signup (confiável mesmo quando a
  // linha em profiles ainda não existe — ex.: signup com confirmação de e-mail).
  const metaRole = userRes?.user?.user_metadata?.role;
  if (profile?.role === "profissional" || metaRole === "profissional") return "/painel-profissional";

  return "/dashboard";
}
