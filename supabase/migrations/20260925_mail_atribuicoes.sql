-- ================================================================
-- ATRIBUIÇÕES DA CAIXA DE E-MAIL — 2026-09-25
-- ----------------------------------------------------------------
-- "Atribuir a…" no /admin/mail: qualquer admin passa um e-mail para o
-- Gabriel, a Taís ou o Lauro, e ele aparece na caixa da pessoa com a etiqueta
-- "com Taís". O e-mail continua só na Hostinger; aqui fica apenas o par
-- Message-ID → pessoa.
--
-- A chave é o Message-ID (e não o UID do IMAP) porque ele viaja com a
-- mensagem: UID muda se ela trocar de pasta. O servidor lê o Message-ID da
-- própria mensagem — nunca do navegador — e o CHECK abaixo repete a validação
-- do código (`schemaMessageId`), porque o valor também vira termo de busca
-- IMAP.
--
-- Ninguém escreve aqui pelo navegador: só a server function `atribuirEmail`,
-- com service_role. Admin lê; os demais não veem nada.
--
-- Idempotente — seguro rodar mais de uma vez.
-- Rodar em: Supabase › SQL Editor › New Query › Run (selecione tudo antes)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.mail_atribuicoes (
  message_id    text PRIMARY KEY
                CHECK (
                  char_length(message_id) BETWEEN 5 AND 250
                  AND message_id ~ '^[!-~]+$'
                  AND message_id ~ '^<[^<>"[:space:]]+@[^<>"[:space:]]+>$'
                  -- Barra invertida fora do regex: dentro de colchete ela é
                  -- escape no Postgres, e a leitura ficaria ambígua.
                  AND strpos(message_id, chr(92)) = 0
                ),
  responsavel   text NOT NULL
                CHECK (responsavel IN (
                  'gabriel@atoregulariza.com.br',
                  'tais@atoregulariza.com.br',
                  'lauro@atoregulariza.com.br'
                )),
  atribuido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  atribuido_em  timestamptz NOT NULL DEFAULT now()
);

-- A caixa de cada pessoa busca as atribuições dela, mais recentes primeiro.
CREATE INDEX IF NOT EXISTS mail_atribuicoes_responsavel_idx
  ON public.mail_atribuicoes (responsavel, atribuido_em DESC);

ALTER TABLE public.mail_atribuicoes ENABLE ROW LEVEL SECURITY;

-- `public.is_admin()` e não `has_role`: `has_role` não existe em produção.
DROP POLICY IF EXISTS "admin lê atribuições" ON public.mail_atribuicoes;
CREATE POLICY "admin lê atribuições" ON public.mail_atribuicoes
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Sem política de INSERT/UPDATE/DELETE: com RLS ligada, isso fecha para todos
-- menos service_role.
REVOKE ALL ON public.mail_atribuicoes FROM anon;

-- `authenticated` ganha GRANT amplo por padrão no schema `public` (herdado do
-- template do Supabase); sem isto, INSERT/UPDATE/DELETE ficariam só atrás da
-- RLS (que já os bloqueia por não ter política), em vez de bloqueados nos
-- dois níveis. Escreve apenas quem usa a service_role (a server function).
REVOKE ALL ON public.mail_atribuicoes FROM authenticated;
GRANT SELECT ON public.mail_atribuicoes TO authenticated;

-- ----------------------------------------------------------------
-- Verificação: deve mostrar rls_ligada = true, 1 política (SELECT) e 0 linhas
-- na primeira vez.
-- ----------------------------------------------------------------
SELECT
  c.relrowsecurity AS rls_ligada,
  (SELECT count(*) FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'mail_atribuicoes') AS politicas,
  (SELECT string_agg(p.cmd, ', ') FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'mail_atribuicoes') AS comandos,
  (SELECT count(*) FROM public.mail_atribuicoes) AS linhas
FROM pg_class c
WHERE c.oid = 'public.mail_atribuicoes'::regclass;
