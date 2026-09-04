-- ================================================================
-- ALERTA DE ERRO NO PAINEL DO ADMIN — 2026-09-03
-- ----------------------------------------------------------------
-- Falha de servidor passa a chegar ao sino do admin, em vez de morrer no log
-- da Vercel que ninguém abre.
--
-- O QUE ISTO NÃO COBRE
--   Só erro do SERVIDOR. O que quebra no navegador do cliente continua
--   invisível — e foi exatamente assim que as três falhas graves de agosto
--   apareceram: porque alguém usou o produto. Decisão do usuário (2026-09-03),
--   consciente, para não trazer fornecedor novo.
--
-- Idempotente — seguro rodar mais de uma vez.
-- Rodar em: Supabase › SQL Editor › New Query › Run (selecione tudo antes)
-- ================================================================

-- 1) O tipo 'erro' passa a ser aceito.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_tipo_ck;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_tipo_ck
  CHECK (tipo IN ('mensagem','documento','pendencia','aprovacao','erro'));


-- ---------------------------------------------------------------
-- 2) Avisar os admins, sem inundar
--
-- Um erro que se repete cem vezes viraria cem notificações e o sino perderia
-- serventia. A mesma origem só avisa de novo depois de uma hora — tempo de
-- sobra para alguém ver e agir, e curto o bastante para não esconder um
-- problema que voltou no dia seguinte.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.avisar_erro(_origem text, _detalhe text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_titulo text := 'Falha em ' || _origem;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.notifications
    WHERE tipo = 'erro' AND titulo = v_titulo
      AND criada_em > now() - interval '1 hour'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, tipo, titulo, corpo)
  SELECT ur.user_id, 'erro', v_titulo, left(coalesce(_detalhe, ''), 500)
  FROM public.user_roles ur
  WHERE ur.role = 'admin';
END $$;

REVOKE EXECUTE ON FUNCTION public.avisar_erro(text, text) FROM PUBLIC, anon, authenticated;
-- Só o servidor avisa. Se `authenticated` pudesse chamar, qualquer usuário
-- encheria o sino do admin com alertas inventados.
GRANT EXECUTE ON FUNCTION public.avisar_erro(text, text) TO service_role;


-- ================================================================
-- VERIFICAÇÃO — todas as linhas devem sair 'OK'.
-- ================================================================
SELECT 'tipo erro aceito' AS verificacao,
       CASE WHEN pg_get_constraintdef(oid) LIKE '%erro%' THEN 'OK' ELSE 'FALHA' END AS resultado
FROM pg_constraint WHERE conname = 'notifications_tipo_ck'
UNION ALL
SELECT 'avisar_erro existe',
       CASE WHEN to_regprocedure('public.avisar_erro(text,text)') IS NULL THEN 'FALHA' ELSE 'OK' END
UNION ALL
SELECT 'usuario comum nao pode chamar avisar_erro',
       CASE WHEN has_function_privilege('authenticated','public.avisar_erro(text,text)','EXECUTE')
            THEN 'FALHA' ELSE 'OK' END;
