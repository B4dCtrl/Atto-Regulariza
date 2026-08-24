-- ================================================================
-- PROTOCOLO DE COLETA DE DOCUMENTOS — 2026-08-24
-- ----------------------------------------------------------------
-- Spec: docs/superpowers/specs/2026-08-24-protocolo-documentos-design.md
--
-- Acrescenta o estado da PAPELADA, separado do estado do PROCESSO.
-- `properties.status` continua desenhando a barra de etapas do cliente;
-- `properties.coleta` responde outra pergunta: em que pé estão os documentos.
--
-- Idempotente — seguro rodar mais de uma vez.
-- Rodar em: Supabase › SQL Editor › New Query › Run (selecione tudo antes)
-- ================================================================


-- ---------------------------------------------------------------
-- 1) Estado da coleta
-- ---------------------------------------------------------------
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS coleta text NOT NULL DEFAULT 'PENDENTE_INICIAL';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'properties_coleta_ck'
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_coleta_ck CHECK (coleta IN (
        'PENDENTE_INICIAL', 'EM_ANALISE', 'ACAO_REQUERIDA', 'PRONTO_PARA_DELEGACAO'
      ));
  END IF;
END $$;


-- ---------------------------------------------------------------
-- 2) Os essenciais estão aprovados?
--
-- Mesma regra de `essenciaisAprovados` em src/lib/checklist-inicial.ts.
-- Existe nos dois lugares porque a tela precisa dela para explicar e o banco
-- precisa dela para impedir — e só a do banco é inviolável.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.essenciais_aprovados(_property_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM unnest(ARRAY['identidade','comprovante_endereco']) AS essencial(kind)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.property_id = _property_id
        AND d.kind = essencial.kind
        AND d.status = 'Aprovado'
        AND d.deleted_at IS NULL
    )
  )
$$;
REVOKE EXECUTE ON FUNCTION public.essenciais_aprovados(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.essenciais_aprovados(uuid) TO authenticated, service_role;


-- ---------------------------------------------------------------
-- 3) Recalcular o estado da coleta
--
-- Chamada pelos gatilhos de documento e de pendência. Concentrar a decisão
-- aqui evita que dois gatilhos discordem sobre o mesmo processo.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalcular_coleta(_property_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_faltam    int;
  v_pendentes int;
  v_novo      text;
BEGIN
  -- Quantos do checklist padrão ainda não foram enviados.
  SELECT count(*) INTO v_faltam
  FROM unnest(ARRAY['identidade','comprovante_endereco','matricula']) AS req(kind)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.property_id = _property_id
      AND d.kind = req.kind
      AND d.deleted_at IS NULL
  );

  SELECT count(*) INTO v_pendentes
  FROM public.pendencies p
  WHERE p.property_id = _property_id AND p.status = 'aberta';

  IF public.essenciais_aprovados(_property_id) THEN
    v_novo := 'PRONTO_PARA_DELEGACAO';
  ELSIF v_faltam > 0 THEN
    v_novo := 'PENDENTE_INICIAL';
  ELSIF v_pendentes > 0 THEN
    v_novo := 'ACAO_REQUERIDA';
  ELSE
    v_novo := 'EM_ANALISE';
  END IF;

  UPDATE public.properties SET coleta = v_novo
  WHERE id = _property_id AND coleta IS DISTINCT FROM v_novo;
END $$;
REVOKE EXECUTE ON FUNCTION public.recalcular_coleta(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.recalcular_coleta(uuid) TO authenticated, service_role;


-- ---------------------------------------------------------------
-- 4) Gatilhos que mantêm o estado em dia
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ao_mudar_documento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recalcular_coleta(COALESCE(NEW.property_id, OLD.property_id));
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_ao_mudar_documento ON public.documents;
CREATE TRIGGER trg_ao_mudar_documento
  AFTER INSERT OR UPDATE OF status, deleted_at, kind ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.ao_mudar_documento();

CREATE OR REPLACE FUNCTION public.ao_mudar_pendencia()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recalcular_coleta(COALESCE(NEW.property_id, OLD.property_id));
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_ao_mudar_pendencia ON public.pendencies;
CREATE TRIGGER trg_ao_mudar_pendencia
  AFTER INSERT OR UPDATE OF status ON public.pendencies
  FOR EACH ROW EXECUTE FUNCTION public.ao_mudar_pendencia();


-- ---------------------------------------------------------------
-- 5) A trava de delegação
--
-- Acrescenta a segunda regra ao gatilho que já existe. Recriamos a função
-- inteira porque ela é substituída, não somada.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_assigned_professional()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_faltando text;
BEGIN
  IF NEW.assigned_professional_id IS NOT NULL
     AND NEW.assigned_professional_id IS DISTINCT FROM OLD.assigned_professional_id THEN

    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = NEW.assigned_professional_id
        AND role = 'profissional'
        AND approval_status = 'aprovado'
    ) THEN
      RAISE EXCEPTION 'Profissional não aprovado não pode receber processos';
    END IF;

    -- Trava só no essencial: identidade e comprovante de endereço. Matrícula
    -- fica de fora porque metade de quem procura regularização não a tem, e é
    -- o profissional quem sabe dizer o caminho nesses casos.
    IF NOT public.essenciais_aprovados(NEW.id) THEN
      SELECT string_agg(rotulo, ', ') INTO v_faltando
      FROM (
        SELECT CASE e.kind
                 WHEN 'identidade' THEN 'RG e CPF do proprietário'
                 ELSE 'Comprovante de endereço'
               END AS rotulo
        FROM unnest(ARRAY['identidade','comprovante_endereco']) AS e(kind)
        WHERE NOT EXISTS (
          SELECT 1 FROM public.documents d
          WHERE d.property_id = NEW.id AND d.kind = e.kind
            AND d.status = 'Aprovado' AND d.deleted_at IS NULL
        )
      ) f;

      RAISE EXCEPTION 'Faltam documentos essenciais aprovados: %', v_faltando;
    END IF;
  END IF;

  RETURN NEW;
END $$;


-- ---------------------------------------------------------------
-- 6) Alinhar os processos que já existem
-- ---------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.properties LOOP
    PERFORM public.recalcular_coleta(r.id);
  END LOOP;
END $$;


-- ================================================================
-- VERIFICAÇÃO — todas as linhas devem sair 'OK'.
-- ================================================================
SELECT 'coluna coleta existe' AS verificacao,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='properties' AND column_name='coleta'
       ) THEN 'OK' ELSE 'FALHA' END AS resultado
UNION ALL
SELECT 'essenciais_aprovados existe',
       CASE WHEN to_regprocedure('public.essenciais_aprovados(uuid)') IS NULL
            THEN 'FALHA' ELSE 'OK' END
UNION ALL
SELECT 'trava de delegacao instalada',
       CASE WHEN (SELECT prosrc FROM pg_proc
                  WHERE oid='public.enforce_assigned_professional()'::regprocedure)
                 LIKE '%essenciais_aprovados%'
            THEN 'OK' ELSE 'FALHA' END
UNION ALL
SELECT 'gatilho de documento instalado',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_trigger
         WHERE tgrelid='public.documents'::regclass AND tgname='trg_ao_mudar_documento'
       ) THEN 'OK' ELSE 'FALHA' END
UNION ALL
SELECT 'nenhum processo ficou com coleta invalida',
       CASE WHEN EXISTS (
         SELECT 1 FROM public.properties
         WHERE coleta NOT IN ('PENDENTE_INICIAL','EM_ANALISE','ACAO_REQUERIDA','PRONTO_PARA_DELEGACAO')
       ) THEN 'FALHA' ELSE 'OK' END;
