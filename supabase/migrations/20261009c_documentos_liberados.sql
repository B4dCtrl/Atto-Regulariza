-- ================================================================
-- DOCUMENTOS DO PROFISSIONAL LIBERADOS AO CLIENTE — 2026-10-09
-- ----------------------------------------------------------------
-- Até aqui o cliente só via peça técnica (projeto, ART/RRT, laudo, protocolo)
-- depois do processo entregue. Agora o profissional libera arquivo por
-- arquivo: o que está pronto (uma RRT emitida, um protocolo) aparece para o
-- cliente na hora; rascunho continua interno.
--
-- Na entrega, tudo continua visível, como antes.
--
-- A leitura inteira (lista, versões, URL assinada, bucket) delega a
-- can_read_document — por isso basta mudar a regra num lugar só.
--
-- Idempotente — seguro rodar mais de uma vez.
-- Rodar em: Supabase › SQL Editor › New Query › Run (selecione tudo antes)
-- ================================================================

-- 1) Quando foi liberado. Nulo = interno.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS liberado_cliente_em timestamptz;

-- 2) A regra de leitura ganha o terceiro caminho do cliente.
CREATE OR REPLACE FUNCTION public.can_read_document(_document_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.documents d
    JOIN public.properties p ON p.id = d.property_id
    WHERE d.id = _document_id
      AND (
        -- Equipe enxerga inclusive o que foi excluído: é o histórico dela.
        public.is_admin()
        OR p.assigned_professional_id = auth.uid()
        OR (
          p.client_id = auth.uid()
          AND d.deleted_at IS NULL
          AND (
            d.origem = 'cliente'
            OR p.status = 'entregue'
            OR d.liberado_cliente_em IS NOT NULL
          )
        )
      )
  )
$$;

-- 3) Só a equipe libera. O cliente tem UPDATE na tabela (para o status do
-- que ele mesmo envia), então o gatilho que já barra exclusão e troca de
-- origem passa a barrar também a liberação.
CREATE OR REPLACE FUNCTION public.enforce_document_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- service_role (edge function) e admin passam direto.
  IF auth.uid() IS NULL OR public.is_admin() THEN RETURN NEW; END IF;

  -- Cliente não exclui, não muda origem, não repõe versão e não libera.
  IF NOT public.can_manage_property(NEW.property_id) THEN
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      RAISE EXCEPTION 'Exclusão de documento não permitida';
    END IF;
    IF NEW.origem IS DISTINCT FROM OLD.origem THEN
      RAISE EXCEPTION 'Alteração de origem não permitida';
    END IF;
    IF NEW.current_version_id IS DISTINCT FROM OLD.current_version_id THEN
      RAISE EXCEPTION 'Alteração de versão não permitida';
    END IF;
    IF NEW.liberado_cliente_em IS DISTINCT FROM OLD.liberado_cliente_em THEN
      RAISE EXCEPTION 'Liberação de documento não permitida';
    END IF;
  END IF;

  RETURN NEW;
END $$;

-- 4) Liberar ou recolher, avisando o cliente ao liberar.
--
-- SECURITY DEFINER para o aviso: a checagem de papel é a primeira coisa, a
-- função não confia em quem a chamou.
CREATE OR REPLACE FUNCTION public.liberar_documento_ao_cliente(_document_id uuid, _liberar boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d record;
BEGIN
  SELECT doc.id, doc.property_id, doc.kind, doc.name, doc.liberado_cliente_em,
         p.client_id
  INTO d
  FROM public.documents doc
  JOIN public.properties p ON p.id = doc.property_id
  WHERE doc.id = _document_id AND doc.deleted_at IS NULL;

  IF NOT FOUND THEN RETURN false; END IF;

  IF NOT public.can_manage_property(d.property_id) THEN
    RAISE EXCEPTION 'Sem permissão para liberar este documento';
  END IF;

  IF _liberar AND d.liberado_cliente_em IS NULL THEN
    UPDATE public.documents SET liberado_cliente_em = now() WHERE id = _document_id;
    PERFORM public.notificar(d.client_id, d.property_id, 'documento',
      'Novo documento do profissional',
      'Já está disponível em Documentos: ' || d.name, auth.uid());
  ELSIF NOT _liberar AND d.liberado_cliente_em IS NOT NULL THEN
    UPDATE public.documents SET liberado_cliente_em = NULL WHERE id = _document_id;
  END IF;

  RETURN true;
END $$;

REVOKE EXECUTE ON FUNCTION public.liberar_documento_ao_cliente(uuid, boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.liberar_documento_ao_cliente(uuid, boolean) TO authenticated;


-- ================================================================
-- VERIFICAÇÃO — todas as linhas devem sair 'OK'.
-- ================================================================
SELECT 'coluna liberado_cliente_em existe' AS verificacao,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'documents'
           AND column_name = 'liberado_cliente_em'
       ) THEN 'OK' ELSE 'FALHA' END AS resultado
UNION ALL
SELECT 'leitura considera a liberação',
       CASE WHEN (SELECT prosrc FROM pg_proc
                  WHERE oid = 'public.can_read_document(uuid)'::regprocedure)
                 LIKE '%liberado_cliente_em%'
            THEN 'OK' ELSE 'FALHA' END
UNION ALL
SELECT 'cliente não libera sozinho',
       CASE WHEN (SELECT prosrc FROM pg_proc
                  WHERE oid = 'public.enforce_document_update()'::regprocedure)
                 LIKE '%liberado_cliente_em%'
            THEN 'OK' ELSE 'FALHA' END
UNION ALL
SELECT 'função de liberar existe',
       CASE WHEN to_regprocedure('public.liberar_documento_ao_cliente(uuid,boolean)') IS NULL
            THEN 'FALHA' ELSE 'OK' END;
