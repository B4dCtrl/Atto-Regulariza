-- ================================================================
-- PRESENÇA NO CHAT — 2026-09-11
-- ----------------------------------------------------------------
-- A assistente respondia sempre que ninguém da equipe tivesse falado nos
-- últimos 15 minutos. Na prática ela atropelava o profissional que estava ali,
-- com a tela aberta, formulando a resposta — e o cliente ficava com duas vozes
-- ao mesmo tempo, gastando cota de IA numa pergunta que o humano ia responder
-- melhor.
--
-- Passa a valer quem está online AGORA. Quem está com o painel aberto tem
-- tempo de responder; quem não está não segura o cliente esperando.
--
-- Idempotente — seguro rodar mais de uma vez.
-- Rodar em: Supabase › SQL Editor › New Query › Run (selecione tudo antes)
-- ================================================================

-- 1) O batimento.
--
-- `ultimo_acesso_em` já existia, mas só era escrito no login — servia para
-- "quando entrou pela última vez", não para "está aqui agora". O painel passa
-- a bater neste ponto a cada 30 s enquanto estiver aberto.
CREATE OR REPLACE FUNCTION public.registrar_presenca()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles SET ultimo_acesso_em = now() WHERE id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.registrar_presenca() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_presenca() TO authenticated;

COMMENT ON FUNCTION public.registrar_presenca() IS
  'Batimento de presença: marca que o usuário está com o painel aberto agora.';

-- 2) O profissional do processo está online?
--
-- Responde para o CLIENTE, que não pode ler `profiles` de outra pessoa: a
-- função é SECURITY DEFINER e devolve só um booleano — nunca o horário exato
-- nem qualquer outro dado de quem atende.
--
-- Um minuto de tolerância porque o batimento é de 30 s: um atraso de rede não
-- pode fazer quem está online parecer ausente.
CREATE OR REPLACE FUNCTION public.profissional_online(_property_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prof uuid;
  v_visto timestamptz;
BEGIN
  -- Só quem tem acesso ao processo pode perguntar sobre ele.
  IF NOT public.can_access_property(_property_id) THEN
    RETURN false;
  END IF;

  SELECT assigned_professional_id INTO v_prof
  FROM public.properties WHERE id = _property_id;

  IF v_prof IS NULL THEN RETURN false; END IF;

  SELECT ultimo_acesso_em INTO v_visto FROM public.profiles WHERE id = v_prof;

  RETURN v_visto IS NOT NULL AND v_visto > now() - interval '1 minute';
END $$;

REVOKE EXECUTE ON FUNCTION public.profissional_online(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profissional_online(uuid) TO authenticated;

-- 3) Cutucar o profissional que está online e ainda não respondeu.
--
-- É o "cobra o profissional" do fluxo: aos 3 minutos ele leva um aviso no
-- sino. Sem isto, estar online só serviria para atrasar a resposta do cliente.
--
-- Não repete: se já existe aviso do mesmo processo nos últimos 10 minutos,
-- sai calado. Um cliente ansioso que escreve cinco vezes não vira cinco sinos.
CREATE OR REPLACE FUNCTION public.cobrar_resposta(_property_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prof uuid;
  v_endereco text;
BEGIN
  IF NOT public.can_access_property(_property_id) THEN
    RETURN;
  END IF;

  SELECT assigned_professional_id, address
    INTO v_prof, v_endereco
  FROM public.properties WHERE id = _property_id;

  IF v_prof IS NULL THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = v_prof
      AND property_id = _property_id
      AND tipo = 'mensagem'
      AND created_at > now() - interval '10 minutes'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, property_id, tipo, titulo, corpo)
  VALUES (
    v_prof,
    _property_id,
    'mensagem',
    'Cliente esperando resposta',
    coalesce(v_endereco, 'Um processo seu') || ' — o cliente escreveu e ainda não teve retorno.'
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.cobrar_resposta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cobrar_resposta(uuid) TO authenticated;
