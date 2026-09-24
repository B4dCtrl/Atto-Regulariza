-- ================================================================
-- BRIEFING QUE SE ATUALIZA SOZINHO — 2026-09-24
-- ----------------------------------------------------------------
-- O texto da IA no painel do admin era gerado uma vez por dia e só mudava
-- no botão "Atualizar": conta, admin, documento ou processo que surgisse
-- depois não aparecia no texto até o dia seguinte.
--
-- Agora a server function guarda, junto com o texto, a ASSINATURA (sha256)
-- dos dados que ele descreve. A cada abertura compara com a de agora; se
-- mudou e o texto tem 15 min ou mais, gera outro. Regra e testes em
-- src/lib/api/assinatura-briefing.ts.
--
-- Nula nas linhas antigas: conta como "diferente", e o texto do dia é
-- refeito na primeira abertura depois de rodar isto.
--
-- Permissões não mudam: a tabela continua sem acesso para `authenticated`
-- (quem lê e escreve é a server function, com service_role).
--
-- Idempotente — seguro rodar mais de uma vez.
-- Rodar em: Supabase › SQL Editor › New Query › Run
-- ================================================================

ALTER TABLE public.briefings_admin
  ADD COLUMN IF NOT EXISTS assinatura text;


-- ================================================================
-- VERIFICAÇÃO — devolve uma linha por checagem, todas 'OK'.
-- ================================================================
SELECT 'coluna assinatura existe' AS verificacao,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='briefings_admin'
           AND column_name='assinatura'
       ) THEN 'OK' ELSE 'FALHA' END AS resultado
UNION ALL
SELECT 'briefings_admin continua sem acesso para authenticated',
       CASE WHEN has_table_privilege('authenticated','public.briefings_admin','SELECT')
            THEN 'FALHA' ELSE 'OK' END;
