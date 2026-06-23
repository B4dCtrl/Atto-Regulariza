-- ============================================================
-- Permite o CLIENTE criar o próprio imóvel e etapas (sem service role).
-- Antes: properties_insert era só-admin → o cadastro do cliente dependia de
-- uma server function com service role (que pode não estar configurada).
-- Agora o cliente cria o próprio processo direto do navegador.
-- Idempotente — seguro rodar de uma vez.
-- ============================================================

-- Imóvel: o dono (client_id) pode inserir o seu; admin continua podendo tudo.
DROP POLICY IF EXISTS "properties_insert" ON public.properties;
CREATE POLICY "properties_insert" ON public.properties FOR INSERT TO authenticated
  WITH CHECK ( client_id = auth.uid() OR public.is_admin() );

-- Etapas: quem tem acesso ao imóvel (dono, profissional designado ou admin) pode inserir.
DROP POLICY IF EXISTS "stages_insert" ON public.process_stages;
CREATE POLICY "stages_insert" ON public.process_stages FOR INSERT TO authenticated
  WITH CHECK ( public.can_access_property(property_id) );
