-- ================================================================
-- PAINEL GERENCIAL DO ADMIN — 2026-08-22
-- ----------------------------------------------------------------
-- Spec: docs/superpowers/specs/2026-08-21-painel-gerencial-design.md
-- Registro de acesso ao painel + cache do briefing diário.
-- Idempotente — seguro rodar mais de uma vez.
-- Rodar em: Supabase › SQL Editor › New Query › Run
-- ================================================================


-- ---------------------------------------------------------------
-- 1) ACESSOS — uma linha por entrada em um dos painéis
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.acessos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  painel     text NOT NULL,
  entrou_em  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT acessos_painel_ck CHECK (painel IN ('cliente','profissional','admin'))
);

CREATE INDEX IF NOT EXISTS acessos_user_idx ON public.acessos (user_id, entrou_em DESC);

ALTER TABLE public.acessos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.acessos FROM anon;
GRANT SELECT, INSERT ON public.acessos TO authenticated;

-- Leitura: só admin. O histórico de acesso de terceiros é dado de gestão.
DROP POLICY IF EXISTS "acessos_select" ON public.acessos;
CREATE POLICY "acessos_select" ON public.acessos FOR SELECT TO authenticated
  USING ( public.is_admin() OR user_id = auth.uid() );

-- Escrita: cada um registra só o PRÓPRIO acesso. Sem isto, qualquer usuário
-- poderia forjar acesso alheio e sujar o dado que o briefing usa.
DROP POLICY IF EXISTS "acessos_insert" ON public.acessos;
CREATE POLICY "acessos_insert" ON public.acessos FOR INSERT TO authenticated
  WITH CHECK ( user_id = auth.uid() );

-- Sem política de UPDATE/DELETE: registro de acesso não se edita nem se apaga.


-- ---------------------------------------------------------------
-- 2) Último acesso no perfil
--
-- Existe ALÉM da tabela de propósito. O briefing precisa do último acesso de
-- dezenas de pessoas numa consulta só; fazer isso sobre o histórico exigiria
-- um agregado a cada geração. Nulo = nunca entrou, que é como o cliente que
-- se cadastrou e abandonou aparece.
-- ---------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ultimo_acesso_em timestamptz;

CREATE OR REPLACE FUNCTION public.ao_registrar_acesso()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
  SET ultimo_acesso_em = NEW.entrou_em
  WHERE id = NEW.user_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ao_registrar_acesso ON public.acessos;
CREATE TRIGGER trg_ao_registrar_acesso
  AFTER INSERT ON public.acessos
  FOR EACH ROW EXECUTE FUNCTION public.ao_registrar_acesso();


-- ---------------------------------------------------------------
-- 3) Registrar acesso
--
-- Via função para o front não precisar montar o INSERT nem conhecer o
-- auth.uid(). A política de INSERT continua valendo — esta função é
-- INVOKER, não DEFINER: ela não contorna a RLS, só encurta a chamada.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_acesso(_painel text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  INSERT INTO public.acessos (user_id, painel)
  VALUES (auth.uid(), _painel)
$$;
REVOKE EXECUTE ON FUNCTION public.registrar_acesso(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.registrar_acesso(text) TO authenticated;


-- ---------------------------------------------------------------
-- 4) BRIEFINGS — cache diário
--
-- `dia` é a chave: uma linha por dia, e o UPSERT do botão "Atualizar"
-- substitui a do dia sem acumular lixo.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.briefings_admin (
  dia         date PRIMARY KEY DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  texto       text NOT NULL,
  fila        jsonb NOT NULL DEFAULT '[]'::jsonb,
  alertas     jsonb NOT NULL DEFAULT '[]'::jsonb,
  gerado_em   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.briefings_admin ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.briefings_admin FROM anon, authenticated;
-- Nenhuma permissão para `authenticated`: quem escreve e lê é a server
-- function, com service_role. Assim o briefing não vaza nem por engano de
-- consulta no front.


-- ================================================================
-- VERIFICAÇÃO — devolve uma linha por checagem, todas 'OK'.
-- ================================================================
SELECT 'tabela acessos existe' AS verificacao,
       CASE WHEN to_regclass('public.acessos') IS NULL THEN 'FALHA' ELSE 'OK' END AS resultado
UNION ALL
SELECT 'coluna ultimo_acesso_em existe',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='profiles'
           AND column_name='ultimo_acesso_em'
       ) THEN 'OK' ELSE 'FALHA' END
UNION ALL
SELECT 'gatilho de ultimo acesso instalado',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_trigger
         WHERE tgrelid='public.acessos'::regclass AND tgname='trg_ao_registrar_acesso'
       ) THEN 'OK' ELSE 'FALHA' END
UNION ALL
SELECT 'registrar_acesso e INVOKER (nao contorna RLS)',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_proc
         WHERE oid='public.registrar_acesso(text)'::regprocedure AND NOT prosecdef
       ) THEN 'OK' ELSE 'FALHA' END
UNION ALL
SELECT 'briefings_admin sem acesso para authenticated',
       CASE WHEN has_table_privilege('authenticated','public.briefings_admin','SELECT')
            THEN 'FALHA' ELSE 'OK' END;
