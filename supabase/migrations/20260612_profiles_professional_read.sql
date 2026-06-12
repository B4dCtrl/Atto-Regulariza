-- ============================================================
-- Permite que qualquer usuário autenticado leia perfis de PROFISSIONAIS.
-- Necessário para:
--  - o cliente ver o nome/especialização do profissional designado ao seu caso
--  - o admin listar profissionais ao atribuir um processo
-- Perfis de cliente continuam privados (só o dono ou o admin veem).
-- Rodar em: Supabase › SQL Editor › New Query › Run
-- ============================================================

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR role = 'profissional'
    OR public.is_admin()
  );
