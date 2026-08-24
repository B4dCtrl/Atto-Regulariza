-- ================================================================
-- TESTE DA TRAVA DE DELEGAÇÃO
-- ----------------------------------------------------------------
-- Roda em BEGIN ... ROLLBACK: NADA é gravado. Seguro no banco real.
-- Rodar em: Supabase › SQL Editor › New Query › Run (selecione tudo)
-- ================================================================
BEGIN;

CREATE TEMP TABLE r (caso text, esperado text, obtido text) ON COMMIT DROP;

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'cli@teste.local', '{}'::jsonb),
       ('aaaaaaaa-0000-0000-0000-000000000002', 'pro@teste.local', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, name, email, role, approval_status)
VALUES ('aaaaaaaa-0000-0000-0000-000000000002', 'Pro Teste', 'pro@teste.local',
        'profissional', 'aprovado')
ON CONFLICT (id) DO UPDATE SET role='profissional', approval_status='aprovado';

INSERT INTO public.properties (id, name, client_id, status, current_stage, progress)
VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'Casa do teste',
        'aaaaaaaa-0000-0000-0000-000000000001', 'entrada', 1, 0);

-- ---- CASO 1: sem documento nenhum, delegar falha ----
DO $$
BEGIN
  UPDATE public.properties
  SET assigned_professional_id = 'aaaaaaaa-0000-0000-0000-000000000002'
  WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001';
  INSERT INTO r VALUES ('delegar sem essencial', 'recusado', 'ACEITOU');
EXCEPTION WHEN raise_exception THEN
  INSERT INTO r VALUES ('delegar sem essencial', 'recusado', 'recusado');
END $$;

-- ---- CASO 2: com só um essencial aprovado, ainda falha ----
INSERT INTO public.documents (property_id, name, kind, origem, status)
VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'rg.pdf', 'identidade', 'cliente', 'Aprovado');

DO $$
BEGIN
  UPDATE public.properties
  SET assigned_professional_id = 'aaaaaaaa-0000-0000-0000-000000000002'
  WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001';
  INSERT INTO r VALUES ('delegar com um essencial', 'recusado', 'ACEITOU');
EXCEPTION WHEN raise_exception THEN
  INSERT INTO r VALUES ('delegar com um essencial', 'recusado', 'recusado');
END $$;

-- ---- CASO 3: com os dois aprovados, passa ----
INSERT INTO public.documents (property_id, name, kind, origem, status)
VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'conta.pdf',
        'comprovante_endereco', 'cliente', 'Aprovado');

DO $$
BEGIN
  UPDATE public.properties
  SET assigned_professional_id = 'aaaaaaaa-0000-0000-0000-000000000002'
  WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001';
  INSERT INTO r VALUES ('delegar com os dois', 'aceito', 'aceito');
EXCEPTION WHEN raise_exception THEN
  INSERT INTO r VALUES ('delegar com os dois', 'aceito', 'RECUSOU');
END $$;

-- ---- CASO 4: matrícula não é exigida ----
INSERT INTO r
SELECT 'matricula nao trava', 'true', public.essenciais_aprovados(
  'bbbbbbbb-0000-0000-0000-000000000001')::text;

-- ---- CASO 5: o estado virou PRONTO_PARA_DELEGACAO ----
INSERT INTO r
SELECT 'coleta recalculada', 'PRONTO_PARA_DELEGACAO', coleta
FROM public.properties WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001';

SELECT caso, esperado, obtido,
       CASE WHEN esperado = obtido THEN 'OK' ELSE 'FALHA' END AS resultado
FROM r ORDER BY caso;

ROLLBACK;
