-- ================================================================
-- ADMINS DA EQUIPE — 2026-09-24
-- ----------------------------------------------------------------
-- Quem administra o site: o dono (ozanchet@gmail.com) e os três aliases
-- da caixa contato@ — gabriel@, tais@ e lauro@atoregulariza.com.br.
--
-- Duas partes:
--   1) quem já tem conta com esses e-mails vira admin agora;
--   2) quem ainda não tem vira admin sozinho ao CONFIRMAR o e-mail.
--
-- Por que só na confirmação: o e-mail de confirmação de um alias chega na
-- caixa contato@, que só a equipe lê. Quem se cadastrar com tais@ sem
-- acesso a essa caixa nunca confirma e nunca vira admin.
--
-- A lista é fixa aqui dentro, não numa tabela: mudar quem é admin exige
-- rodar SQL de novo, de propósito. O gatilho só olha a transição
-- "não confirmado -> confirmado"; se a confirmação de e-mail estiver
-- desligada no Supabase, a conta nasce confirmada, o gatilho não dispara
-- e ninguém vira admin sozinho (falha fechada — aí roda a parte 1 de novo).
--
-- Idempotente — seguro rodar mais de uma vez.
-- Rodar em: Supabase › SQL Editor › New Query › Run (selecione tudo antes)
-- ================================================================

-- A lista, num lugar só.
CREATE OR REPLACE FUNCTION public.email_da_equipe_admin(_email text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT lower(trim(_email)) IN (
    'ozanchet@gmail.com',
    'gabriel@atoregulariza.com.br',
    'tais@atoregulariza.com.br',
    'lauro@atoregulariza.com.br'
  )
$$;

REVOKE EXECUTE ON FUNCTION public.email_da_equipe_admin(text) FROM PUBLIC, anon, authenticated;

-- 1) Quem já existe e já confirmou.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE public.email_da_equipe_admin(email)
  AND email_confirmed_at IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 2) Quem confirmar daqui em diante.
CREATE OR REPLACE FUNCTION public.promover_admin_da_equipe()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.email_confirmed_at IS NULL
     AND NEW.email_confirmed_at IS NOT NULL
     AND public.email_da_equipe_admin(NEW.email) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.promover_admin_da_equipe() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_promover_admin_da_equipe ON auth.users;
CREATE TRIGGER trg_promover_admin_da_equipe
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.promover_admin_da_equipe();

-- Conferência: quem é admin hoje.
SELECT u.email, u.email_confirmed_at IS NOT NULL AS confirmado
FROM public.user_roles r
JOIN auth.users u ON u.id = r.user_id
WHERE r.role = 'admin'
ORDER BY u.email;
