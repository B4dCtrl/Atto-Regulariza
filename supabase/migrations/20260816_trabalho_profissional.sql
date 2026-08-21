-- ================================================================
-- TRABALHO DO PROFISSIONAL NO BANCO — 2026-08-16
-- ----------------------------------------------------------------
-- Spec: docs/superpowers/specs/2026-08-16-trabalho-do-profissional-design.md
-- Tira do localStorage: campos das etapas, pendências, anotações e leitura
-- do chat. Acrescenta notificações e aprovação do admin.
-- Idempotente — seguro rodar mais de uma vez.
-- ================================================================


-- ---------------------------------------------------------------
-- 1) Função de decisão: quem é a equipe do processo
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pode_gerenciar_processo(_property_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = _property_id AND p.assigned_professional_id = auth.uid()
  )
$$;
REVOKE EXECUTE ON FUNCTION public.pode_gerenciar_processo(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pode_gerenciar_processo(uuid) TO authenticated, service_role;


-- ---------------------------------------------------------------
-- 2) Campos técnicos das etapas
--
-- jsonb porque os campos mudam por etapa (STAGE_DEFS no front): coluna
-- estruturada exigiria uma tabela por etapa, sem ganho.
-- Fica em process_stages, que o cliente lê: são dados do andamento do caso
-- dele (data da vistoria, número do protocolo), não conversa interna.
-- O que é interno vai para process_notes.
-- ---------------------------------------------------------------
ALTER TABLE public.process_stages
  ADD COLUMN IF NOT EXISTS fields jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Escrita de etapa continua restrita a quem gerencia (política já existente
-- stages_update usa can_manage_property).


-- ---------------------------------------------------------------
-- 3) PENDÊNCIAS
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pendencies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  stage_number  int,
  descricao     text NOT NULL,
  kind          text,
  status        text NOT NULL DEFAULT 'aberta',
  criada_por    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criada_em     timestamptz NOT NULL DEFAULT now(),
  resolvida_em  timestamptz,
  resolvida_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT pendencies_status_ck    CHECK (status IN ('aberta','resolvida')),
  CONSTRAINT pendencies_descricao_ck CHECK (length(descricao) BETWEEN 1 AND 2000)
);

CREATE INDEX IF NOT EXISTS pendencies_prop_idx ON public.pendencies (property_id, status);

ALTER TABLE public.pendencies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pendencies FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pendencies TO authenticated;

-- Cliente LÊ as do processo dele: é o que transforma pendência em tarefa.
DROP POLICY IF EXISTS "pendencies_select" ON public.pendencies;
CREATE POLICY "pendencies_select" ON public.pendencies FOR SELECT TO authenticated
  USING ( public.can_access_property(property_id) );

-- Só a equipe cria, edita e apaga.
DROP POLICY IF EXISTS "pendencies_insert" ON public.pendencies;
CREATE POLICY "pendencies_insert" ON public.pendencies FOR INSERT TO authenticated
  WITH CHECK ( public.pode_gerenciar_processo(property_id) );

DROP POLICY IF EXISTS "pendencies_update" ON public.pendencies;
CREATE POLICY "pendencies_update" ON public.pendencies FOR UPDATE TO authenticated
  USING ( public.pode_gerenciar_processo(property_id) )
  WITH CHECK ( public.pode_gerenciar_processo(property_id) );

DROP POLICY IF EXISTS "pendencies_delete" ON public.pendencies;
CREATE POLICY "pendencies_delete" ON public.pendencies FOR DELETE TO authenticated
  USING ( public.pode_gerenciar_processo(property_id) );


-- ---------------------------------------------------------------
-- 4) ANOTAÇÕES INTERNAS
--
-- Tabela separada por PRIVACIDADE, não por organização: process_stages é
-- legível pelo cliente e a RLS filtra linha, não coluna. Guardar ali vazaria
-- o conteúdo por consulta direta, mesmo sem aparecer na tela dele.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.process_notes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  conteudo      text NOT NULL,
  autor_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criada_em     timestamptz NOT NULL DEFAULT now(),
  atualizada_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT process_notes_conteudo_ck CHECK (length(conteudo) <= 10000)
);

CREATE INDEX IF NOT EXISTS process_notes_prop_idx ON public.process_notes (property_id);

ALTER TABLE public.process_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.process_notes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.process_notes TO authenticated;

-- Uma política só, para todas as operações: nenhuma menção ao cliente.
DROP POLICY IF EXISTS "process_notes_equipe" ON public.process_notes;
CREATE POLICY "process_notes_equipe" ON public.process_notes FOR ALL TO authenticated
  USING ( public.pode_gerenciar_processo(property_id) )
  WITH CHECK ( public.pode_gerenciar_processo(property_id) );


-- ---------------------------------------------------------------
-- 5) NOTIFICAÇÕES
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  tipo        text NOT NULL,
  titulo      text NOT NULL,
  corpo       text,
  lida        boolean NOT NULL DEFAULT false,
  criada_em   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_tipo_ck
    CHECK (tipo IN ('mensagem','documento','pendencia','aprovacao'))
);

CREATE INDEX IF NOT EXISTS notifications_user_idx
  ON public.notifications (user_id, lida, criada_em DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notifications FROM anon;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;

-- Cada um só vê as próprias. Sem política de INSERT: só gatilho cria.
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT TO authenticated
  USING ( user_id = auth.uid() );

-- Marcar como lida é a única escrita permitida ao usuário.
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE TO authenticated
  USING ( user_id = auth.uid() )
  WITH CHECK ( user_id = auth.uid() );

/** Cria notificação evitando avisar quem causou o evento. */
CREATE OR REPLACE FUNCTION public.notificar(
  _user_id uuid, _property_id uuid, _tipo text, _titulo text, _corpo text, _autor uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user_id IS NULL OR _user_id = _autor THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, property_id, tipo, titulo, corpo)
  VALUES (_user_id, _property_id, _tipo, _titulo, _corpo);
END $$;
REVOKE EXECUTE ON FUNCTION public.notificar(uuid,uuid,text,text,text,uuid) FROM PUBLIC, anon, authenticated;


-- ---------------------------------------------------------------
-- 6) PEDIDOS DE APROVAÇÃO
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id    uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  tipo           text NOT NULL,
  document_id    uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  justificativa  text,
  status         text NOT NULL DEFAULT 'pendente',
  solicitado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  solicitado_em  timestamptz NOT NULL DEFAULT now(),
  decidido_por   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decidido_em    timestamptz,
  motivo_recusa  text,
  CONSTRAINT approval_tipo_ck   CHECK (tipo IN ('conclusao','exclusao_documento')),
  CONSTRAINT approval_status_ck CHECK (status IN ('pendente','aprovado','recusado'))
);

CREATE INDEX IF NOT EXISTS approval_status_idx
  ON public.approval_requests (status, solicitado_em DESC);

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.approval_requests FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.approval_requests TO authenticated;

-- Equipe vê os pedidos do processo; cliente não tem acesso nenhum.
DROP POLICY IF EXISTS "approval_select" ON public.approval_requests;
CREATE POLICY "approval_select" ON public.approval_requests FOR SELECT TO authenticated
  USING ( public.pode_gerenciar_processo(property_id) );

DROP POLICY IF EXISTS "approval_insert" ON public.approval_requests;
CREATE POLICY "approval_insert" ON public.approval_requests FOR INSERT TO authenticated
  WITH CHECK ( public.pode_gerenciar_processo(property_id) );

-- Só admin decide.
DROP POLICY IF EXISTS "approval_update" ON public.approval_requests;
CREATE POLICY "approval_update" ON public.approval_requests FOR UPDATE TO authenticated
  USING ( public.is_admin() )
  WITH CHECK ( public.is_admin() );

/** Pedido já decidido não muda de novo. */
CREATE OR REPLACE FUNCTION public.enforce_approval_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status <> 'pendente' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Este pedido já foi decidido';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.decidido_em  := now();
    NEW.decidido_por := auth.uid();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_approval_update ON public.approval_requests;
CREATE TRIGGER trg_enforce_approval_update
  BEFORE UPDATE ON public.approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_approval_update();

/** Existe pedido aprovado para esta ação? */
CREATE OR REPLACE FUNCTION public.tem_aprovacao(
  _property_id uuid, _tipo text, _document_id uuid DEFAULT NULL
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.approval_requests a
    WHERE a.property_id = _property_id
      AND a.tipo = _tipo
      AND a.status = 'aprovado'
      AND (_document_id IS NULL OR a.document_id = _document_id)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.tem_aprovacao(uuid,text,uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.tem_aprovacao(uuid,text,uuid) TO authenticated, service_role;

-- Coluna que marca o pedido como já usado.
ALTER TABLE public.approval_requests
  ADD COLUMN IF NOT EXISTS consumido_em timestamptz;

/**
 * Uma aprovação, um uso.
 *
 * Encontra um pedido aprovado e ainda não usado, marca como consumido e diz
 * se achou. Sem isto, `tem_aprovacao` apenas constata que existe um pedido
 * aprovado — e o profissional poderia reconcluir o processo indefinidamente,
 * ou reexcluir o mesmo documento, sempre reaproveitando o aval de meses atrás.
 *
 * Marcar o consumo não dispara notificação: trg_notificar_aprovacao só avisa
 * quando `status` muda, e aqui o status continua 'aprovado'.
 */
CREATE OR REPLACE FUNCTION public.consumir_aprovacao(
  _property_id uuid, _tipo text, _document_id uuid DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  SELECT a.id INTO v_id
  FROM public.approval_requests a
  WHERE a.property_id = _property_id
    AND a.tipo = _tipo
    AND a.status = 'aprovado'
    AND a.consumido_em IS NULL
    AND (_document_id IS NULL OR a.document_id = _document_id)
  ORDER BY a.decidido_em NULLS LAST
  LIMIT 1;

  IF v_id IS NULL THEN RETURN false; END IF;

  UPDATE public.approval_requests SET consumido_em = now() WHERE id = v_id;
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.consumir_aprovacao(uuid,text,uuid) FROM PUBLIC, anon, authenticated;


-- ---------------------------------------------------------------
-- 7) LEITURA DO CHAT
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_reads (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  lido_ate    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, property_id)
);

ALTER TABLE public.chat_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_reads FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.chat_reads TO authenticated;

DROP POLICY IF EXISTS "chat_reads_propria" ON public.chat_reads;
CREATE POLICY "chat_reads_propria" ON public.chat_reads FOR ALL TO authenticated
  USING ( user_id = auth.uid() )
  WITH CHECK ( user_id = auth.uid() );


-- ---------------------------------------------------------------
-- 8) APROVAÇÃO IMPOSTA NO BANCO
--
-- Se ficasse só na interface, bastaria uma chamada direta à API para
-- contornar. Admin age direto — não pede aprovação a si mesmo.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_conclusao_aprovada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_trusted_context() OR public.is_admin() THEN RETURN NEW; END IF;

  IF NEW.status = 'entregue' AND OLD.status IS DISTINCT FROM 'entregue' THEN
    IF NOT public.consumir_aprovacao(NEW.id, 'conclusao', NULL) THEN
      RAISE EXCEPTION 'Concluir o processo depende de aprovação do administrador';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_conclusao_aprovada ON public.properties;
CREATE TRIGGER trg_enforce_conclusao_aprovada
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.enforce_conclusao_aprovada();

-- Exclusão de documento: acrescenta a exigência de aprovação ao gatilho que
-- já existe. Recriamos a função inteira porque ela é substituída, não somada.
CREATE OR REPLACE FUNCTION public.enforce_document_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN RETURN NEW; END IF;

  IF NOT public.can_manage_property(NEW.property_id) THEN
    -- Cliente: não exclui, não muda origem, não repõe versão à mão.
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      RAISE EXCEPTION 'Exclusão de documento não permitida';
    END IF;
    IF NEW.origem IS DISTINCT FROM OLD.origem THEN
      RAISE EXCEPTION 'Alteração de origem não permitida';
    END IF;
    IF NEW.current_version_id IS DISTINCT FROM OLD.current_version_id THEN
      RAISE EXCEPTION 'Alteração de versão não permitida';
    END IF;
  ELSE
    -- Profissional atribuído: excluir passa a exigir aprovação do admin.
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND NEW.deleted_at IS NOT NULL THEN
      IF NOT public.consumir_aprovacao(NEW.property_id, 'exclusao_documento', NEW.id) THEN
        RAISE EXCEPTION 'Excluir documento depende de aprovação do administrador';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END $$;


-- ---------------------------------------------------------------
-- 9) GATILHOS DE NOTIFICAÇÃO
-- ---------------------------------------------------------------

/** Mensagem nova avisa o outro lado. */
CREATE OR REPLACE FUNCTION public.notificar_mensagem()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record;
BEGIN
  SELECT client_id, assigned_professional_id, name INTO p
  FROM public.properties WHERE id = NEW.property_id;

  IF NEW.is_client THEN
    PERFORM public.notificar(p.assigned_professional_id, NEW.property_id, 'mensagem',
      'Nova mensagem do cliente', left(NEW.content, 140), NEW.sender_id);
  ELSE
    PERFORM public.notificar(p.client_id, NEW.property_id, 'mensagem',
      'Nova mensagem da equipe', left(NEW.content, 140), NEW.sender_id);
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notificar_mensagem ON public.messages;
CREATE TRIGGER trg_notificar_mensagem
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notificar_mensagem();

/**
 * Documento novo avisa o outro lado e resolve a pendência daquele tipo.
 *
 * Fechar sozinha é o que faz a tarefa sumir da tela do cliente na hora — o
 * retorno que o leva a agir da próxima vez. E poupa o profissional de lembrar
 * de dar baixa.
 */
CREATE OR REPLACE FUNCTION public.ao_criar_versao_documento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d record; p record;
BEGIN
  SELECT property_id, kind, origem, name INTO d
  FROM public.documents WHERE id = NEW.document_id;

  SELECT client_id, assigned_professional_id INTO p
  FROM public.properties WHERE id = d.property_id;

  IF d.origem = 'cliente' THEN
    PERFORM public.notificar(p.assigned_professional_id, d.property_id, 'documento',
      'Documento enviado pelo cliente', d.name, NEW.uploaded_by);

    UPDATE public.pendencies
       SET status = 'resolvida', resolvida_em = now(), resolvida_por = NEW.uploaded_by
     WHERE property_id = d.property_id
       AND status = 'aberta'
       AND kind = d.kind;
  ELSE
    PERFORM public.notificar(p.client_id, d.property_id, 'documento',
      'Documento enviado pela equipe', d.name, NEW.uploaded_by);
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ao_criar_versao_documento ON public.document_versions;
CREATE TRIGGER trg_ao_criar_versao_documento
  AFTER INSERT ON public.document_versions
  FOR EACH ROW EXECUTE FUNCTION public.ao_criar_versao_documento();

/** Pendência nova vira tarefa avisada ao cliente. */
CREATE OR REPLACE FUNCTION public.notificar_pendencia()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record;
BEGIN
  SELECT client_id INTO p FROM public.properties WHERE id = NEW.property_id;
  PERFORM public.notificar(p.client_id, NEW.property_id, 'pendencia',
    'A equipe precisa de algo seu', NEW.descricao, NEW.criada_por);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notificar_pendencia ON public.pendencies;
CREATE TRIGGER trg_notificar_pendencia
  AFTER INSERT ON public.pendencies
  FOR EACH ROW EXECUTE FUNCTION public.notificar_pendencia();

/** Pedido de aprovação avisa todos os admins; a decisão avisa quem pediu. */
CREATE OR REPLACE FUNCTION public.notificar_aprovacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; rotulo text;
BEGIN
  rotulo := CASE NEW.tipo WHEN 'conclusao' THEN 'concluir o processo'
                          ELSE 'excluir um documento' END;

  IF TG_OP = 'INSERT' THEN
    FOR a IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      PERFORM public.notificar(a.user_id, NEW.property_id, 'aprovacao',
        'Pedido de aprovação', 'Um profissional quer ' || rotulo, NEW.solicitado_por);
    END LOOP;
  ELSIF NEW.status <> OLD.status THEN
    PERFORM public.notificar(NEW.solicitado_por, NEW.property_id, 'aprovacao',
      CASE NEW.status WHEN 'aprovado' THEN 'Pedido aprovado' ELSE 'Pedido recusado' END,
      coalesce(NEW.motivo_recusa, rotulo), NEW.decidido_por);
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notificar_aprovacao ON public.approval_requests;
CREATE TRIGGER trg_notificar_aprovacao
  AFTER INSERT OR UPDATE ON public.approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.notificar_aprovacao();
