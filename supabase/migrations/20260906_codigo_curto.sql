-- ================================================================
-- CÓDIGO CURTO DO CASO — 2026-09-06
-- ----------------------------------------------------------------
-- Vira o link que o cliente recebe no fim da triagem:
-- atoregulariza.com.br/f/K7M2QX — em vez de um wa.me com o resumo inteiro
-- codificado na URL, que passava de 200 caracteres e parecia golpe.
--
-- O código é público no sentido de estar na URL, mas imprevisível: 30 símbolos
-- em 6 posições dão 729 milhões de combinações. Não é segredo, é identificador.
--
-- Idempotente — seguro rodar mais de uma vez.
-- Rodar em: Supabase › SQL Editor › New Query › Run
-- ================================================================

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS codigo text;

COMMENT ON COLUMN public.leads.codigo IS
  'Código curto público do caso, usado no link /f/<codigo>. Não é segredo, mas é imprevisível.';

-- Único, e só entre os que têm código: leads antigos ficam nulos.
CREATE UNIQUE INDEX IF NOT EXISTS leads_codigo_idx
  ON public.leads (codigo) WHERE codigo IS NOT NULL;
