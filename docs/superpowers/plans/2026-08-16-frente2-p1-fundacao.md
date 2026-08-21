# Frente 2 · Plano 1 — Fundação no banco e camada de API

> **Para trabalhadores agênticos:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar tarefa a tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** Criar no banco tudo o que a frente 2 precisa — pendências, notificações, aprovações, anotações internas, campos de etapa e leitura de chat — com autorização provada, mais a camada de API em TypeScript que os painéis vão consumir.

**Arquitetura:** Uma única migração cria as cinco tabelas, a coluna `fields`, as políticas de RLS e os gatilhos. As regras que importam (aprovação do admin, privacidade das anotações, resolução automática de pendência) são impostas **no banco**, não na interface — só na tela, bastaria uma chamada direta à API para contornar. Sobre isso, uma camada de API fina em TypeScript, um arquivo por assunto.

**Stack:** Supabase (Postgres + RLS + gatilhos), TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-16-trabalho-do-profissional-design.md`

## Restrições globais

- Comentários, mensagens e nomes de coluna em **português (PT-BR)**
- Ref do projeto Supabase: **`fmscewpxmqnbodzstiqa`**
- Migração **idempotente** — segura para rodar mais de uma vez
- Testes de autorização rodam em `BEGIN ... ROLLBACK`, **nunca** com commit
- **Proibido** apagar ou limpar dados reais; o usuário mantém contas de teste
- Toda função SQL nova: `SECURITY DEFINER` + `SET search_path = public` + `REVOKE ... FROM PUBLIC, anon`
- Erro de banco **nunca** chega cru ao usuário — a camada de API traduz
- `npm test` precisa continuar passando (23 testes hoje)
- **Não** rodar `npx eslint --fix` em arquivo existente: o repositório não aplica Prettier e reformatar enterra o diff

## O que já existe e será reaproveitado

Funções: `is_admin()`, `can_access_property(uuid)`, `can_manage_property(uuid)`,
`can_read_document(uuid)`, `can_write_document(uuid)`, `is_trusted_context()`

Tabelas: `properties` (`client_id`, `assigned_professional_id`, `status`), `process_stages`
(`property_id`, `stage_number`, `state`, `notes`), `documents` (`kind`, `origem`, `status`,
`deleted_at`, `current_version_id`), `document_versions`, `messages`, `profiles`, `user_roles`

Valores de `properties.status`: `entrada`, `analise`, `profissional`, `prefeitura`, `entregue`

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20260816_trabalho_profissional.sql` | Tabelas, colunas, funções, RLS e gatilhos |
| `supabase/migrations/verificacao/20260816_teste_rls_trabalho.sql` | Prova as regras de autorização e os gatilhos |
| `src/lib/api/etapas.ts` | Campos técnicos e estado das etapas |
| `src/lib/api/pendencias.ts` | Criar, listar e resolver pendência |
| `src/lib/api/notificacoes.ts` | Listar, contar não lidas, marcar como lida |
| `src/lib/api/aprovacoes.ts` | Pedir e decidir aprovação |
| `src/lib/api/notas.ts` | Anotação interna do processo |
| `src/integrations/supabase/types.ts` | Tipos das tabelas novas |

---

## Tarefa 1: Migração — tabelas, RLS e gatilhos

**Arquivos:**
- Criar: `supabase/migrations/20260816_trabalho_profissional.sql`

**Interfaces:**
- Consome: `is_admin()`, `can_access_property(uuid)`, `can_manage_property(uuid)`
- Produz: tabelas `pendencies`, `process_notes`, `notifications`, `approval_requests`,
  `chat_reads`; coluna `process_stages.fields`; funções `pode_gerenciar_processo(uuid)`,
  `tem_aprovacao(uuid, text, uuid)`

- [ ] **Passo 1: Escrever a migração**

Criar `supabase/migrations/20260816_trabalho_profissional.sql`:

```sql
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
    IF NOT public.tem_aprovacao(NEW.id, 'conclusao', NULL) THEN
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
      IF NOT public.tem_aprovacao(NEW.property_id, 'exclusao_documento', NEW.id) THEN
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
```

- [ ] **Passo 2: Rodar a migração**

Abrir o arquivo, copiar todo o conteúdo e colar em
<https://supabase.com/dashboard/project/fmscewpxmqnbodzstiqa/sql/new>, botão **Run**.

Esperado: `Success. No rows returned`.

- [ ] **Passo 3: Conferir que tudo entrou**

Rodar no mesmo SQL Editor:

```sql
select
  (select count(*) from information_schema.tables
     where table_schema='public'
       and table_name in ('pendencies','process_notes','notifications','approval_requests','chat_reads')) as tabelas,
  (select count(*) from information_schema.columns
     where table_name='process_stages' and column_name='fields') as coluna_fields,
  (select count(*) from pg_proc
     where proname in ('pode_gerenciar_processo','tem_aprovacao','notificar')) as funcoes,
  (select count(*) from pg_trigger where not tgisinternal
     and tgname in ('trg_notificar_mensagem','trg_ao_criar_versao_documento',
                    'trg_notificar_pendencia','trg_notificar_aprovacao',
                    'trg_enforce_conclusao_aprovada','trg_enforce_approval_update')) as gatilhos;
```

Esperado: `tabelas = 5`, `coluna_fields = 1`, `funcoes = 3`, `gatilhos = 6`.

- [ ] **Passo 4: Commit**

```bash
cd landing && git add supabase/migrations/20260816_trabalho_profissional.sql && git commit -m "feat(db): tabelas, rls e gatilhos do trabalho do profissional"
```

---

## Tarefa 2: Teste de autorização

**Arquivos:**
- Criar: `supabase/migrations/verificacao/20260816_teste_rls_trabalho.sql`

**Interfaces:**
- Consome: tudo o que a Tarefa 1 criou

- [ ] **Passo 1: Escrever o teste**

Criar `supabase/migrations/verificacao/20260816_teste_rls_trabalho.sql`:

```sql
-- ================================================================
-- TESTE DE AUTORIZAÇÃO — trabalho do profissional
-- ----------------------------------------------------------------
-- Roda inteiro em BEGIN ... ROLLBACK: cria dados fictícios e desfaz.
-- Contas de teste reais NÃO são tocadas.
--
-- IMPORTANTE: rode com o papel PADRÃO do editor (postgres), SEM ligar a
-- impersonação. O script troca de identidade sozinho; com impersonação a
-- tabela temporária não sobrevive entre instruções.
--
-- CONFERIR: todas as 17 linhas devem sair com resultado = 'OK'.
-- ================================================================
BEGIN;

CREATE TEMP TABLE r (ordem int, caso text, esperado boolean, obtido boolean);
GRANT ALL ON r TO authenticated;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('11111111-1111-1111-1111-111111111111', 'cli.t2@exemplo.invalid',  '{}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', 'prof.t2@exemplo.invalid', '{"role":"profissional"}'::jsonb),
  ('33333333-3333-3333-3333-333333333333', 'estr.t2@exemplo.invalid', '{}'::jsonb);

UPDATE public.profiles SET approval_status = 'aprovado'
 WHERE id = '22222222-2222-2222-2222-222222222222';

INSERT INTO public.properties (id, name, client_id, assigned_professional_id, status)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Imóvel frente 2',
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222', 'analise');

INSERT INTO public.process_notes (id, property_id, conteudo, autor_id)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'Cliente enrolado, cobrar todo dia', '22222222-2222-2222-2222-222222222222');

INSERT INTO public.pendencies (id, property_id, descricao, kind, criada_por)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'Envie o IPTU atualizado', 'iptu', '22222222-2222-2222-2222-222222222222');


-- ---- CLIENTE ----
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

INSERT INTO r VALUES
  (1, 'cliente NÃO lê anotação interna (nem por consulta direta)',
      true, (SELECT count(*) FROM public.process_notes) = 0),
  (2, 'cliente LÊ a pendência do processo dele',
      true, (SELECT count(*) FROM public.pendencies) = 1),
  (3, 'cliente NÃO enxerga pedidos de aprovação',
      true, (SELECT count(*) FROM public.approval_requests) = 0),
  (4, 'cliente NÃO gerencia o processo',
      false, public.pode_gerenciar_processo('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'));


-- ---- PROFISSIONAL ATRIBUÍDO ----
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

INSERT INTO r VALUES
  (5, 'profissional LÊ a anotação interna',
      true, (SELECT count(*) FROM public.process_notes) = 1),
  (6, 'profissional gerencia o processo',
      true, public.pode_gerenciar_processo('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')),
  (7, 'ainda NÃO há aprovação de conclusão',
      false, public.tem_aprovacao('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','conclusao',NULL));


-- ---- ESTRANHO ----
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

INSERT INTO r VALUES
  (8, 'estranho NÃO lê pendência',
      true, (SELECT count(*) FROM public.pendencies) = 0),
  (9, 'estranho NÃO lê anotação interna',
      true, (SELECT count(*) FROM public.process_notes) = 0);


-- ---- CONCLUSÃO SEM APROVAÇÃO É RECUSADA ----
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

DO $$
DECLARE barrou boolean := false;
BEGIN
  BEGIN
    UPDATE public.properties SET status = 'entregue'
     WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  EXCEPTION WHEN others THEN barrou := true;
  END;
  INSERT INTO r VALUES (10, 'profissional NÃO conclui processo sem aprovação', true, barrou);
END $$;


-- ---- COM APROVAÇÃO, CONCLUI ----
RESET role;
INSERT INTO public.approval_requests (property_id, tipo, status, solicitado_por)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'conclusao', 'aprovado',
        '22222222-2222-2222-2222-222222222222');

SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

DO $$
DECLARE passou boolean := true;
BEGIN
  BEGIN
    UPDATE public.properties SET status = 'entregue'
     WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  EXCEPTION WHEN others THEN passou := false;
  END;
  INSERT INTO r VALUES (11, 'com aprovação, o processo conclui', true, passou);
END $$;


-- ---- A APROVAÇÃO NÃO SE REUTILIZA ----
RESET role;
UPDATE public.properties SET status = 'analise'
 WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

DO $$
DECLARE barrou boolean := false;
BEGIN
  BEGIN
    UPDATE public.properties SET status = 'entregue'
     WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  EXCEPTION WHEN others THEN barrou := true;
  END;
  -- A aprovação foi consumida no caso 11; reconcluir exige pedido novo.
  INSERT INTO r VALUES (17, 'aprovação já usada NÃO serve de novo', true, barrou);
END $$;


-- ---- NOTIFICAÇÕES ----
RESET role;

INSERT INTO public.messages (property_id, sender_id, sender_name, content, is_client)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
        'Cliente', 'Bom dia, alguma novidade?', true);

INSERT INTO r VALUES
  (12, 'mensagem do cliente notifica o profissional',
       true, (SELECT count(*) FROM public.notifications
               WHERE user_id = '22222222-2222-2222-2222-222222222222'
                 AND tipo = 'mensagem') = 1),
  (13, 'quem enviou NÃO é notificado',
       true, (SELECT count(*) FROM public.notifications
               WHERE user_id = '11111111-1111-1111-1111-111111111111'
                 AND tipo = 'mensagem') = 0),
  (14, 'pendência criada notificou o cliente',
       true, (SELECT count(*) FROM public.notifications
               WHERE user_id = '11111111-1111-1111-1111-111111111111'
                 AND tipo = 'pendencia') = 1);


-- ---- PENDÊNCIA FECHA SOZINHA AO CHEGAR O DOCUMENTO ----
INSERT INTO public.documents (id, property_id, name, kind, origem, status)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'IPTU.pdf', 'iptu', 'cliente', 'Enviado');

INSERT INTO public.document_versions
  (document_id, version_number, storage_path, original_name, mime_type, size_bytes,
   checksum_sha256, uploaded_by)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 1, 'x/y/z', 'IPTU.pdf',
        'application/pdf', 1000, 'abc', '11111111-1111-1111-1111-111111111111');

INSERT INTO r VALUES
  (15, 'documento do tipo pedido RESOLVE a pendência',
       true, (SELECT status FROM public.pendencies
               WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc') = 'resolvida'),
  (16, 'documento do cliente notificou o profissional',
       true, (SELECT count(*) FROM public.notifications
               WHERE user_id = '22222222-2222-2222-2222-222222222222'
                 AND tipo = 'documento') = 1);


-- ---- RESULTADO ----
RESET role;

SELECT ordem, caso,
       CASE WHEN obtido IS NOT DISTINCT FROM esperado THEN 'OK' ELSE 'FALHOU' END AS resultado
FROM r ORDER BY ordem;

ROLLBACK;
```

- [ ] **Passo 2: Rodar o teste**

Copiar todo o conteúdo e colar no SQL Editor, botão **Run**.

Esperado: **17 linhas, todas com `resultado = OK`**.

Qualquer `FALHOU` é brecha de autorização ou automação quebrada — **pare e corrija antes de
seguir**. Os casos 1 e 9 são os mais importantes: provam que a anotação interna não vaza nem
por consulta direta.

- [ ] **Passo 3: Commit**

```bash
cd landing && git add supabase/migrations/verificacao/20260816_teste_rls_trabalho.sql && git commit -m "test(db): autorizacao e automacoes do trabalho do profissional"
```

---

## Tarefa 3: Tipos das tabelas novas

**Arquivos:**
- Modificar: `src/integrations/supabase/types.ts`

**Interfaces:**
- Produz: tipos `Tables<"pendencies">`, `Tables<"process_notes">`, `Tables<"notifications">`,
  `Tables<"approval_requests">`, `Tables<"chat_reads">`; campo `fields` em `process_stages`

- [ ] **Passo 1: Acrescentar `fields` em `process_stages`**

Em `src/integrations/supabase/types.ts`, dentro de `process_stages.Row`, após `notes`:

```ts
          fields: Json
```

Em `process_stages.Insert` e `process_stages.Update`, após `notes`:

```ts
          fields?: Json
```

- [ ] **Passo 2: Acrescentar as cinco tabelas**

Ainda em `types.ts`, dentro de `Tables`, após o bloco `document_versions`:

```ts
      pendencies: {
        Row: {
          id: string
          property_id: string
          stage_number: number | null
          descricao: string
          kind: string | null
          status: string
          criada_por: string | null
          criada_em: string
          resolvida_em: string | null
          resolvida_por: string | null
        }
        Insert: {
          id?: string
          property_id: string
          stage_number?: number | null
          descricao: string
          kind?: string | null
          status?: string
          criada_por?: string | null
          criada_em?: string
          resolvida_em?: string | null
          resolvida_por?: string | null
        }
        Update: {
          id?: string
          property_id?: string
          stage_number?: number | null
          descricao?: string
          kind?: string | null
          status?: string
          criada_por?: string | null
          criada_em?: string
          resolvida_em?: string | null
          resolvida_por?: string | null
        }
        Relationships: []
      }
      process_notes: {
        Row: {
          id: string
          property_id: string
          conteudo: string
          autor_id: string | null
          criada_em: string
          atualizada_em: string
        }
        Insert: {
          id?: string
          property_id: string
          conteudo: string
          autor_id?: string | null
          criada_em?: string
          atualizada_em?: string
        }
        Update: {
          id?: string
          property_id?: string
          conteudo?: string
          autor_id?: string | null
          criada_em?: string
          atualizada_em?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          property_id: string | null
          tipo: string
          titulo: string
          corpo: string | null
          lida: boolean
          criada_em: string
        }
        Insert: {
          id?: string
          user_id: string
          property_id?: string | null
          tipo: string
          titulo: string
          corpo?: string | null
          lida?: boolean
          criada_em?: string
        }
        Update: {
          id?: string
          user_id?: string
          property_id?: string | null
          tipo?: string
          titulo?: string
          corpo?: string | null
          lida?: boolean
          criada_em?: string
        }
        Relationships: []
      }
      approval_requests: {
        Row: {
          id: string
          property_id: string
          tipo: string
          document_id: string | null
          justificativa: string | null
          status: string
          solicitado_por: string | null
          solicitado_em: string
          decidido_por: string | null
          decidido_em: string | null
          motivo_recusa: string | null
        }
        Insert: {
          id?: string
          property_id: string
          tipo: string
          document_id?: string | null
          justificativa?: string | null
          status?: string
          solicitado_por?: string | null
          solicitado_em?: string
          decidido_por?: string | null
          decidido_em?: string | null
          motivo_recusa?: string | null
        }
        Update: {
          id?: string
          property_id?: string
          tipo?: string
          document_id?: string | null
          justificativa?: string | null
          status?: string
          solicitado_por?: string | null
          solicitado_em?: string
          decidido_por?: string | null
          decidido_em?: string | null
          motivo_recusa?: string | null
        }
        Relationships: []
      }
      chat_reads: {
        Row: { user_id: string; property_id: string; lido_ate: string }
        Insert: { user_id: string; property_id: string; lido_ate?: string }
        Update: { user_id?: string; property_id?: string; lido_ate?: string }
        Relationships: []
      }
```

- [ ] **Passo 3: Conferir os tipos**

```bash
cd landing && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "types.ts"
```

Esperado: nenhuma saída.

- [ ] **Passo 4: Commit**

```bash
cd landing && git add src/integrations/supabase/types.ts && git commit -m "feat(types): tabelas do trabalho do profissional"
```

---

## Tarefa 4: API de pendências

**Arquivos:**
- Criar: `src/lib/api/pendencias.ts`
- Criar: `src/lib/api/pendencias.test.ts`

**Interfaces:**
- Consome: `supabase`, `Tables<"pendencies">`, `DocumentKind`
- Produz:
  - `type Pendencia = Tables<"pendencies">`
  - `listarPendencias(propertyId: string, apenasAbertas?: boolean): Promise<Pendencia[]>`
  - `criarPendencia(p: { propertyId: string; descricao: string; kind?: DocumentKind; stageNumber?: number }): Promise<Pendencia>`
  - `resolverPendencia(id: string): Promise<void>`
  - `reabrirPendencia(id: string): Promise<void>`
  - `textoDaPendencia(p: Pendencia): string` — texto pronto para o cliente

- [ ] **Passo 1: Escrever o teste que falha**

Criar `src/lib/api/pendencias.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { textoDaPendencia } from "./pendencias";
import type { Tables } from "@/integrations/supabase/types";

function pend(over: Partial<Tables<"pendencies">> = {}): Tables<"pendencies"> {
  return {
    id: "1",
    property_id: "p1",
    stage_number: 1,
    descricao: "Envie o IPTU atualizado",
    kind: null,
    status: "aberta",
    criada_por: null,
    criada_em: "2026-08-16T10:00:00Z",
    resolvida_em: null,
    resolvida_por: null,
    ...over,
  };
}

describe("textoDaPendencia", () => {
  it("usa a descrição escrita pela equipe", () => {
    expect(textoDaPendencia(pend())).toBe("Envie o IPTU atualizado");
  });

  it("cai para um pedido genérico quando a descrição vem vazia", () => {
    expect(textoDaPendencia(pend({ descricao: "   " }))).toBe("A equipe precisa de um documento seu");
  });

  it("usa o rótulo do tipo quando há kind e a descrição está vazia", () => {
    expect(textoDaPendencia(pend({ descricao: "", kind: "iptu" }))).toBe("Envie: IPTU atualizado");
  });

  it("não inventa rótulo para kind desconhecido", () => {
    expect(textoDaPendencia(pend({ descricao: "", kind: "inexistente" }))).toBe("Envie: Documento");
  });
});
```

- [ ] **Passo 2: Rodar e confirmar que falha**

```bash
cd landing && npm test -- pendencias
```

Esperado: FALHA com `Cannot find module './pendencias'`.

- [ ] **Passo 3: Escrever a implementação**

Criar `src/lib/api/pendencias.ts`:

```ts
/**
 * Pendências — o que trava o caso.
 *
 * Criadas pela equipe, lidas também pelo cliente: é o que transforma
 * "falta o IPTU" em tarefa na tela dele, em vez de anotação perdida.
 *
 * Não há função para resolver do lado do cliente: quando ele envia o documento
 * do tipo pedido, um gatilho no banco fecha a pendência sozinho.
 */
import { supabase } from "@/integrations/supabase/client";
import { rotuloDoKind, type DocumentKind } from "@/lib/document-kinds";
import type { Tables } from "@/integrations/supabase/types";

export type Pendencia = Tables<"pendencies">;

/** Texto que o cliente lê. A descrição da equipe manda; o tipo é o reserva. */
export function textoDaPendencia(p: Pendencia): string {
  const descricao = p.descricao?.trim();
  if (descricao) return descricao;
  if (p.kind) return `Envie: ${rotuloDoKind(p.kind)}`;
  return "A equipe precisa de um documento seu";
}

export async function listarPendencias(
  propertyId: string,
  apenasAbertas = false,
): Promise<Pendencia[]> {
  let q = supabase
    .from("pendencies")
    .select("*")
    .eq("property_id", propertyId)
    .order("criada_em", { ascending: false });

  if (apenasAbertas) q = q.eq("status", "aberta");

  const { data, error } = await q;
  // Detalhe do Postgres não interessa a quem está na tela.
  if (error) throw new Error("Não foi possível carregar as pendências.");
  return data ?? [];
}

export async function criarPendencia(p: {
  propertyId: string;
  descricao: string;
  kind?: DocumentKind;
  stageNumber?: number;
}): Promise<Pendencia> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("pendencies")
    .insert({
      property_id: p.propertyId,
      descricao: p.descricao.trim(),
      kind: p.kind ?? null,
      stage_number: p.stageNumber ?? null,
      criada_por: user?.id ?? null,
    })
    .select()
    .single();

  if (error || !data) throw new Error("Não foi possível registrar a pendência.");
  return data;
}

export async function resolverPendencia(id: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("pendencies")
    .update({ status: "resolvida", resolvida_em: new Date().toISOString(), resolvida_por: user?.id ?? null })
    .eq("id", id);
  if (error) throw new Error("Não foi possível resolver a pendência.");
}

export async function reabrirPendencia(id: string): Promise<void> {
  const { error } = await supabase
    .from("pendencies")
    .update({ status: "aberta", resolvida_em: null, resolvida_por: null })
    .eq("id", id);
  if (error) throw new Error("Não foi possível reabrir a pendência.");
}
```

- [ ] **Passo 4: Rodar e confirmar que passa**

```bash
cd landing && npm test -- pendencias
```

Esperado: PASSA, 4 testes.

- [ ] **Passo 5: Commit**

```bash
cd landing && git add src/lib/api/pendencias.ts src/lib/api/pendencias.test.ts && git commit -m "feat(api): pendencias"
```

---

## Tarefa 5: API de notificações, etapas, anotações e aprovações

**Arquivos:**
- Criar: `src/lib/api/notificacoes.ts`
- Criar: `src/lib/api/etapas.ts`
- Criar: `src/lib/api/notas.ts`
- Criar: `src/lib/api/aprovacoes.ts`

**Interfaces:**
- Consome: `supabase`, os tipos da Tarefa 3
- Produz:
  - `listarNotificacoes(limite?: number): Promise<Notificacao[]>`
  - `contarNaoLidas(): Promise<number>`
  - `marcarComoLida(id: string): Promise<void>`
  - `marcarTodasComoLidas(): Promise<void>`
  - `carregarCampos(propertyId: string, stageNumber: number): Promise<Record<string, unknown>>`
  - `salvarCampos(propertyId: string, stageNumber: number, campos: Record<string, unknown>): Promise<void>`
  - `carregarNota(propertyId: string): Promise<string>`
  - `salvarNota(propertyId: string, conteudo: string): Promise<void>`
  - `pedirAprovacao(p: { propertyId: string; tipo: TipoAprovacao; documentId?: string; justificativa?: string }): Promise<void>`
  - `listarAprovacoesPendentes(): Promise<Aprovacao[]>`
  - `decidirAprovacao(id: string, aprovado: boolean, motivo?: string): Promise<void>`
  - `type TipoAprovacao = "conclusao" | "exclusao_documento"`

- [ ] **Passo 1: Criar `notificacoes.ts`**

```ts
/**
 * Notificações — o sino do painel.
 *
 * Nenhuma função cria notificação: elas nascem de gatilhos no banco, quando
 * chega mensagem, documento, pendência ou pedido de aprovação. Daqui só se lê
 * e se marca como lida.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Notificacao = Tables<"notifications">;

export async function listarNotificacoes(limite = 30): Promise<Notificacao[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("criada_em", { ascending: false })
    .limit(limite);
  if (error) throw new Error("Não foi possível carregar as notificações.");
  return data ?? [];
}

export async function contarNaoLidas(): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("lida", false);
  // Contador é enfeite: falhar aqui não deve quebrar a tela.
  if (error) return 0;
  return count ?? 0;
}

export async function marcarComoLida(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ lida: true }).eq("id", id);
  if (error) throw new Error("Não foi possível marcar como lida.");
}

export async function marcarTodasComoLidas(): Promise<void> {
  const { error } = await supabase.from("notifications").update({ lida: true }).eq("lida", false);
  if (error) throw new Error("Não foi possível marcar as notificações.");
}
```

- [ ] **Passo 2: Criar `etapas.ts`**

```ts
/**
 * Campos técnicos das etapas.
 *
 * Guardados em process_stages.fields (jsonb). A tabela é legível pelo cliente
 * de propósito: data de vistoria e número de protocolo são o andamento do caso
 * DELE. O que é interno vai para process_notes.
 */
import { supabase } from "@/integrations/supabase/client";

export type CamposEtapa = Record<string, unknown>;

export async function carregarCampos(
  propertyId: string,
  stageNumber: number,
): Promise<CamposEtapa> {
  const { data, error } = await supabase
    .from("process_stages")
    .select("fields")
    .eq("property_id", propertyId)
    .eq("stage_number", stageNumber)
    .maybeSingle();

  if (error) throw new Error("Não foi possível carregar os dados da etapa.");
  return (data?.fields as CamposEtapa) ?? {};
}

export async function salvarCampos(
  propertyId: string,
  stageNumber: number,
  campos: CamposEtapa,
): Promise<void> {
  const { error } = await supabase
    .from("process_stages")
    .update({ fields: campos, updated_at: new Date().toISOString() })
    .eq("property_id", propertyId)
    .eq("stage_number", stageNumber);

  if (error) throw new Error("Não foi possível salvar os dados da etapa.");
}
```

- [ ] **Passo 3: Criar `notas.ts`**

```ts
/**
 * Anotação interna do processo.
 *
 * Tabela própria por privacidade: process_stages é legível pelo cliente e a
 * RLS filtra linha, não coluna — guardar ali vazaria o conteúdo numa consulta
 * direta, mesmo sem aparecer na tela dele. Aqui o cliente não tem política
 * nenhuma, então a consulta dele volta vazia.
 *
 * Uma anotação por processo: a interface é um campo de texto único, e várias
 * linhas só criariam a dúvida de qual é a boa.
 */
import { supabase } from "@/integrations/supabase/client";

export async function carregarNota(propertyId: string): Promise<string> {
  const { data, error } = await supabase
    .from("process_notes")
    .select("conteudo")
    .eq("property_id", propertyId)
    .order("criada_em", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error("Não foi possível carregar as anotações.");
  return data?.conteudo ?? "";
}

export async function salvarNota(propertyId: string, conteudo: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: existente } = await supabase
    .from("process_notes")
    .select("id")
    .eq("property_id", propertyId)
    .order("criada_em", { ascending: true })
    .limit(1)
    .maybeSingle();

  const erro = existente
    ? (await supabase
        .from("process_notes")
        .update({ conteudo, atualizada_em: new Date().toISOString() })
        .eq("id", existente.id)).error
    : (await supabase
        .from("process_notes")
        .insert({ property_id: propertyId, conteudo, autor_id: user?.id ?? null })).error;

  if (erro) throw new Error("Não foi possível salvar as anotações.");
}
```

- [ ] **Passo 4: Criar `aprovacoes.ts`**

```ts
/**
 * Pedidos de aprovação do admin.
 *
 * A regra é imposta por gatilho no banco: concluir processo e excluir
 * documento falham sem pedido aprovado. Estas funções só criam e decidem o
 * pedido — não são elas que garantem a regra, e é por isso que a garantia
 * sobrevive a qualquer chamada direta à API.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Aprovacao = Tables<"approval_requests">;
export type TipoAprovacao = "conclusao" | "exclusao_documento";

export async function pedirAprovacao(p: {
  propertyId: string;
  tipo: TipoAprovacao;
  documentId?: string;
  justificativa?: string;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("approval_requests").insert({
    property_id: p.propertyId,
    tipo: p.tipo,
    document_id: p.documentId ?? null,
    justificativa: p.justificativa ?? null,
    solicitado_por: user?.id ?? null,
  });

  if (error) throw new Error("Não foi possível enviar o pedido.");
}

export async function listarAprovacoesPendentes(): Promise<Aprovacao[]> {
  const { data, error } = await supabase
    .from("approval_requests")
    .select("*")
    .eq("status", "pendente")
    .order("solicitado_em", { ascending: false });

  if (error) throw new Error("Não foi possível carregar os pedidos.");
  return data ?? [];
}

export async function decidirAprovacao(
  id: string,
  aprovado: boolean,
  motivo?: string,
): Promise<void> {
  const { error } = await supabase
    .from("approval_requests")
    .update({
      status: aprovado ? "aprovado" : "recusado",
      motivo_recusa: aprovado ? null : (motivo ?? null),
    })
    .eq("id", id);

  // O gatilho recusa decidir de novo um pedido já decidido.
  if (error) throw new Error("Não foi possível registrar a decisão.");
}
```

- [ ] **Passo 5: Conferir tipos e testes**

```bash
cd landing && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "notificacoes|etapas|notas|aprovacoes"; npm test 2>&1 | grep -E "Tests.*passed"
```

Esperado: nenhum erro de tipo; 27 testes passando (23 anteriores + 4 de pendências).

- [ ] **Passo 6: Commit**

```bash
cd landing && git add src/lib/api/ && git commit -m "feat(api): notificacoes, etapas, notas e aprovacoes"
```

---

## Autorrevisão do plano

**Cobertura do spec**

| Requisito | Tarefa |
|---|---|
| `process_stages.fields` | 1, 5 |
| Tabela `pendencies` + RLS | 1 |
| Resolução automática da pendência | 1 (gatilho), 2 (teste 15) |
| `process_notes` invisível ao cliente | 1, 2 (testes 1 e 9), 5 |
| `notifications` + quem recebe o quê | 1 (gatilhos), 2 (testes 12–14, 16) |
| Ninguém é notificado da própria ação | 1 (`notificar`), 2 (teste 13) |
| `approval_requests` + decisão única | 1 |
| Aprovação imposta no banco | 1, 2 (testes 10 e 11) |
| `chat_reads` | 1 |
| Camada de API | 4, 5 |
| Tipos TypeScript | 3 |

Fora deste plano, por decisão de escopo: toda a interface (planos 2 e 3) e o resumo por
e-mail (segunda etapa das notificações, conforme o spec).

**Consistência de nomes:** `pode_gerenciar_processo`, `tem_aprovacao`, `notificar`,
`listarPendencias`, `criarPendencia`, `resolverPendencia`, `reabrirPendencia`,
`textoDaPendencia`, `carregarCampos`, `salvarCampos`, `carregarNota`, `salvarNota`,
`pedirAprovacao`, `listarAprovacoesPendentes`, `decidirAprovacao`, `contarNaoLidas`,
`marcarComoLida`, `marcarTodasComoLidas` — conferidos entre definição e uso.

**Ordem das dependências:** 1 → 2 → 3 → 4 → 5. A Tarefa 2 depende da 1 estar rodada no banco.
