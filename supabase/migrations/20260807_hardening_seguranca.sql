-- ================================================================
-- HARDENING DE SEGURANÇA — Ato Regulariza — 2026-08-07
-- ----------------------------------------------------------------
-- Corrige, na ordem da auditoria:
--   1) Cota de uso da IA por usuário (a edge function gasta créditos pagos)
--   2) Escalação de privilégio: usuário se auto-promovia a 'profissional'
--      editando a própria linha em profiles. Agora papel é imutável para
--      não-admin e profissional novo entra como 'pendente' até aprovação.
--   4) Tabela leads: flood anônimo sem limite de tamanho nem de frequência
--
-- Idempotente — seguro rodar mais de uma vez.
-- Rodar em: Supabase › SQL Editor › New Query › Run
-- ================================================================


-- ================================================================
-- 1) COTA DE USO DA IA
-- ================================================================

CREATE TABLE IF NOT EXISTS public.ai_usage (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_user_time_idx
  ON public.ai_usage (user_id, created_at DESC);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Ninguém lê nem escreve direto: só a função SECURITY DEFINER abaixo mexe nisso.
REVOKE ALL ON public.ai_usage FROM anon, authenticated;

DROP POLICY IF EXISTS "ai_usage_select_admin" ON public.ai_usage;
CREATE POLICY "ai_usage_select_admin" ON public.ai_usage FOR SELECT TO authenticated
  USING ( public.is_admin() );
GRANT SELECT ON public.ai_usage TO authenticated;

-- Registra uma chamada e devolve false se o usuário estourou a cota da última hora.
CREATE OR REPLACE FUNCTION public.consume_ai_quota(_limit_per_hour int DEFAULT 60)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user  uuid := auth.uid();
  v_count int;
BEGIN
  IF v_user IS NULL THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.ai_usage
  WHERE user_id = v_user
    AND created_at > now() - interval '1 hour';

  IF v_count >= _limit_per_hour THEN
    RETURN false;
  END IF;

  INSERT INTO public.ai_usage (user_id) VALUES (v_user);
  RETURN true;
END $$;

REVOKE EXECUTE ON FUNCTION public.consume_ai_quota(int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.consume_ai_quota(int) TO authenticated, service_role;

-- Limpeza: registros com mais de 7 dias não servem para nada.
CREATE OR REPLACE FUNCTION public.purge_old_ai_usage()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.ai_usage WHERE created_at < now() - interval '7 days';
$$;
REVOKE EXECUTE ON FUNCTION public.purge_old_ai_usage() FROM PUBLIC, anon, authenticated;


-- ================================================================
-- 2) FIM DA ESCALAÇÃO DE PRIVILÉGIO EM profiles
-- ================================================================

-- Estado de aprovação do profissional. Cliente nasce aprovado (não há o que aprovar).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'approval_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.approval_status AS ENUM ('pendente', 'aprovado', 'recusado');
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS approval_status public.approval_status NOT NULL DEFAULT 'aprovado',
  ADD COLUMN IF NOT EXISTS approval_note   text,
  ADD COLUMN IF NOT EXISTS approved_at     timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Perfis de profissional que já existiam continuam valendo — não derrubar quem já trabalha.
UPDATE public.profiles
   SET approval_status = 'aprovado'
 WHERE role = 'profissional' AND approval_status IS DISTINCT FROM 'aprovado';

-- ---------------------------------------------------------------
-- Contexto confiável: sem auth.uid() a chamada NÃO vem de um navegador.
-- Só service_role (server functions), o trigger de signup e o SQL Editor
-- chegam nessa situação — a RLS de profiles já barra anon por completo
-- (REVOKE ALL ... FROM anon na migração de produção).
-- Sem esta checagem, as server functions do admin e o próprio cadastro
-- quebrariam: auth.uid() seria NULL e o papel cairia para 'cliente'.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_trusted_context()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NULL
$$;
REVOKE EXECUTE ON FUNCTION public.is_trusted_context() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_trusted_context() TO authenticated, service_role;

-- ---------------------------------------------------------------
-- INSERT: quem não é admin não escolhe o próprio papel de forma livre.
-- Cadastro de profissional é aceito, mas entra como 'pendente'.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_profile_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_trusted_context() OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Ninguém cria perfil para outra pessoa.
  IF NEW.id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Não é permitido criar perfil de outro usuário';
  END IF;

  IF NEW.role = 'profissional' THEN
    NEW.approval_status := 'pendente';
    NEW.approved_at     := NULL;
    NEW.approved_by     := NULL;
  ELSE
    -- Qualquer outro valor cai para cliente: bloqueia 'admin' e papéis inventados.
    NEW.role            := 'cliente';
    NEW.approval_status := 'aprovado';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_profile_insert ON public.profiles;
CREATE TRIGGER trg_enforce_profile_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_insert();

-- ---------------------------------------------------------------
-- UPDATE: papel e estado de aprovação são imutáveis para não-admin.
-- Era aqui que qualquer cliente virava profissional.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_profile_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_trusted_context() THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    -- Admin mudou a decisão: carimba quem aprovou e quando.
    IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
      NEW.approved_at := now();
      NEW.approved_by := auth.uid();
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Alteração de papel não permitida';
  END IF;
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    RAISE EXCEPTION 'Alteração do estado de aprovação não permitida';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Alteração de identificador não permitida';
  END IF;

  -- Campos de auditoria também não são do usuário.
  NEW.approved_at := OLD.approved_at;
  NEW.approved_by := OLD.approved_by;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_profile_update ON public.profiles;
CREATE TRIGGER trg_enforce_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_update();

-- ---------------------------------------------------------------
-- Leitura: só profissional APROVADO fica visível aos demais usuários.
-- Antes bastava ter role='profissional' — e o próprio usuário definia isso.
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR ( role = 'profissional' AND approval_status = 'aprovado' )
    OR public.is_admin()
  );

-- Helper para o front: o profissional está liberado para trabalhar?
CREATE OR REPLACE FUNCTION public.is_approved_professional()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'profissional'
      AND approval_status = 'aprovado'
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_approved_professional() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_approved_professional() TO authenticated, service_role;

-- ---------------------------------------------------------------
-- Perfil criado no momento do signup, direto no banco.
--
-- Antes o perfil era criado pelo navegador logo após signUp(). Com
-- confirmação de e-mail ligada não há sessão nesse instante, a RLS barrava
-- o INSERT e o profissional ficava sem linha em profiles — dependendo de um
-- "auto-reparo" no primeiro acesso ao painel que a nova guarda de rota
-- (só profissional aprovado entra) nunca mais alcançaria.
--
-- O papel vem de raw_user_meta_data, que o cliente controla no signup — por
-- isso é SANEADO aqui: só 'profissional' é aceito além de cliente, e sempre
-- como 'pendente'. Ninguém nasce admin nem aprovado por esse caminho.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_meta_role text := coalesce(NEW.raw_user_meta_data ->> 'role', 'cliente');
  v_name      text := nullif(trim(coalesce(NEW.raw_user_meta_data ->> 'name', '')), '');
  v_is_prof   boolean := (v_meta_role = 'profissional');
  v_initials  text;
BEGIN
  v_initials := upper(left(regexp_replace(coalesce(v_name, ''), '[^[:alpha:]]', '', 'g'), 2));

  INSERT INTO public.profiles (id, name, email, initials, role, approval_status)
  VALUES (
    NEW.id,
    v_name,
    NEW.email,
    nullif(v_initials, ''),
    CASE WHEN v_is_prof THEN 'profissional' ELSE 'cliente' END,
    CASE WHEN v_is_prof THEN 'pendente' ELSE 'aprovado' END::public.approval_status
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_handle_new_user ON auth.users;
CREATE TRIGGER trg_handle_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: usuários antigos que ficaram sem linha em profiles.
INSERT INTO public.profiles (id, name, email, role, approval_status)
SELECT u.id,
       nullif(trim(coalesce(u.raw_user_meta_data ->> 'name', '')), ''),
       u.email,
       CASE WHEN u.raw_user_meta_data ->> 'role' = 'profissional' THEN 'profissional' ELSE 'cliente' END,
       CASE WHEN u.raw_user_meta_data ->> 'role' = 'profissional' THEN 'pendente' ELSE 'aprovado' END::public.approval_status
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------
-- Profissional pendente não pode ser designado a um processo.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_assigned_professional()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assigned_professional_id IS NOT NULL
     AND NEW.assigned_professional_id IS DISTINCT FROM OLD.assigned_professional_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = NEW.assigned_professional_id
        AND role = 'profissional'
        AND approval_status = 'aprovado'
    ) THEN
      RAISE EXCEPTION 'Profissional não aprovado não pode receber processos';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_assigned_professional ON public.properties;
CREATE TRIGGER trg_enforce_assigned_professional
  BEFORE INSERT OR UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.enforce_assigned_professional();


-- ================================================================
-- 4) TABELA leads: limites de tamanho e de frequência
-- ================================================================

-- As constraints abaixo entram como NOT VALID de propósito: valem para tudo que
-- for inserido daqui em diante, sem tocar no que já está gravado. Truncar ou
-- apagar lead antigo seria destruir contato comercial real por causa de um
-- formato — a decisão sobre esses registros é do time, não da migração.

-- NOT VALID: passa a valer para tudo que ENTRAR daqui em diante, sem exigir que
-- as linhas já existentes estejam corretas. É o que importa para segurança — o
-- objetivo é barrar lixo novo, não apagar lead antigo de cliente em potencial.
-- Depois de limpar os registros ruins, rode para ativar a checagem retroativa:
--   ALTER TABLE public.leads VALIDATE CONSTRAINT leads_email_ck;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_email_ck') THEN
    ALTER TABLE public.leads ADD CONSTRAINT leads_email_ck
      CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' AND length(email) <= 200)
      NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_len_ck') THEN
    ALTER TABLE public.leads ADD CONSTRAINT leads_len_ck CHECK (
      (name        IS NULL OR length(name)        <= 120)  AND
      (phone       IS NULL OR length(phone)       <= 30)   AND
      (city        IS NULL OR length(city)        <= 120)  AND
      (state       IS NULL OR length(state)       <= 40)   AND
      (tipo_imovel IS NULL OR length(tipo_imovel) <= 80)   AND
      (situacao    IS NULL OR length(situacao)    <= 200)  AND
      (objetivo    IS NULL OR length(objetivo)    <= 200)  AND
      (urgencia    IS NULL OR length(urgencia)    <= 40)   AND
      (notes       IS NULL OR length(notes)       <= 2000) AND
      (source      IS NULL OR length(source)      <= 60)
    ) NOT VALID;
  END IF;
END $$;

-- O formulário é público: sem limite de frequência vira vetor de flood.
CREATE OR REPLACE FUNCTION public.leads_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_recent int;
BEGIN
  SELECT count(*) INTO v_recent
  FROM public.leads
  WHERE email = NEW.email
    AND created_at > now() - interval '1 hour';

  IF v_recent >= 3 THEN
    RAISE EXCEPTION 'Muitos envios para este e-mail. Tente novamente mais tarde.';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_leads_rate_limit ON public.leads;
CREATE TRIGGER trg_leads_rate_limit
  BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.leads_rate_limit();

CREATE INDEX IF NOT EXISTS leads_email_time_idx ON public.leads (email, created_at DESC);

-- Anônimo insere, mas nunca lê: reafirma o grant mínimo.
REVOKE ALL    ON public.leads FROM anon;
GRANT  INSERT ON public.leads TO   anon;


-- ================================================================
-- VERIFICAÇÃO (descomente para conferir depois de rodar)
-- ----------------------------------------------------------------
-- SELECT tgname, tgrelid::regclass FROM pg_trigger
--   WHERE NOT tgisinternal ORDER BY tgrelid::regclass::text;
-- SELECT policyname, tablename, cmd FROM pg_policies
--   WHERE tablename IN ('profiles','leads','ai_usage') ORDER BY tablename;
-- ================================================================
