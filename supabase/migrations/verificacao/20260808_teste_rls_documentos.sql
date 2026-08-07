-- ================================================================
-- TESTE DE AUTORIZAÇÃO — documentos
-- ----------------------------------------------------------------
-- Prova as regras de visibilidade sem gravar nada: tudo roda dentro de uma
-- transação que termina em ROLLBACK. Cria usuários e processos fictícios e
-- desfaz ao final — contas de teste reais ficam intactas.
--
-- Os resultados são acumulados numa tabela temporária e impressos por um único
-- SELECT no fim: o SQL Editor do Supabase exibe apenas o resultado da ÚLTIMA
-- instrução, então vários SELECTs soltos esconderiam quase tudo.
--
-- Testa as funções de decisão E as policies. Testar só a função deixaria passar
-- um erro no USING da policy — a função certa com a policy errada continua
-- vazando dado.
--
-- Rodar em: Supabase › SQL Editor › New Query › Run
-- CONFERIR: todas as 14 linhas devem sair com resultado = 'OK'.
-- ================================================================
BEGIN;

CREATE TEMP TABLE resultado_teste (
  ordem    int,
  caso     text,
  esperado boolean,
  obtido   boolean
);
-- Necessário porque os casos são inseridos já sob o papel `authenticated`.
GRANT ALL ON resultado_teste TO authenticated;

-- ---------------------------------------------------------------
-- Cenário
-- ---------------------------------------------------------------
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'cliente.teste@exemplo.invalid',  '{}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', 'prof.teste@exemplo.invalid',     '{"role":"profissional"}'::jsonb),
  ('33333333-3333-3333-3333-333333333333', 'estranho.teste@exemplo.invalid', '{}'::jsonb);

-- O trigger trg_handle_new_user já criou os perfis; o profissional nasce
-- 'pendente' e precisa estar aprovado para receber processo.
UPDATE public.profiles SET approval_status = 'aprovado'
 WHERE id = '22222222-2222-2222-2222-222222222222';

-- Processo EM ANDAMENTO, com profissional designado
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


-- ---------------------------------------------------------------
-- CLIENTE — processo em andamento
-- ---------------------------------------------------------------
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

INSERT INTO resultado_teste VALUES
  (1, 'cliente lê o próprio documento',
      true,  public.can_read_document('dddddddd-dddd-dddd-dddd-dddddddddddd')),
  (2, 'cliente NÃO lê peça técnica durante o processo',
      false, public.can_read_document('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')),
  (3, 'cliente NÃO versiona peça técnica',
      false, public.can_write_document('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')),
  (4, 'cliente versiona documento próprio',
      true,  public.can_write_document('dddddddd-dddd-dddd-dddd-dddddddddddd')),
  -- Policy, não função: prova que documents_select aplica a mesma trava.
  (5, 'POLICY: cliente enxerga só 1 documento na listagem',
      true,  (SELECT count(*) FROM public.documents
               WHERE property_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 1);


-- ---------------------------------------------------------------
-- PROFISSIONAL designado
-- ---------------------------------------------------------------
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

INSERT INTO resultado_teste VALUES
  (6, 'profissional lê documento do cliente',
      true,  public.can_read_document('dddddddd-dddd-dddd-dddd-dddddddddddd')),
  (7, 'profissional lê a própria peça técnica',
      true,  public.can_read_document('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')),
  (8, 'profissional versiona documento do cliente',
      true,  public.can_write_document('dddddddd-dddd-dddd-dddd-dddddddddddd')),
  (9, 'POLICY: profissional enxerga os 2 documentos',
      true,  (SELECT count(*) FROM public.documents
               WHERE property_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 2);


-- ---------------------------------------------------------------
-- ESTRANHO — sem relação com o processo
-- ---------------------------------------------------------------
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

INSERT INTO resultado_teste VALUES
  (10, 'estranho NÃO lê documento do cliente',
       false, public.can_read_document('dddddddd-dddd-dddd-dddd-dddddddddddd')),
  (11, 'estranho NÃO lê peça técnica',
       false, public.can_read_document('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')),
  (12, 'POLICY: estranho não enxerga documento nenhum',
       true,  (SELECT count(*) FROM public.documents
                WHERE property_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 0);


-- ---------------------------------------------------------------
-- PROCESSO ENTREGUE — a peça técnica é liberada ao cliente
-- ---------------------------------------------------------------
RESET role;  -- volta ao papel da sessão para poder alterar o processo

UPDATE public.properties SET status = 'entregue'
 WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

INSERT INTO resultado_teste VALUES
  (13, 'cliente lê peça técnica APÓS a entrega',
       true, public.can_read_document('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')),
  (14, 'POLICY: cliente enxerga os 2 documentos após a entrega',
       true, (SELECT count(*) FROM public.documents
               WHERE property_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 2);


-- ---------------------------------------------------------------
-- RESULTADO — único SELECT, para o SQL Editor mostrar tudo
-- ---------------------------------------------------------------
RESET role;

SELECT
  ordem,
  caso,
  CASE WHEN obtido IS NOT DISTINCT FROM esperado THEN 'OK' ELSE 'FALHOU' END AS resultado
FROM resultado_teste
ORDER BY ordem;

ROLLBACK;
