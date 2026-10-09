-- ================================================================
-- PEDIDOS DE ATRIBUIÇÃO — 2026-10-09
-- ----------------------------------------------------------------
-- O profissional passa a ver os processos que ainda não têm ninguém e pode
-- pedir ao admin para assumir um deles. O admin recebe o pedido no sino e
-- designa pela tela do processo, como sempre.
--
-- O que o profissional vê de um processo sem atribuição é só o caso: tipo,
-- cidade, situação, objetivo e data. Nome, e-mail, telefone e CPF do cliente
-- ficam de fora — ele ainda não tem nada com aquele cliente.
--
-- Idempotente — seguro rodar mais de uma vez.
-- Rodar em: Supabase › SQL Editor › New Query › Run (selecione tudo antes)
-- ================================================================

-- 1) Os pedidos.
CREATE TABLE IF NOT EXISTS public.pedidos_atribuicao (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id      uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  profissional_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('pendente', 'aceito', 'recusado')),
  criado_em        timestamptz NOT NULL DEFAULT now(),
  decidido_em      timestamptz
);

-- Um pedido aberto por profissional e processo: clicar duas vezes não duplica.
CREATE UNIQUE INDEX IF NOT EXISTS pedidos_atribuicao_um_pendente
  ON public.pedidos_atribuicao (property_id, profissional_id)
  WHERE status = 'pendente';

ALTER TABLE public.pedidos_atribuicao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pedidos_atribuicao FROM anon, authenticated;
GRANT SELECT ON public.pedidos_atribuicao TO authenticated;

-- Admin vê todos; o profissional, só os dele. Escrita só pelas funções abaixo.
DROP POLICY IF EXISTS "pedidos_atribuicao_select" ON public.pedidos_atribuicao;
CREATE POLICY "pedidos_atribuicao_select" ON public.pedidos_atribuicao
  FOR SELECT TO authenticated
  USING (public.is_admin() OR profissional_id = auth.uid());


-- 2) A vitrine do profissional.
CREATE OR REPLACE FUNCTION public.eh_profissional_aprovado()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'profissional' AND approval_status = 'aprovado'
  )
$$;
REVOKE EXECUTE ON FUNCTION public.eh_profissional_aprovado() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.eh_profissional_aprovado() TO authenticated;

DROP FUNCTION IF EXISTS public.processos_sem_atribuicao();
CREATE FUNCTION public.processos_sem_atribuicao()
RETURNS TABLE (
  id           uuid,
  tipo_imovel  text,
  situacao     text,
  objetivo     text,
  city         text,
  state        text,
  criado_em    timestamptz,
  ja_pedi      boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.tipo_imovel, p.situacao, p.objetivo, p.city, p.state, p.created_at,
         EXISTS (
           SELECT 1 FROM public.pedidos_atribuicao pa
           WHERE pa.property_id = p.id
             AND pa.profissional_id = auth.uid()
             AND pa.status = 'pendente'
         )
  FROM public.properties p
  WHERE public.eh_profissional_aprovado()
    AND p.assigned_professional_id IS NULL
    AND p.status <> 'entregue'
  ORDER BY p.created_at DESC
  LIMIT 100
$$;
REVOKE EXECUTE ON FUNCTION public.processos_sem_atribuicao() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.processos_sem_atribuicao() TO authenticated;


-- 3) Pedir.
CREATE OR REPLACE FUNCTION public.solicitar_atribuicao(_property_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_nome   text;
  v_cidade text;
BEGIN
  IF NOT public.eh_profissional_aprovado() THEN
    RAISE EXCEPTION 'Só profissional aprovado pode pedir processos';
  END IF;

  -- Sem aspas vazias de propósito: o separador de comandos do SQL Editor do
  -- Supabase se perde com elas dentro de função e corta o comando no meio.
  SELECT coalesce(CASE WHEN length(p.city) > 0 THEN p.city END, 'cidade não informada')
  INTO v_cidade
  FROM public.properties p
  WHERE p.id = _property_id AND p.assigned_professional_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este processo já tem profissional';
  END IF;

  INSERT INTO public.pedidos_atribuicao (property_id, profissional_id)
  VALUES (_property_id, auth.uid())
  ON CONFLICT DO NOTHING;

  -- Já havia pedido aberto: não avisa de novo.
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT coalesce(name, 'Um profissional') INTO v_nome
  FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.notifications (user_id, property_id, tipo, titulo, corpo)
  SELECT ur.user_id, _property_id, 'aprovacao',
         'Profissional pediu um processo',
         v_nome || ' quer assumir o caso em ' || v_cidade || '. Abra o processo para designar.'
  FROM public.user_roles ur
  WHERE ur.role = 'admin';

  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.solicitar_atribuicao(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.solicitar_atribuicao(uuid) TO authenticated;


-- 4) Designou alguém: os pedidos abertos daquele processo se resolvem sozinhos.
-- Quem foi escolhido tem o pedido aceito; os demais, recusado — e são avisados,
-- para não ficarem esperando.
CREATE OR REPLACE FUNCTION public.resolver_pedidos_ao_atribuir()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assigned_professional_id IS NULL
     OR NEW.assigned_professional_id IS NOT DISTINCT FROM OLD.assigned_professional_id THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, property_id, tipo, titulo, corpo)
  SELECT pa.profissional_id, NULL, 'aprovacao',
         'Processo designado a outro profissional',
         'O caso em ' || coalesce(CASE WHEN length(NEW.city) > 0 THEN NEW.city END,
                                  'cidade não informada')
           || ' que você pediu foi para outra pessoa.'
  FROM public.pedidos_atribuicao pa
  WHERE pa.property_id = NEW.id
    AND pa.status = 'pendente'
    AND pa.profissional_id <> NEW.assigned_professional_id;

  UPDATE public.pedidos_atribuicao
  SET status = CASE WHEN profissional_id = NEW.assigned_professional_id
                    THEN 'aceito' ELSE 'recusado' END,
      decidido_em = now()
  WHERE property_id = NEW.id AND status = 'pendente';

  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.resolver_pedidos_ao_atribuir() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_resolver_pedidos_ao_atribuir ON public.properties;
CREATE TRIGGER trg_resolver_pedidos_ao_atribuir
  AFTER UPDATE OF assigned_professional_id ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.resolver_pedidos_ao_atribuir();


-- ================================================================
-- VERIFICAÇÃO — todas as linhas devem sair 'OK'.
-- ================================================================
SELECT 'tabela de pedidos com RLS' AS verificacao,
       CASE WHEN (SELECT relrowsecurity FROM pg_class
                  WHERE oid = 'public.pedidos_atribuicao'::regclass)
            THEN 'OK' ELSE 'FALHA' END AS resultado
UNION ALL
SELECT 'vitrine do profissional',
       CASE WHEN to_regprocedure('public.processos_sem_atribuicao()') IS NULL
            THEN 'FALHA' ELSE 'OK' END
UNION ALL
SELECT 'pedir ao admin',
       CASE WHEN to_regprocedure('public.solicitar_atribuicao(uuid)') IS NULL
            THEN 'FALHA' ELSE 'OK' END
UNION ALL
SELECT 'pedidos se resolvem ao designar',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_trigger
         WHERE tgrelid = 'public.properties'::regclass
           AND tgname = 'trg_resolver_pedidos_ao_atribuir'
       ) THEN 'OK' ELSE 'FALHA' END;
