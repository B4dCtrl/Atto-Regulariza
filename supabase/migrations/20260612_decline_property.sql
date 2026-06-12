-- ============================================================
-- Permite que o PROFISSIONAL atribuído recuse um caso (devolve à equipe).
-- A policy properties_update exige assigned_professional_id = auth.uid() no
-- WITH CHECK, então o profissional não consegue setar NULL diretamente.
-- Esta função SECURITY DEFINER faz isso com segurança: só o profissional
-- atualmente atribuído consegue se remover do caso.
-- Rodar em: Supabase › SQL Editor › New Query › Run
-- ============================================================

CREATE OR REPLACE FUNCTION public.decline_property(_property_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.properties
     SET assigned_professional_id = NULL,
         updated_at = now()
   WHERE id = _property_id
     AND assigned_professional_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.decline_property(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.decline_property(uuid) TO authenticated;
