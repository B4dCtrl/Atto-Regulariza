-- ================================================================
-- SENHA PROVISÓRIA — 2026-08-22
-- ----------------------------------------------------------------
-- Conta criada pelo admin nasce com senha gerada, que o admin repassa. Enquanto
-- essa senha estiver valendo, o painel exige a troca antes de qualquer coisa.
--
-- POR QUE UMA COLUNA, E NÃO "ele que se vire"
--   Sem marca, não há como distinguir quem já trocou de quem continua usando a
--   senha que passou por WhatsApp. Uma senha que trafegou fora do sistema e
--   nunca foi trocada é uma senha conhecida por mais de uma pessoa.
--
-- QUEM PODE DESMARCAR
--   Só o próprio dono, e só ao trocar a senha. A política de UPDATE de profiles
--   já limita cada um ao próprio registro; o gatilho abaixo impede que alguém
--   desmarque sem passar pela troca — desmarcar à mão devolveria o acesso sem
--   trocar nada.
--
-- Idempotente — seguro rodar mais de uma vez.
-- Rodar em: Supabase › SQL Editor › New Query › Run (selecione tudo antes)
-- ================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS senha_provisoria boolean NOT NULL DEFAULT false;


-- ---------------------------------------------------------------
-- Desmarcar exige ter trocado a senha de verdade.
--
-- `auth.users.updated_at` muda quando a senha é alterada. Exigimos que a
-- alteração tenha acontecido nos últimos 2 minutos: é folgado para a viagem
-- entre trocar a senha e gravar o perfil, e curto o bastante para não servir
-- de brecha permanente.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ao_baixar_senha_provisoria()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- service_role (a server function do admin) passa direto.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  IF OLD.senha_provisoria AND NOT NEW.senha_provisoria THEN
    IF NOT EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = NEW.id
        AND u.updated_at > now() - interval '2 minutes'
    ) THEN
      RAISE EXCEPTION 'Troque a senha antes de continuar';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ao_baixar_senha_provisoria ON public.profiles;
CREATE TRIGGER trg_ao_baixar_senha_provisoria
  BEFORE UPDATE OF senha_provisoria ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ao_baixar_senha_provisoria();


-- ================================================================
-- VERIFICAÇÃO — todas as linhas devem sair 'OK'.
-- ================================================================
SELECT 'coluna senha_provisoria existe' AS verificacao,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='profiles'
           AND column_name='senha_provisoria'
       ) THEN 'OK' ELSE 'FALHA' END AS resultado
UNION ALL
SELECT 'gatilho da troca instalado',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_trigger
         WHERE tgrelid='public.profiles'::regclass
           AND tgname='trg_ao_baixar_senha_provisoria'
       ) THEN 'OK' ELSE 'FALHA' END
UNION ALL
SELECT 'gatilho e SECURITY DEFINER com search_path fixo',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_proc
         WHERE oid='public.ao_baixar_senha_provisoria()'::regprocedure
           AND prosecdef AND 'search_path=public' = ANY(proconfig)
       ) THEN 'OK' ELSE 'FALHA' END;
