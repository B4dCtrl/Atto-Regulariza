-- ================================================================
-- ACEITE DOS TERMOS — 2026-08-24
-- ----------------------------------------------------------------
-- Guarda no cadastro do cliente qual versão dos termos ele aceitou e quando.
--
-- POR QUE A VERSÃO, E NÃO SÓ UM "aceitou: sim"
--   Sem a versão você sabe que houve concordância, mas não com QUAL texto — e
--   o texto muda. Numa discussão, "ele aceitou" sem dizer o quê não sustenta.
--
-- O QUE ESTA ESCOLHA NÃO GUARDA
--   Colunas no perfil guardam o ÚLTIMO aceite. Se os termos mudarem e a pessoa
--   aceitar a versão nova, o registro do aceite anterior é sobrescrito. Foi
--   decisão do usuário (2026-08-24), consciente, para não criar tabela.
--
-- Idempotente — seguro rodar mais de uma vez.
-- Rodar em: Supabase › SQL Editor › New Query › Run (selecione tudo antes)
-- ================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS termos_versao    text,
  ADD COLUMN IF NOT EXISTS termos_aceito_em timestamptz;


-- ---------------------------------------------------------------
-- O aceite não se apaga.
--
-- Aceite que pode ser removido não é prova. Uma vez gravado, só avança para
-- outra versão — nunca volta a nulo. service_role (migração, suporte) passa.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ao_alterar_aceite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  IF OLD.termos_versao IS NOT NULL AND NEW.termos_versao IS NULL THEN
    RAISE EXCEPTION 'O aceite dos termos não pode ser apagado';
  END IF;

  -- Data sempre acompanha a versão: uma sem a outra não prova nada.
  IF NEW.termos_versao IS DISTINCT FROM OLD.termos_versao
     AND NEW.termos_aceito_em IS NULL THEN
    RAISE EXCEPTION 'Aceite sem data não é registro válido';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ao_alterar_aceite ON public.profiles;
CREATE TRIGGER trg_ao_alterar_aceite
  BEFORE UPDATE OF termos_versao, termos_aceito_em ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ao_alterar_aceite();


-- ================================================================
-- VERIFICAÇÃO — todas as linhas devem sair 'OK'.
-- ================================================================
SELECT 'colunas de aceite existem' AS verificacao,
       CASE WHEN (SELECT count(*) FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='profiles'
                    AND column_name IN ('termos_versao','termos_aceito_em')) = 2
       THEN 'OK' ELSE 'FALHA' END AS resultado
UNION ALL
SELECT 'gatilho que impede apagar o aceite',
       CASE WHEN EXISTS (SELECT 1 FROM pg_trigger
         WHERE tgrelid='public.profiles'::regclass AND tgname='trg_ao_alterar_aceite')
       THEN 'OK' ELSE 'FALHA' END
UNION ALL
SELECT 'gatilho e SECURITY DEFINER com search_path fixo',
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc
         WHERE oid='public.ao_alterar_aceite()'::regprocedure
           AND prosecdef AND 'search_path=public' = ANY(proconfig))
       THEN 'OK' ELSE 'FALHA' END;
