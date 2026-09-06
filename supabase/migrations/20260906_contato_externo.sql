-- ================================================================
-- CONTATO DE CANAL EXTERNO — 2026-09-06
-- ----------------------------------------------------------------
-- Lead que chega pelo Instagram não tem telefone nem e-mail: tem o id do
-- perfil. A trava criada hoje de manhã exigia um dos dois, então esses leads
-- eram recusados na inserção e nunca apareciam no painel.
--
-- Guardar o id do Instagram na coluna 'phone' seria pior: daria um número que
-- ninguém consegue discar, e a equipe tentaria ligar.
--
-- Idempotente — seguro rodar mais de uma vez.
-- ================================================================

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS contato_externo text;

COMMENT ON COLUMN public.leads.contato_externo IS
  'Identificador da pessoa no canal de origem (ex.: id do perfil do Instagram). Não é telefone.';

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_tem_contato_ck;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_tem_contato_ck
  CHECK (email IS NOT NULL OR phone IS NOT NULL OR contato_externo IS NOT NULL);
