import { supabase } from "@/integrations/supabase/client";

export type LandingPath =
  | "/admin"
  | "/painel-profissional"
  | "/dashboard"
  | "/cursos"
  | "/analise-cadastro"
  | "/cadastrar";

/**
 * Decide para onde um usuário autenticado deve ir, com base no seu papel:
 * - comprou curso (course_access) → /cursos (prioridade — público diferente
 *   do cliente/admin/profissional; não mostra as demais funções da Ato)
 * - admin (user_roles)            → /admin
 * - profissional aprovado         → /painel-profissional
 * - profissional pendente/recusado → tela de análise
 * - cliente SEM imóvel             → /cadastrar (o wizard)
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

  // Cliente sem imóvel vai para o wizard, não para o painel vazio.
  //
  // É o caso de quem entra pelo Google: a conta nasce no primeiro login, sem
  // passar pelo cadastro, então não existe processo nenhum. Mandá-lo ao painel
  // mostrava uma tela que só constatava a falta. O wizard é onde o imóvel é
  // informado — e ele reconhece a sessão existente e pula a criação de conta.
  const { data: imovel } = await supabase
    .from("properties")
    .select("id")
    .eq("client_id", userId)
    .limit(1)
    .maybeSingle();
  if (imovel) return "/dashboard";

  // Sem imóvel, mas com o wizard já respondido: é quem se cadastrou com
  // confirmação de e-mail. Sem sessão no cadastro, o processo não pôde ser
  // criado ali; o intake ficou nos metadados e o painel o monta no 1º acesso
  // (self-heal em dashboard.tsx). Mandá-lo ao wizard fazia o cliente
  // responder tudo de novo a cada login, como se estivesse em loop.
  //
  // Ler `user_metadata` aqui não fere a regra acima: ele só escolhe entre
  // duas telas do próprio cliente, não concede papel nenhum.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.user_metadata?.intake ? "/dashboard" : "/cadastrar";
}
