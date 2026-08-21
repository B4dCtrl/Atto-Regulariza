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
-- Necessário porque os casos são inseridos já sob o papel `authenticated`.
GRANT ALL ON r TO authenticated;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('11111111-1111-1111-1111-111111111111', 'cli.t2@exemplo.invalid',  '{}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', 'prof.t2@exemplo.invalid', '{"role":"profissional"}'::jsonb),
  ('33333333-3333-3333-3333-333333333333', 'estr.t2@exemplo.invalid', '{}'::jsonb);

-- O gatilho trg_handle_new_user já criou os perfis; o profissional nasce
-- 'pendente' e precisa estar aprovado para receber processo.
UPDATE public.profiles SET approval_status = 'aprovado'
 WHERE id = '22222222-2222-2222-2222-222222222222';

INSERT INTO public.properties (id, name, client_id, assigned_professional_id, status)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Imóvel frente 2',
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222', 'analise');

INSERT INTO public.process_notes (id, property_id, conteudo, autor_id)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'Cliente enrolado, cobrar todo dia', '22222222-2222-2222-2222-222222222222');

-- Dispara trg_notificar_pendencia: o autor é o profissional e o destinatário é
-- o cliente, então a notificação de tipo 'pendencia' É criada (caso 14).
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
-- Voltar o status como postgres não passa pela exigência: o gatilho só cobra
-- aprovação quando o novo status é 'entregue'.
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
