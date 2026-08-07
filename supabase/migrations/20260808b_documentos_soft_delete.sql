-- ================================================================
-- COERÊNCIA DA EXCLUSÃO LÓGICA — 2026-08-08
-- ----------------------------------------------------------------
-- can_read_document e can_write_document não olhavam documents.deleted_at.
-- Consequências:
--   - documento "removido" continuava abrível por quem soubesse o version_id,
--     porque a policy de document_versions delega a can_read_document
--   - documento removido aceitava nova versão
--
-- Regras adotadas:
--   LEITURA  — o cliente perde o acesso ao excluir; admin e profissional
--              atribuído continuam vendo. A exclusão é para tirar da vista do
--              cliente, e o histórico existe justamente para proteger a equipe
--              numa exigência de cartório: apagá-lo da visão dela derrotaria o
--              propósito de não fazer hard delete.
--   ESCRITA  — ninguém versiona documento excluído. Reviver é operação
--              distinta, não efeito colateral de um envio.
--
-- Idempotente — seguro rodar mais de uma vez.
-- Rodar em: Supabase › SQL Editor › New Query › Run
-- ================================================================

CREATE OR REPLACE FUNCTION public.can_read_document(_document_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.documents d
    JOIN public.properties p ON p.id = d.property_id
    WHERE d.id = _document_id
      AND (
        -- Equipe enxerga inclusive o que foi excluído: é o histórico dela.
        public.is_admin()
        OR p.assigned_professional_id = auth.uid()
        OR (
          p.client_id = auth.uid()
          AND d.deleted_at IS NULL
          AND ( d.origem = 'cliente' OR p.status = 'entregue' )
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_write_document(_document_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.documents d
    JOIN public.properties p ON p.id = d.property_id
    WHERE d.id = _document_id
      AND d.deleted_at IS NULL   -- documento excluído não recebe nova versão
      AND (
        public.is_admin()
        OR p.assigned_professional_id = auth.uid()
        OR ( p.client_id = auth.uid() AND d.origem = 'cliente' )
      )
  )
$$;

-- ================================================================
-- VERIFICAÇÃO — todas as linhas devem sair 'OK'.
-- Roda em BEGIN/ROLLBACK: nada persiste, contas de teste intactas.
-- Rodar com o papel PADRÃO do editor, SEM impersonação (o script troca de
-- identidade sozinho; com impersonação a tabela temporária não sobrevive).
-- ================================================================
BEGIN;

CREATE TEMP TABLE r (ordem int, caso text, esperado boolean, obtido boolean);
GRANT ALL ON r TO authenticated;

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('11111111-1111-1111-1111-111111111111', 'cli.sd@exemplo.invalid',  '{}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', 'prof.sd@exemplo.invalid', '{"role":"profissional"}'::jsonb);

UPDATE public.profiles SET approval_status = 'aprovado'
 WHERE id = '22222222-2222-2222-2222-222222222222';

INSERT INTO public.properties (id, name, client_id, assigned_professional_id, status)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Imóvel soft-delete',
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222', 'analise');

-- Documento do cliente, JÁ EXCLUÍDO logicamente
INSERT INTO public.documents (id, property_id, name, kind, origem, status, deleted_at)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'Matrícula antiga.pdf', 'matricula', 'cliente', 'Enviado', now());

SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
INSERT INTO r VALUES
  (1, 'cliente NÃO lê documento excluído',
      false, public.can_read_document('dddddddd-dddd-dddd-dddd-dddddddddddd')),
  (2, 'cliente NÃO versiona documento excluído',
      false, public.can_write_document('dddddddd-dddd-dddd-dddd-dddddddddddd')),
  (3, 'POLICY: documento excluído some da listagem do cliente',
      true,  (SELECT count(*) FROM public.documents
               WHERE property_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 0);

SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
INSERT INTO r VALUES
  (4, 'profissional AINDA lê documento excluído (histórico da equipe)',
      true,  public.can_read_document('dddddddd-dddd-dddd-dddd-dddddddddddd')),
  (5, 'profissional NÃO versiona documento excluído',
      false, public.can_write_document('dddddddd-dddd-dddd-dddd-dddddddddddd'));

RESET role;

SELECT ordem, caso,
       CASE WHEN obtido IS NOT DISTINCT FROM esperado THEN 'OK' ELSE 'FALHOU' END AS resultado
FROM r ORDER BY ordem;

ROLLBACK;
