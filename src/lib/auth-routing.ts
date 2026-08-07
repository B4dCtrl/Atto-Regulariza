import { supabase } from "@/integrations/supabase/client";

export type LandingPath =
  | "/admin"
  | "/painel-profissional"
  | "/dashboard"
  | "/cursos"
  | "/analise-cadastro";

/**
 * Decide para onde um usuário autenticado deve ir, com base no seu papel:
 * - comprou curso (course_access) → /cursos (prioridade — público diferente
 *   do cliente/admin/profissional; não mostra as demais funções da Ato)
 * - admin (user_roles)            → /admin
 * - profissional aprovado         → /painel-profissional
 * - profissional pendente/recusado → tela de análise
 * - cliente (padrão)               → /dashboard
 *
 * SEGURANÇA: o papel vem SOMENTE de tabelas protegidas por RLS
 * (user_roles, profiles). Nunca de `user_metadata` — esse campo é gravável
 * pelo próprio cliente via supabase.auth.updateUser(), então confiar nele
 * permitia qualquer usuário se declarar profissional.
 */
export async function resolveLandingPath(userId: string): Promise<LandingPath> {
  const [{ data: roles }, { data: profile }, { data: courseAccess }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("profiles").select("role, approval_status").eq("id", userId).maybeSingle(),
    supabase.from("course_access").select("course_id").eq("user_id", userId).limit(1),
  ]);

  if (courseAccess && courseAccess.length > 0) return "/cursos";

  if (roles?.some((r) => r.role === "admin")) return "/admin";

  if (profile?.role === "profissional") {
    return profile.approval_status === "aprovado" ? "/painel-profissional" : "/analise-cadastro";
  }

  return "/dashboard";
}
