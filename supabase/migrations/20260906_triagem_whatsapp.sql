-- ================================================================
-- TRIAGEM PELO WHATSAPP — 2026-09-06
-- ----------------------------------------------------------------
-- Guarda a conversa do bot (para saber em que pergunta cada pessoa está) e
-- entrega o resultado classificado na tela de leads que já existe.
--
-- POR QUE A CONVERSA PRECISA DE TABELA
--   A função da Vercel é serverless: a instância que responde a segunda
--   mensagem quase nunca é a mesma da primeira. Guardar o passo em memória
--   faria o bot recomeçar do zero a cada resposta.
--
-- SEGURANÇA
--   Ninguém além do servidor escreve aqui. O webhook usa service_role, que
--   ignora RLS; as políticas abaixo existem para o caso de alguém alcançar a
--   tabela com a chave pública — e aí só admin lê, e ninguém escreve.
--
-- Idempotente — seguro rodar mais de uma vez.
-- Rodar em: Supabase › SQL Editor › New Query › Run (selecione tudo antes)
-- ================================================================

-- ---------------------------------------------------------------
-- 1) Lead sem e-mail passa a ser possível
--
-- Quem chega pelo WhatsApp dá o telefone, não o e-mail. Até hoje a coluna era
-- obrigatória porque todo lead vinha de formulário. Continua obrigatório ter
-- ALGUM contato — só não precisa ser e-mail.
-- ---------------------------------------------------------------
ALTER TABLE public.leads ALTER COLUMN email DROP NOT NULL;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_tem_contato_ck;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_tem_contato_ck
  CHECK (email IS NOT NULL OR phone IS NOT NULL);


-- ---------------------------------------------------------------
-- 2) Onde a triagem grava o que descobriu
--
-- Colunas próprias em vez de despejar tudo em 'notes': cor e cidade viram
-- filtro na tela do admin, e texto livre não se filtra.
-- ---------------------------------------------------------------
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS triagem_cor text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS triagem_produto text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS triagem_motivo text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS triagem_respostas jsonb;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_triagem_cor_ck;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_triagem_cor_ck
  CHECK (triagem_cor IS NULL OR triagem_cor IN ('verde','amarelo','vermelho'));

-- A tela do admin abre filtrando por cor; sem índice isso varre a tabela.
CREATE INDEX IF NOT EXISTS leads_triagem_cor_idx
  ON public.leads (triagem_cor) WHERE triagem_cor IS NOT NULL;


-- ---------------------------------------------------------------
-- 3) A conversa em andamento
--
-- Uma linha por telefone. O estado inteiro cabe num jsonb porque quem entende
-- do formato é o código da conversa — o banco só precisa devolver igual ao
-- que guardou.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_conversas (
  telefone      text PRIMARY KEY,
  estado        jsonb NOT NULL,
  -- Já virou lead? Evita gravar duas vezes se a Meta reenviar o webhook.
  lead_id       uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  -- Pediu atendente, ou terminou a triagem: o bot não fala mais.
  encerrada     boolean NOT NULL DEFAULT false,
  criada_em     timestamptz NOT NULL DEFAULT now(),
  atualizada_em timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.whatsapp_conversas IS
  'Estado da triagem por telefone. Escrita só pelo webhook, via service_role.';

-- Conversa parada há muito tempo é conversa abandonada. O índice serve para a
-- limpeza periódica encontrá-las sem varrer tudo.
CREATE INDEX IF NOT EXISTS whatsapp_conversas_atualizada_idx
  ON public.whatsapp_conversas (atualizada_em);


-- ---------------------------------------------------------------
-- 4) Trava de repetição
--
-- A Meta reenvia o webhook quando não recebe 200 rápido. Sem isto, uma
-- resposta lenta faria o bot processar a mesma mensagem duas vezes e pular
-- uma pergunta.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_mensagens_vistas (
  mensagem_id text PRIMARY KEY,
  vista_em    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_mensagens_vistas_idx
  ON public.whatsapp_mensagens_vistas (vista_em);


-- ---------------------------------------------------------------
-- 5) RLS
--
-- Fechado por padrão. O webhook entra por service_role e não passa por aqui.
-- ---------------------------------------------------------------
ALTER TABLE public.whatsapp_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_mensagens_vistas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_conversas_admin_select ON public.whatsapp_conversas;
CREATE POLICY whatsapp_conversas_admin_select ON public.whatsapp_conversas
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Nenhuma política de INSERT/UPDATE/DELETE: com RLS ligada e sem política,
-- ninguém que não seja service_role escreve. É o comportamento desejado.

REVOKE ALL ON public.whatsapp_conversas FROM anon;
REVOKE ALL ON public.whatsapp_mensagens_vistas FROM anon, authenticated;


-- ---------------------------------------------------------------
-- 6) Faxina
--
-- Conversa abandonada há mais de 7 dias não serve para nada: quem voltar
-- depois disso começa de novo, que é o certo. E o registro de mensagens
-- vistas só precisa cobrir a janela de reenvio da Meta.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.limpar_triagem_antiga()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.whatsapp_conversas
   WHERE atualizada_em < now() - interval '7 days';
  DELETE FROM public.whatsapp_mensagens_vistas
   WHERE vista_em < now() - interval '2 days';
$$;

REVOKE ALL ON FUNCTION public.limpar_triagem_antiga() FROM PUBLIC, anon, authenticated;
