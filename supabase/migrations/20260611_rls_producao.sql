-- ================================================================
-- RLS PRODUÇÃO — Ato Regulariza — SEGURANÇA MÁXIMA  (v3)
-- ----------------------------------------------------------------
-- v3: cria enum app_role + tabela user_roles antes de tudo,
--     caso ainda não existam no banco.
-- ================================================================

-- ---------------------------------------------------------------
-- PRÉ-REQUISITO: enum app_role
-- ---------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'app_role' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'cliente');
  END IF;
END $$;

-- ---------------------------------------------------------------
-- PRÉ-REQUISITO: tabela user_roles
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role    public.app_role NOT NULL,
  UNIQUE  (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Política básica de user_roles: cada um vê só o próprio papel
-- (is_admin() não existe ainda; service_role gerencia via dashboard)
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------
-- 0) Garantir RLS ativo nas 5 tabelas
-- ---------------------------------------------------------------
ALTER TABLE public.properties     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------
-- 1) REMOVER políticas permissivas de dev (CRÍTICO)
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "dev_all_properties" ON public.properties;
DROP POLICY IF EXISTS "dev_all_stages"     ON public.process_stages;
DROP POLICY IF EXISTS "dev_all_documents"  ON public.documents;
DROP POLICY IF EXISTS "dev_all_messages"   ON public.messages;
DROP POLICY IF EXISTS "dev_all_profiles"   ON public.profiles;

-- ---------------------------------------------------------------
-- 2) Privilégios: anon = zero, authenticated = acesso filtrado por RLS
-- ---------------------------------------------------------------
REVOKE ALL ON public.properties     FROM anon;
REVOKE ALL ON public.process_stages FROM anon;
REVOKE ALL ON public.documents      FROM anon;
REVOKE ALL ON public.messages       FROM anon;
REVOKE ALL ON public.profiles       FROM anon;
REVOKE ALL ON public.user_roles     FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.process_stages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles       TO authenticated;
GRANT SELECT                         ON public.user_roles     TO authenticated;

-- ---------------------------------------------------------------
-- 3) Funções helper (SECURITY DEFINER — sem recursão de RLS)
-- ---------------------------------------------------------------

-- is_admin(): cast explícito do enum (evita erro 42883)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- can_access_property(): dono, profissional atribuído ou admin
CREATE OR REPLACE FUNCTION public.can_access_property(_property_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = _property_id
      AND ( p.client_id = auth.uid()
            OR p.assigned_professional_id = auth.uid()
            OR public.is_admin() )
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_access_property(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_access_property(uuid) TO authenticated, service_role;

-- can_manage_property(): profissional atribuído ou admin
CREATE OR REPLACE FUNCTION public.can_manage_property(_property_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = _property_id
      AND ( p.assigned_professional_id = auth.uid()
            OR public.is_admin() )
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_manage_property(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_manage_property(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------
-- 4) PROPERTIES
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "properties_select" ON public.properties;
DROP POLICY IF EXISTS "properties_insert" ON public.properties;
DROP POLICY IF EXISTS "properties_update" ON public.properties;
DROP POLICY IF EXISTS "properties_delete" ON public.properties;

CREATE POLICY "properties_select" ON public.properties FOR SELECT TO authenticated
  USING ( client_id = auth.uid() OR assigned_professional_id = auth.uid() OR public.is_admin() );
CREATE POLICY "properties_insert" ON public.properties FOR INSERT TO authenticated
  WITH CHECK ( public.is_admin() );
CREATE POLICY "properties_update" ON public.properties FOR UPDATE TO authenticated
  USING ( assigned_professional_id = auth.uid() OR public.is_admin() )
  WITH CHECK ( assigned_professional_id = auth.uid() OR public.is_admin() );
CREATE POLICY "properties_delete" ON public.properties FOR DELETE TO authenticated
  USING ( public.is_admin() );

-- ---------------------------------------------------------------
-- 5) PROCESS_STAGES
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "stages_select" ON public.process_stages;
DROP POLICY IF EXISTS "stages_insert" ON public.process_stages;
DROP POLICY IF EXISTS "stages_update" ON public.process_stages;
DROP POLICY IF EXISTS "stages_delete" ON public.process_stages;

CREATE POLICY "stages_select" ON public.process_stages FOR SELECT TO authenticated
  USING ( public.can_access_property(property_id) );
CREATE POLICY "stages_insert" ON public.process_stages FOR INSERT TO authenticated
  WITH CHECK ( public.can_manage_property(property_id) );
CREATE POLICY "stages_update" ON public.process_stages FOR UPDATE TO authenticated
  USING ( public.can_manage_property(property_id) )
  WITH CHECK ( public.can_manage_property(property_id) );
CREATE POLICY "stages_delete" ON public.process_stages FOR DELETE TO authenticated
  USING ( public.is_admin() );

-- ---------------------------------------------------------------
-- 6) DOCUMENTS
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "documents_select" ON public.documents;
DROP POLICY IF EXISTS "documents_insert" ON public.documents;
DROP POLICY IF EXISTS "documents_update" ON public.documents;
DROP POLICY IF EXISTS "documents_delete" ON public.documents;

CREATE POLICY "documents_select" ON public.documents FOR SELECT TO authenticated
  USING ( public.can_access_property(property_id) );
CREATE POLICY "documents_insert" ON public.documents FOR INSERT TO authenticated
  WITH CHECK ( public.can_access_property(property_id) );
CREATE POLICY "documents_update" ON public.documents FOR UPDATE TO authenticated
  USING ( public.can_manage_property(property_id) )
  WITH CHECK ( public.can_manage_property(property_id) );
CREATE POLICY "documents_delete" ON public.documents FOR DELETE TO authenticated
  USING ( public.is_admin() );

-- ---------------------------------------------------------------
-- 7) MESSAGES (imutáveis: sem UPDATE; DELETE só admin)
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "messages_delete" ON public.messages;

CREATE POLICY "messages_select" ON public.messages FOR SELECT TO authenticated
  USING ( public.can_access_property(property_id) );
CREATE POLICY "messages_insert" ON public.messages FOR INSERT TO authenticated
  WITH CHECK ( public.can_access_property(property_id) );
CREATE POLICY "messages_delete" ON public.messages FOR DELETE TO authenticated
  USING ( public.is_admin() );

-- ---------------------------------------------------------------
-- 8) PROFILES
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING ( id = auth.uid() OR public.is_admin() );
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK ( id = auth.uid() OR public.is_admin() );
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated
  USING ( id = auth.uid() OR public.is_admin() )
  WITH CHECK ( id = auth.uid() OR public.is_admin() );
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE TO authenticated
  USING ( public.is_admin() );

-- ---------------------------------------------------------------
-- 9) PROMOVER ozanchet@gmail.com a admin
-- ---------------------------------------------------------------
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'ozanchet@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- ---------------------------------------------------------------
-- 10) VERIFICAÇÃO (descomente para checar após rodar)
-- SELECT tablename, policyname, roles, cmd FROM pg_policies
-- WHERE tablename IN ('properties','process_stages','documents','messages','profiles','user_roles')
-- ORDER BY tablename, cmd;
-- ---------------------------------------------------------------
