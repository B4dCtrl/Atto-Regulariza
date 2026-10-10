-- ================================================================
-- E-MAIL CONFIRMADO NA FILA DE APROVAÇÃO — 2026-10-10
-- ----------------------------------------------------------------
-- O perfil do profissional nasce 'pendente' no próprio cadastro, antes de o
-- e-mail ser confirmado. Um e-mail digitado errado (lauro@ato.com) entrava na
-- fila de aprovação mesmo sem nunca poder receber o link — e aprová-lo
-- liberaria uma conta que ninguém controla.
--
-- A confirmação mora em auth.users, que o navegador não lê. Esta função
-- devolve só o sim/não, e só para admin.
--
-- Idempotente — seguro rodar mais de uma vez.
-- Rodar em: Supabase › SQL Editor › New Query › Run (selecione tudo antes)
-- ================================================================

CREATE OR REPLACE FUNCTION public.emails_confirmados(_ids uuid[])
RETURNS TABLE (id uuid, confirmado boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.email_confirmed_at IS NOT NULL
  FROM auth.users u
  WHERE public.is_admin()
    AND u.id = ANY (_ids)
$$;

REVOKE EXECUTE ON FUNCTION public.emails_confirmados(uuid[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.emails_confirmados(uuid[]) TO authenticated;

-- Conferência: espera 'OK'.
SELECT CASE WHEN to_regprocedure('public.emails_confirmados(uuid[])') IS NULL
            THEN 'FALHA' ELSE 'OK' END AS emails_confirmados;
