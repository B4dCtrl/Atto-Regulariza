-- ================================================================
-- ARMAZENAMENTO DE DOCUMENTOS COM VERSIONAMENTO — 2026-08-08
-- ----------------------------------------------------------------
-- Spec: docs/superpowers/specs/2026-08-07-armazenamento-documentos-design.md
-- Idempotente — seguro rodar mais de uma vez.
-- ================================================================


-- ---------------------------------------------------------------
-- 1) documents passa a ser o documento LÓGICO
-- ---------------------------------------------------------------
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS kind       text NOT NULL DEFAULT 'outro',
  ADD COLUMN IF NOT EXISTS origem     text NOT NULL DEFAULT 'cliente',
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_origem_ck') THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_origem_ck CHECK (origem IN ('cliente', 'profissional'));
  END IF;
END $$;


-- ---------------------------------------------------------------
-- 2) document_versions — cada envio
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     uuid   NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_number  int    NOT NULL,
  storage_path    text   NOT NULL UNIQUE,
  original_name   text   NOT NULL,
  mime_type       text   NOT NULL,
  size_bytes      bigint NOT NULL,
  checksum_sha256 text   NOT NULL,
  uploaded_by     uuid   REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_number),
  CONSTRAINT document_versions_mime_ck
    CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  CONSTRAINT document_versions_size_ck
    CHECK (size_bytes > 0 AND size_bytes <= 26214400)
);

CREATE INDEX IF NOT EXISTS document_versions_doc_idx
  ON public.document_versions (document_id, version_number DESC);

-- Ponteiro para a versão vigente. Criado depois da tabela por dependência.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS current_version_id uuid
    REFERENCES public.document_versions(id) ON DELETE SET NULL;


-- ---------------------------------------------------------------
-- 3) Funções de decisão — fonte única de autorização
--
-- Usadas pela RLS das tabelas, pela RLS do Storage e pelas edge functions.
-- Se as três tivessem lógica própria, uma divergência viraria brecha.
-- ---------------------------------------------------------------

-- Leitura: aplica a trava de visibilidade do cliente.
-- O cliente NÃO vê peça técnica enquanto o processo corre; passa a ver quando
-- o processo é entregue.
CREATE OR REPLACE FUNCTION public.can_read_document(_document_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.documents d
    JOIN public.properties p ON p.id = d.property_id
    WHERE d.id = _document_id
      AND (
        public.is_admin()
        OR p.assigned_professional_id = auth.uid()
        OR (
          p.client_id = auth.uid()
          AND ( d.origem = 'cliente' OR p.status = 'entregue' )
        )
      )
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_read_document(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_read_document(uuid) TO authenticated, service_role;

-- Escrita de nova versão: cliente só mexe no que é dele.
CREATE OR REPLACE FUNCTION public.can_write_document(_document_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.documents d
    JOIN public.properties p ON p.id = d.property_id
    WHERE d.id = _document_id
      AND (
        public.is_admin()
        OR p.assigned_professional_id = auth.uid()
        OR ( p.client_id = auth.uid() AND d.origem = 'cliente' )
      )
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_write_document(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_write_document(uuid) TO authenticated, service_role;

-- Próximo número de versão. Concentrado aqui para a edge function não precisar
-- calcular no cliente; a UNIQUE (document_id, version_number) é a garantia final
-- em caso de dois envios simultâneos.
CREATE OR REPLACE FUNCTION public.proxima_versao(_document_id uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(max(version_number), 0) + 1
  FROM public.document_versions
  WHERE document_id = _document_id
$$;
REVOKE EXECUTE ON FUNCTION public.proxima_versao(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.proxima_versao(uuid) TO authenticated, service_role;


-- ---------------------------------------------------------------
-- 4) RLS das tabelas
-- ---------------------------------------------------------------
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.document_versions FROM anon;
GRANT SELECT ON public.document_versions TO authenticated;

-- Leitura da versão segue a permissão do documento dono.
DROP POLICY IF EXISTS "document_versions_select" ON public.document_versions;
CREATE POLICY "document_versions_select" ON public.document_versions
  FOR SELECT TO authenticated
  USING ( public.can_read_document(document_id) );

-- Escrita de versão é exclusiva da edge function (service_role): nenhuma
-- política para authenticated significa nenhum INSERT/UPDATE/DELETE por ele.
-- É isso que garante que todo arquivo passou pela validação.

-- documents: leitura passa a respeitar a trava de visibilidade e a exclusão lógica.
DROP POLICY IF EXISTS "documents_select" ON public.documents;
CREATE POLICY "documents_select" ON public.documents
  FOR SELECT TO authenticated
  USING ( deleted_at IS NULL AND public.can_read_document(id) );

-- Exclusão lógica: só admin e profissional atribuído. O UPDATE segue existindo
-- para status; o gatilho abaixo impede que o cliente marque deleted_at.
DROP POLICY IF EXISTS "documents_update" ON public.documents;
CREATE POLICY "documents_update" ON public.documents
  FOR UPDATE TO authenticated
  USING ( public.can_write_document(id) )
  WITH CHECK ( public.can_write_document(id) );

CREATE OR REPLACE FUNCTION public.enforce_document_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- service_role (edge function) e admin passam direto.
  IF auth.uid() IS NULL OR public.is_admin() THEN RETURN NEW; END IF;

  -- Cliente não exclui, não muda origem e não repõe versão à mão.
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
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_document_update ON public.documents;
CREATE TRIGGER trg_enforce_document_update
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_document_update();

-- INSERT direto por usuário deixa de existir: documento nasce pela edge function,
-- junto da primeira versão. Sem isso, seria possível criar documento
-- origem='profissional' se passando por peça técnica.
DROP POLICY IF EXISTS "documents_insert" ON public.documents;


-- ---------------------------------------------------------------
-- 5) Bucket privado
-- ---------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos', 'documentos', false, 26214400,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE
  SET public             = false,
      file_size_limit    = 26214400,
      allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'];


-- ---------------------------------------------------------------
-- 6) RLS do Storage
--
-- O caminho é {property_id}/{document_id}/{version_id}; foldername devolve as
-- pastas, então [2] é o document_id. Delegar a can_read_document mantém uma
-- única verdade entre arquivo e linha de banco.
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "documentos_read" ON storage.objects;
CREATE POLICY "documentos_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos'
    AND array_length(storage.foldername(name), 1) >= 2
    AND public.can_read_document( ((storage.foldername(name))[2])::uuid )
  );

-- Nenhuma política de INSERT/UPDATE/DELETE para authenticated: escrita no bucket
-- é exclusiva do service_role, ou seja, da edge function que valida.
DROP POLICY IF EXISTS "documentos_insert" ON storage.objects;
DROP POLICY IF EXISTS "documentos_update" ON storage.objects;
DROP POLICY IF EXISTS "documentos_delete" ON storage.objects;


-- ================================================================
-- VERIFICAÇÃO (descomente após rodar)
-- SELECT policyname, tablename FROM pg_policies
--   WHERE tablename IN ('documents','document_versions','objects')
--   ORDER BY tablename, policyname;
-- ================================================================
