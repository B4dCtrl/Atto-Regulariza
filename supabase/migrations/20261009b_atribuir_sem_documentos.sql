-- ================================================================
-- ATRIBUIR PROFISSIONAL SEM ESPERAR OS DOCUMENTOS — 2026-10-09
-- ----------------------------------------------------------------
-- Desfaz a trava de delegação de 20260824: atribuir um profissional não
-- exige mais RG/CPF e comprovante de endereço aprovados. Na prática a trava
-- parava o caso inteiro à espera do cliente, e quem decide se dá para
-- começar sem os documentos é o admin ou o profissional, não o banco.
--
-- No lugar da trava, um lembrete: ao atribuir, cada documento essencial que
-- o cliente ainda não enviou vira uma pendência com envio embutido. Ela
-- aparece em "O que falta de você", acende o sino do cliente (gatilho
-- notificar_pendencia) e pode ser resolvida pelo admin ou pelo profissional
-- quando decidirem deixar para depois.
--
-- Continua valendo: profissional não aprovado não recebe processo.
--
-- Idempotente — seguro rodar mais de uma vez.
-- Rodar em: Supabase › SQL Editor › New Query › Run (selecione tudo antes)
-- ================================================================

-- 1) A trava volta a checar só o profissional.
CREATE OR REPLACE FUNCTION public.enforce_assigned_professional()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assigned_professional_id IS NOT NULL
     AND NEW.assigned_professional_id IS DISTINCT FROM OLD.assigned_professional_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = NEW.assigned_professional_id
        AND role = 'profissional'
        AND approval_status = 'aprovado'
    ) THEN
      RAISE EXCEPTION 'Profissional não aprovado não pode receber processos';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- 2) Lembrete ao cliente do que falta enviar.
--
-- "Falta" = nenhum documento daquele tipo enviado (vivo), aprovado ou não.
-- Documento já enviado e em análise não vira cobrança: o cliente fez a parte
-- dele. Pendência aberta do mesmo tipo também não duplica.
CREATE OR REPLACE FUNCTION public.lembrar_documentos_ao_atribuir()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assigned_professional_id IS NULL
     OR NEW.assigned_professional_id IS NOT DISTINCT FROM OLD.assigned_professional_id THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.pendencies (property_id, stage_number, descricao, kind, criada_por)
  SELECT NEW.id, 1, e.descricao, e.kind, auth.uid()
  FROM (VALUES
    ('identidade',
     'Envie o RG e CPF do proprietário. O profissional já está com o seu caso e precisa dele para avançar.'),
    ('comprovante_endereco',
     'Envie um comprovante de endereço. O profissional já está com o seu caso e precisa dele para avançar.')
  ) AS e(kind, descricao)
  WHERE NOT EXISTS (
          SELECT 1 FROM public.documents d
          WHERE d.property_id = NEW.id AND d.kind = e.kind AND d.deleted_at IS NULL
        )
    AND NOT EXISTS (
          SELECT 1 FROM public.pendencies p
          WHERE p.property_id = NEW.id AND p.kind = e.kind AND p.status = 'aberta'
        );

  RETURN NULL;
END $$;

REVOKE EXECUTE ON FUNCTION public.lembrar_documentos_ao_atribuir() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_lembrar_documentos_ao_atribuir ON public.properties;
CREATE TRIGGER trg_lembrar_documentos_ao_atribuir
  AFTER INSERT OR UPDATE OF assigned_professional_id ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.lembrar_documentos_ao_atribuir();


-- ================================================================
-- VERIFICAÇÃO — todas as linhas devem sair 'OK'.
-- ================================================================
SELECT 'trava de documentos removida' AS verificacao,
       CASE WHEN (SELECT prosrc FROM pg_proc
                  WHERE oid = 'public.enforce_assigned_professional()'::regprocedure)
                 LIKE '%essenciais_aprovados%'
            THEN 'FALHA' ELSE 'OK' END AS resultado
UNION ALL
SELECT 'trava de profissional aprovado mantida',
       CASE WHEN (SELECT prosrc FROM pg_proc
                  WHERE oid = 'public.enforce_assigned_professional()'::regprocedure)
                 LIKE '%approval_status%'
            THEN 'OK' ELSE 'FALHA' END
UNION ALL
SELECT 'lembrete instalado',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_trigger
         WHERE tgrelid = 'public.properties'::regclass
           AND tgname = 'trg_lembrar_documentos_ao_atribuir'
       ) THEN 'OK' ELSE 'FALHA' END;
