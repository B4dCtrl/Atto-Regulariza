-- ================================================================
-- RESTAURAR DOCUMENTO EXCLUÍDO — 2026-08-21
-- ----------------------------------------------------------------
-- A exclusão sempre foi lógica: a linha e as versões continuam no banco. Faltava
-- o caminho de volta, e faltava também coerência entre a função e a política.
--
-- O QUE ESTAVA ERRADO
--   A migração 20260808b reescreveu can_read_document dizendo, no próprio
--   comentário, que "a equipe enxerga inclusive o que foi excluído: é o
--   histórico dela". Mas a política da tabela continuou como estava:
--
--     USING ( deleted_at IS NULL AND public.can_read_document(id) )
--
--   O `deleted_at IS NULL` na frente anula a regra da função para TODOS,
--   inclusive o admin. Resultado: nenhum documento excluído chegava ao
--   navegador de ninguém, e o ramo de DocumentList que trata `deleted_at` era
--   código inalcançável. A política passa a delegar inteiramente à função, que
--   é onde a regra por papel está escrita.
--
-- QUEM RESTAURA
--   Admin e profissional atribuído (can_manage_property) — nunca o cliente.
--
--   Excluir exige aprovação do admin; restaurar não. Não é descuido: a
--   assimetria segue a direção do dano. Excluir tira da vista do cliente um
--   documento que o processo talvez precise; restaurar apenas devolve o que já
--   estava lá. Exigir aprovação para desfazer transformaria um engano de um
--   clique numa espera — e o custo dessa espera cai sobre o cliente, que
--   continua sem ver o documento dele.
--
--   Não usamos can_write_document aqui: ela exige `deleted_at IS NULL`
--   justamente para impedir versionar documento excluído. Restaurar é a
--   operação inversa, e afrouxar aquela função abriria o versionamento junto.
--
-- Idempotente — seguro rodar mais de uma vez.
-- Rodar em: Supabase › SQL Editor › New Query › Run
-- ================================================================


-- ---------------------------------------------------------------
-- 1) A política passa a delegar à função
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "documents_select" ON public.documents;
CREATE POLICY "documents_select" ON public.documents
  FOR SELECT TO authenticated
  USING ( public.can_read_document(id) );


-- ---------------------------------------------------------------
-- 2) Restauração
--
-- SECURITY DEFINER porque a política de UPDATE exige can_write_document, que
-- recusa documento excluído. A checagem de papel é feita aqui dentro, na
-- primeira linha — a função não confia em quem a chamou.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restaurar_documento(_document_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_property_id uuid;
BEGIN
  SELECT d.property_id INTO v_property_id
  FROM public.documents d
  WHERE d.id = _document_id AND d.deleted_at IS NOT NULL;

  -- Documento inexistente e documento que não estava excluído devolvem o mesmo
  -- `false`: quem não pode ver o processo não descobre daqui se o id existe.
  IF v_property_id IS NULL THEN RETURN false; END IF;

  IF NOT public.can_manage_property(v_property_id) THEN
    RAISE EXCEPTION 'Sem permissão para restaurar este documento';
  END IF;

  UPDATE public.documents SET deleted_at = NULL WHERE id = _document_id;
  RETURN true;
END $$;

REVOKE EXECUTE ON FUNCTION public.restaurar_documento(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.restaurar_documento(uuid) TO authenticated, service_role;


-- ---------------------------------------------------------------
-- 3) Notificação de restauração
--
-- Excluir já notifica. Restaurar sem avisar deixaria o cliente vendo um
-- documento reaparecer sem explicação.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ao_restaurar_documento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_client_id uuid;
BEGIN
  IF OLD.deleted_at IS NULL OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.client_id INTO v_client_id
  FROM public.properties p WHERE p.id = NEW.property_id;

  -- Só o dono é avisado, e só quando o documento é dele: peça técnica que
  -- volta não deve aparecer para o cliente durante o processo.
  IF v_client_id IS NOT NULL AND NEW.origem = 'cliente' AND v_client_id <> auth.uid() THEN
    INSERT INTO public.notifications (user_id, property_id, tipo, titulo, corpo)
    VALUES (
      v_client_id, NEW.property_id, 'documento',
      'Documento restaurado',
      NEW.name || ' voltou para a sua lista de documentos.'
    );
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ao_restaurar_documento ON public.documents;
CREATE TRIGGER trg_ao_restaurar_documento
  AFTER UPDATE OF deleted_at ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.ao_restaurar_documento();


-- ================================================================
-- VERIFICAÇÃO — todas as linhas devem sair 'OK'.
-- ================================================================
DO $$
DECLARE
  v_txt text;
BEGIN
  SELECT pg_get_expr(polqual, polrelid) INTO v_txt
  FROM pg_policy
  WHERE polrelid = 'public.documents'::regclass AND polname = 'documents_select';

  IF v_txt ILIKE '%deleted_at%' THEN
    RAISE NOTICE 'FALHA: documents_select ainda filtra deleted_at fora da função';
  ELSE
    RAISE NOTICE 'OK: documents_select delega a can_read_document';
  END IF;

  IF to_regprocedure('public.restaurar_documento(uuid)') IS NULL THEN
    RAISE NOTICE 'FALHA: restaurar_documento não existe';
  ELSE
    RAISE NOTICE 'OK: restaurar_documento existe';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = 'public.restaurar_documento(uuid)'::regprocedure
      AND prosecdef AND 'search_path=public' = ANY(proconfig)
  ) THEN
    RAISE NOTICE 'OK: restaurar_documento é SECURITY DEFINER com search_path fixo';
  ELSE
    RAISE NOTICE 'FALHA: restaurar_documento sem SECURITY DEFINER ou sem search_path';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.documents'::regclass AND tgname = 'trg_ao_restaurar_documento'
  ) THEN
    RAISE NOTICE 'OK: gatilho de notificação instalado';
  ELSE
    RAISE NOTICE 'FALHA: gatilho de notificação ausente';
  END IF;
END $$;
