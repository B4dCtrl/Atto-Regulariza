-- ================================================================
-- TESTE DE AUTORIZAÇÃO DO PAINEL GERENCIAL
-- ----------------------------------------------------------------
-- Roda em BEGIN ... ROLLBACK: NADA é gravado. Seguro no banco real.
-- Rodar em: Supabase › SQL Editor › New Query › Run (selecione tudo)
-- ================================================================
BEGIN;

CREATE TEMP TABLE r (caso text, esperado text, obtido text) ON COMMIT DROP;
GRANT ALL ON r TO authenticated;

-- Três identidades de teste, criadas e desfeitas dentro da transação.
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('11111111-1111-1111-1111-111111111111', 'adm@teste.local', '{}'::jsonb),
       ('22222222-2222-2222-2222-222222222222', 'cli@teste.local', '{}'::jsonb),
       ('33333333-3333-3333-3333-333333333333', 'pro@teste.local', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES ('11111111-1111-1111-1111-111111111111', 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO public.acessos (user_id, painel)
VALUES ('22222222-2222-2222-2222-222222222222', 'cliente');

-- ---- CASO 1: cliente não vê acesso alheio ----
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333"}';
INSERT INTO r
SELECT 'cliente nao ve acesso alheio', '0', count(*)::text
FROM public.acessos WHERE user_id = '22222222-2222-2222-2222-222222222222';
RESET ROLE;

-- ---- CASO 2: admin vê tudo ----
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
INSERT INTO r
SELECT 'admin ve acesso alheio', '1', count(*)::text
FROM public.acessos WHERE user_id = '22222222-2222-2222-2222-222222222222';
RESET ROLE;

-- ---- CASO 3: ninguém registra acesso em nome de outro ----
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333"}';
DO $$
BEGIN
  INSERT INTO public.acessos (user_id, painel)
  VALUES ('22222222-2222-2222-2222-222222222222', 'cliente');
  INSERT INTO r VALUES ('nao registra acesso alheio', 'recusado', 'ACEITOU');
EXCEPTION WHEN insufficient_privilege OR check_violation THEN
  INSERT INTO r VALUES ('nao registra acesso alheio', 'recusado', 'recusado');
END $$;
RESET ROLE;

-- ---- CASO 4: authenticated não lê briefings_admin ----
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
DO $$
BEGIN
  PERFORM 1 FROM public.briefings_admin LIMIT 1;
  INSERT INTO r VALUES ('briefing fechado ao front', 'recusado', 'ACEITOU');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO r VALUES ('briefing fechado ao front', 'recusado', 'recusado');
END $$;
RESET ROLE;

SELECT caso, esperado, obtido,
       CASE WHEN esperado = obtido THEN 'OK' ELSE 'FALHA' END AS resultado
FROM r ORDER BY caso;

ROLLBACK;
