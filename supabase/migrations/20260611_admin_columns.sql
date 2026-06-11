-- ============================================================
-- Migração: limpar dados demo + colunas de contato/intake
-- Rodar em: Supabase › SQL Editor › New Query › Run
-- ============================================================

-- 1) Limpar todos os dados de demonstração (ordem FK reversa)
DELETE FROM public.messages;
DELETE FROM public.documents;
DELETE FROM public.process_stages;
DELETE FROM public.properties;
DELETE FROM public.profiles;

-- 2) Adicionar colunas de contato e intake do processo
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS client_name  text,
  ADD COLUMN IF NOT EXISTS client_email text,
  ADD COLUMN IF NOT EXISTS client_phone text,
  ADD COLUMN IF NOT EXISTS client_cpf   text,
  ADD COLUMN IF NOT EXISTS tipo_imovel  text,
  ADD COLUMN IF NOT EXISTS situacao     text,
  ADD COLUMN IF NOT EXISTS objetivo     text,
  ADD COLUMN IF NOT EXISTS urgencia     text,
  ADD COLUMN IF NOT EXISTS notes        text;
