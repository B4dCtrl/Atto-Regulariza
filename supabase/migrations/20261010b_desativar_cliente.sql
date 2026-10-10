-- ================================================================
-- DESATIVAR E REATIVAR CLIENTE — 2026-10-10
-- ----------------------------------------------------------------
-- "Excluir cliente" não apaga nada: desativa. O processo sai das listas, o
-- profissional deixa de ter o caso, o lead sai da Central de Leads, e o
-- cliente fica opaco em Clientes, com "Reativar".
--
-- Sem aspas vazias de propósito: o separador de comandos do SQL Editor do
-- Supabase se perde com elas dentro de função.
--
-- Idempotente — seguro rodar mais de uma vez.
-- Rodar em: Supabase › SQL Editor › New Query › Run (selecione tudo antes)
-- ================================================================

-- 1) Quando foi desativado. Nulo = ativo.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS desativado_em timestamptz;

-- 2) Desativar ou reativar. Só admin.
CREATE OR REPLACE FUNCTION public.desativar_cliente(_property_id uuid, _desativar boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Só admin desativa ou reativa cliente';
  END IF;

  SELECT id, client_email, assigned_professional_id, name, desativado_em
  INTO p
  FROM public.properties
  WHERE id = _property_id;

  IF NOT FOUND THEN RETURN false; END IF;

  IF _desativar THEN
    IF p.desativado_em IS NOT NULL THEN RETURN true; END IF;

    -- Avisa o profissional antes de tirar o caso dele.
    IF p.assigned_professional_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, property_id, tipo, titulo, corpo)
      VALUES (p.assigned_professional_id, NULL, 'aprovacao',
              'Caso encerrado pela equipe',
              'O processo ' || p.name || ' foi desativado e saiu da sua lista.');
    END IF;

    UPDATE public.properties
    SET desativado_em = now(), assigned_professional_id = NULL
    WHERE id = _property_id;

    UPDATE public.pedidos_atribuicao
    SET status = 'recusado', decidido_em = now()
    WHERE property_id = _property_id AND status = 'pendente';

    IF p.client_email IS NOT NULL THEN
      UPDATE public.leads
      SET status = 'recusado'
      WHERE lower(email) = lower(p.client_email) AND status <> 'recusado';
    END IF;
  ELSE
    IF p.desativado_em IS NULL THEN RETURN true; END IF;

    UPDATE public.properties SET desativado_em = NULL WHERE id = _property_id;

    -- O lead volta para a fila, para alguém retomar o contato.
    IF p.client_email IS NOT NULL THEN
      UPDATE public.leads
      SET status = 'novo'
      WHERE lower(email) = lower(p.client_email) AND status = 'recusado';
    END IF;
  END IF;

  RETURN true;
END $$;

REVOKE EXECUTE ON FUNCTION public.desativar_cliente(uuid, boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.desativar_cliente(uuid, boolean) TO authenticated;

-- 3) Desativado não aparece para profissional pedir.
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
    AND p.desativado_em IS NULL
  ORDER BY p.created_at DESC
  LIMIT 100
$$;
REVOKE EXECUTE ON FUNCTION public.processos_sem_atribuicao() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.processos_sem_atribuicao() TO authenticated;


-- ================================================================
-- VERIFICAÇÃO — todas as linhas devem sair 'OK'.
-- ================================================================
SELECT 'coluna desativado_em existe' AS verificacao,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'properties'
           AND column_name = 'desativado_em'
       ) THEN 'OK' ELSE 'FALHA' END AS resultado
UNION ALL
SELECT 'função de desativar existe',
       CASE WHEN to_regprocedure('public.desativar_cliente(uuid,boolean)') IS NULL
            THEN 'FALHA' ELSE 'OK' END
UNION ALL
SELECT 'vitrine ignora desativado',
       CASE WHEN (SELECT prosrc FROM pg_proc
                  WHERE oid = 'public.processos_sem_atribuicao()'::regprocedure)
                 LIKE '%desativado_em%'
            THEN 'OK' ELSE 'FALHA' END;
