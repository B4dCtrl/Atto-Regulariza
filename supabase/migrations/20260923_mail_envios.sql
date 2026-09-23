-- ================================================================
-- REGISTRO DE ENVIOS DA CAIXA DE E-MAIL — 2026-09-23
-- ----------------------------------------------------------------
-- A caixa contato@ é lida direto da Hostinger; nenhum e-mail é copiado para
-- cá. Só fica o registro de quem mandou o quê, por dois motivos: com quatro
-- admins na mesma caixa, saber quem já respondeu; e contar envios para o
-- limite de 30 por hora.
--
-- Ninguém escreve aqui pelo navegador: só a server function, com
-- service_role. Admin lê; os demais não veem nada.
--
-- Idempotente — seguro rodar mais de uma vez.
-- Rodar em: Supabase › SQL Editor › New Query › Run (selecione tudo antes)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.mail_envios (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  de                     text NOT NULL,
  para                   text[] NOT NULL,
  assunto                text NOT NULL,
  respondendo_message_id text,
  enviado_em             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mail_envios_user_enviado_idx
  ON public.mail_envios (user_id, enviado_em DESC);

ALTER TABLE public.mail_envios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin lê envios" ON public.mail_envios;
CREATE POLICY "admin lê envios" ON public.mail_envios
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Sem política de INSERT/UPDATE/DELETE: com RLS ligada, isso fecha para todos
-- menos service_role.
REVOKE ALL ON public.mail_envios FROM anon;
