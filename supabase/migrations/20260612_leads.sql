-- ============================================================
-- Migração: tabela de leads (captura pré-signup)
-- Rodar em: Supabase › SQL Editor › New Query › Run
-- ============================================================

CREATE TABLE IF NOT EXISTS public.leads (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text,
  email       text        NOT NULL,
  phone       text,
  city        text,
  state       text,
  tipo_imovel text,
  situacao    text,
  objetivo    text,
  urgencia    text,
  notes       text,
  source      text        DEFAULT 'site',
  converted   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Anon pode inserir (formulário público); admin pode ver/editar tudo
CREATE POLICY "leads_insert_public" ON public.leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "leads_select_admin" ON public.leads
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "leads_update_admin" ON public.leads
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "leads_delete_admin" ON public.leads
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Grants
GRANT INSERT ON public.leads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
