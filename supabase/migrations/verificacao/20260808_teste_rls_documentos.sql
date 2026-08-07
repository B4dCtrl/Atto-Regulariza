-- ================================================================
-- TESTE DE AUTORIZAÇÃO — documentos
-- ----------------------------------------------------------------
-- Prova as regras de visibilidade sem gravar nada: tudo roda dentro de
-- uma transação que termina em ROLLBACK.
--
-- Rodar em: Supabase › SQL Editor. Conferir que TODAS as linhas do
-- resultado tenham resultado = 'OK'.
-- ================================================================
BEGIN;

-- Usuários de teste
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'cliente.teste@exemplo.com',  '{}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', 'prof.teste@exemplo.com',     '{"role":"profissional"}'::jsonb),
  ('33333333-3333-3333-3333-333333333333', 'estranho.teste@exemplo.com', '{}'::jsonb);

UPDATE public.profiles SET approval_status = 'aprovado'
 WHERE id = '22222222-2222-2222-2222-222222222222';

-- Processo em andamento, com profissional designado
INSERT INTO public.properties (id, name, client_id, assigned_professional_id, status)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Imóvel de teste',
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222', 'analise');

-- Um documento de cada origem
INSERT INTO public.documents (id, property_id, name, kind, origem, status)
VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Matrícula.pdf', 'matricula', 'cliente', 'Enviado'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'ART.pdf', 'art_rrt', 'profissional', 'Enviado');

-- ---- Cliente, processo em andamento ----
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

SELECT 'cliente lê o próprio documento' AS caso,
       CASE WHEN public.can_read_document('dddddddd-dddd-dddd-dddd-dddddddddddd')
            THEN 'OK' ELSE 'FALHOU' END AS resultado
UNION ALL
SELECT 'cliente NÃO lê peça técnica em andamento',
       CASE WHEN NOT public.can_read_document('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')
            THEN 'OK' ELSE 'FALHOU' END
UNION ALL
SELECT 'cliente NÃO versiona peça técnica',
       CASE WHEN NOT public.can_write_document('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')
            THEN 'OK' ELSE 'FALHOU' END
UNION ALL
SELECT 'cliente versiona documento próprio',
       CASE WHEN public.can_write_document('dddddddd-dddd-dddd-dddd-dddddddddddd')
            THEN 'OK' ELSE 'FALHOU' END;

-- ---- Profissional designado ----
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

SELECT 'profissional lê os dois documentos' AS caso,
       CASE WHEN public.can_read_document('dddddddd-dddd-dddd-dddd-dddddddddddd')
             AND public.can_read_document('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')
            THEN 'OK' ELSE 'FALHOU' END AS resultado
UNION ALL
SELECT 'profissional versiona documento do cliente',
       CASE WHEN public.can_write_document('dddddddd-dddd-dddd-dddd-dddddddddddd')
            THEN 'OK' ELSE 'FALHOU' END;

-- ---- Usuário sem relação com o processo ----
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

SELECT 'estranho não lê nada' AS caso,
       CASE WHEN NOT public.can_read_document('dddddddd-dddd-dddd-dddd-dddddddddddd')
             AND NOT public.can_read_document('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')
            THEN 'OK' ELSE 'FALHOU' END AS resultado;

-- ---- Processo entregue: peça técnica é liberada ----
SET LOCAL role = postgres;
UPDATE public.properties SET status = 'entregue'
 WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

SELECT 'cliente lê peça técnica após entrega' AS caso,
       CASE WHEN public.can_read_document('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')
            THEN 'OK' ELSE 'FALHOU' END AS resultado;

ROLLBACK;
