-- ================================================================
-- AVISO DE LEAD DA TRIAGEM — 2026-09-06
-- ----------------------------------------------------------------
-- O lead classificado passa a cutucar o sino do admin. Sem isto ele cai numa
-- lista que alguém precisa lembrar de abrir, e um caso vermelho que chega às
-- 23h fica invisível até alguém procurar.
--
-- Idempotente — seguro rodar mais de uma vez.
-- Rodar em: Supabase › SQL Editor › New Query › Run (selecione tudo antes)
-- ================================================================

-- 1) O tipo 'lead' passa a ser aceito no sino.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_tipo_ck;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_tipo_ck
  CHECK (tipo IN ('mensagem','documento','pendencia','aprovacao','erro','lead'));

-- 2) Avisar os admins quando a triagem classificar um caso.
--
-- Sem represar, ao contrário de avisar_erro: cada lead custou 8 respostas da
-- pessoa e representa alguém esperando contato. Perder um por excesso de zelo
-- é pior que um sino cheio. A cor entra no título porque é o que decide a
-- ordem de atendimento.
CREATE OR REPLACE FUNCTION public.avisar_lead_triagem(
  _cor text, _nome text, _cidade text, _telefone text, _motivo text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_titulo text;
BEGIN
  v_titulo := CASE _cor
    WHEN 'vermelho' THEN 'Caso vermelho na triagem'
    WHEN 'amarelo'  THEN 'Caso amarelo na triagem'
    ELSE 'Novo caso pronto para orçamento'
  END;

  IF coalesce(_cidade, '') <> '' THEN
    v_titulo := v_titulo || ' — ' || _cidade;
  END IF;

  INSERT INTO public.notifications (user_id, tipo, titulo, corpo)
  SELECT ur.user_id, 'lead', v_titulo,
         left(concat_ws(' · ',
           nullif(_nome, ''),
           nullif(_telefone, ''),
           nullif(_motivo, '')
         ), 500)
  FROM public.user_roles ur
  WHERE ur.role = 'admin';
END $$;

-- Só o servidor avisa. Se `authenticated` pudesse chamar, qualquer usuário
-- encheria o sino do admin com leads inventados.
REVOKE EXECUTE ON FUNCTION public.avisar_lead_triagem(text,text,text,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.avisar_lead_triagem(text,text,text,text,text)
  TO service_role;
