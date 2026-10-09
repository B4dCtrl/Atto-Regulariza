-- ================================================================
-- AVISO DE CADASTRO NOVO — 2026-10-09
-- ----------------------------------------------------------------
-- Quando um cliente termina o cadastro (o imóvel dele nasce), a equipe é
-- avisada na hora: no sino do admin e no WhatsApp.
--
-- O gatilho dispara quando o PRÓPRIO cliente cria o imóvel — wizard, entrada
-- pelo Google ou o primeiro acesso depois de confirmar o e-mail. Imóvel
-- criado pelo admin não avisa: quem criou já sabe.
--
-- O WhatsApp sai pelo site (/api/aviso-cadastro), chamado aqui pelo pg_net.
-- O segredo que autentica a chamada fica no Vault, nunca neste arquivo.
-- ANTES de rodar, crie o segredo (uma vez só), com o mesmo valor da variável
-- AVISO_CADASTRO_SEGREDO na Vercel:
--
--   SELECT vault.create_secret('<o segredo>', 'aviso_cadastro_segredo');
--
-- Sem o segredo, o sino continua funcionando; só o WhatsApp não sai.
--
-- Idempotente — seguro rodar mais de uma vez.
-- Rodar em: Supabase › SQL Editor › New Query › Run (selecione tudo antes)
-- ================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.avisar_cadastro_novo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_segredo text;
BEGIN
  -- Só quando o próprio cliente cria o imóvel.
  IF NEW.client_id IS NULL OR NEW.client_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  -- Aviso nunca derruba o cadastro: qualquer falha aqui é engolida.
  BEGIN
    INSERT INTO public.notifications (user_id, property_id, tipo, titulo, corpo)
    SELECT ur.user_id, NEW.id, 'lead',
           'Novo cadastro no site' ||
             CASE WHEN coalesce(NEW.city, '') <> ''
                  THEN ' — ' || NEW.city || coalesce('/' || nullif(NEW.state, ''), '')
                  ELSE '' END,
           left(concat_ws(' · ',
             nullif(NEW.client_name, ''),
             nullif(NEW.client_email, ''),
             nullif(NEW.objetivo, '')
           ), 500)
    FROM public.user_roles ur
    WHERE ur.role = 'admin';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'aviso de cadastro (sino) falhou: %', SQLERRM;
  END;

  BEGIN
    SELECT decrypted_secret INTO v_segredo
    FROM vault.decrypted_secrets
    WHERE name = 'aviso_cadastro_segredo'
    LIMIT 1;

    IF v_segredo IS NOT NULL THEN
      PERFORM net.http_post(
        url     := 'https://www.atoregulariza.com.br/api/aviso-cadastro',
        body    := jsonb_build_object('id', NEW.id),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-aviso-segredo', v_segredo
        ),
        timeout_milliseconds := 10000
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'aviso de cadastro (WhatsApp) falhou: %', SQLERRM;
  END;

  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.avisar_cadastro_novo() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_avisar_cadastro_novo ON public.properties;
CREATE TRIGGER trg_avisar_cadastro_novo
  AFTER INSERT ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.avisar_cadastro_novo();

-- Conferência: espera gatilho = 1, pg_net = 1, segredo = 1.
SELECT
  (SELECT count(*) FROM pg_trigger WHERE tgname = 'trg_avisar_cadastro_novo') AS gatilho,
  (SELECT count(*) FROM pg_extension WHERE extname = 'pg_net') AS pg_net,
  (SELECT count(*) FROM vault.secrets WHERE name = 'aviso_cadastro_segredo') AS segredo;
