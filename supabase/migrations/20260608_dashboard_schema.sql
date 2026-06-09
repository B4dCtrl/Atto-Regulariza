-- ============================================================
-- Dashboard Schema — Ato Regulariza
-- Execute no Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- 1. Properties table
CREATE TABLE IF NOT EXISTS public.properties (
  id                         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                  uuid         REFERENCES auth.users(id),
  name                       text         NOT NULL DEFAULT 'Meu Imóvel',
  address                    text,
  city                       text,
  state                      text,
  progress                   int          NOT NULL DEFAULT 10 CHECK (progress >= 0 AND progress <= 100),
  current_stage              int          NOT NULL DEFAULT 1  CHECK (current_stage >= 1 AND current_stage <= 5),
  status                     text         NOT NULL DEFAULT 'entrada',
  next_action                text,
  next_action_deadline       date,
  assigned_professional_id   uuid         REFERENCES auth.users(id),
  created_at                 timestamptz  NOT NULL DEFAULT now(),
  updated_at                 timestamptz  NOT NULL DEFAULT now()
);

-- 2. Process stages
CREATE TABLE IF NOT EXISTS public.process_stages (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   uuid         NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  stage_number  int          NOT NULL CHECK (stage_number >= 1 AND stage_number <= 5),
  label         text         NOT NULL,
  state         text         NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'active', 'done')),
  completed_at  timestamptz,
  updated_by    uuid         REFERENCES auth.users(id),
  notes         text,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (property_id, stage_number)
);

-- 3. Documents
CREATE TABLE IF NOT EXISTS public.documents (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid         NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name        text         NOT NULL,
  size_text   text         DEFAULT '—',
  status      text         NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Enviado', 'Em análise', 'Aprovado')),
  uploaded_by uuid         REFERENCES auth.users(id),
  file_path   text,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);

-- 4. Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid         NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  sender_id   uuid         REFERENCES auth.users(id),
  sender_name text         NOT NULL DEFAULT 'Equipe',
  content     text         NOT NULL,
  is_client   boolean      NOT NULL DEFAULT false,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

-- 5. Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id              uuid         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text,
  initials        text,
  role            text         NOT NULL DEFAULT 'cliente',
  specialization  text,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS — Permissivo para fase dev (LOGIN_PAUSED=true)
-- Em produção: substituir por políticas baseadas em auth.uid()
-- ============================================================

ALTER TABLE public.properties       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_stages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;

-- Acesso total anônimo para dev
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'properties' AND policyname = 'dev_all_properties') THEN
    CREATE POLICY "dev_all_properties" ON public.properties FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'process_stages' AND policyname = 'dev_all_stages') THEN
    CREATE POLICY "dev_all_stages" ON public.process_stages FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'documents' AND policyname = 'dev_all_documents') THEN
    CREATE POLICY "dev_all_documents" ON public.documents FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'dev_all_messages') THEN
    CREATE POLICY "dev_all_messages" ON public.messages FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'dev_all_profiles') THEN
    CREATE POLICY "dev_all_profiles" ON public.profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- Realtime — habilitar replicação completa
-- ============================================================

ALTER TABLE public.properties       REPLICA IDENTITY FULL;
ALTER TABLE public.process_stages   REPLICA IDENTITY FULL;
ALTER TABLE public.documents        REPLICA IDENTITY FULL;
ALTER TABLE public.messages         REPLICA IDENTITY FULL;

-- Adicionar à publicação Realtime (necessário para Supabase Realtime funcionar)
ALTER PUBLICATION supabase_realtime ADD TABLE public.properties;
ALTER PUBLICATION supabase_realtime ADD TABLE public.process_stages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ============================================================
-- Dados de Demonstração
-- UUID fixo para referência no frontend: DEMO_PROPERTY_ID
-- ============================================================

-- Propriedade principal (painel do cliente demo)
INSERT INTO public.properties (
  id, name, address, city, state,
  progress, current_stage, status,
  next_action, next_action_deadline
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Apto 142 — Vila Madalena',
  'Rua Harmonia, 142',
  'São Paulo', 'SP',
  62, 4, 'prefeitura',
  'Enviar Habite-se', '2026-06-12'
) ON CONFLICT (id) DO NOTHING;

-- Etapas da propriedade demo
INSERT INTO public.process_stages (property_id, stage_number, label, state) VALUES
  ('11111111-1111-1111-1111-111111111111', 1, 'Cadastro',     'done'),
  ('11111111-1111-1111-1111-111111111111', 2, 'Análise',      'done'),
  ('11111111-1111-1111-1111-111111111111', 3, 'Profissional', 'done'),
  ('11111111-1111-1111-1111-111111111111', 4, 'Tramitação',   'active'),
  ('11111111-1111-1111-1111-111111111111', 5, 'Entrega',      'pending')
ON CONFLICT (property_id, stage_number) DO NOTHING;

-- Documentos demo
INSERT INTO public.documents (property_id, name, size_text, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'RG do proprietário.pdf',   '1.2 MB', 'Aprovado'),
  ('11111111-1111-1111-1111-111111111111', 'Matrícula atualizada.pdf', '820 KB', 'Em análise'),
  ('11111111-1111-1111-1111-111111111111', 'Habite-se',                '—',      'Pendente'),
  ('11111111-1111-1111-1111-111111111111', 'Certidão negativa.pdf',    '640 KB', 'Enviado')
ON CONFLICT DO NOTHING;

-- Mensagens demo
INSERT INTO public.messages (property_id, sender_name, content, is_client) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Carla Rocha',      'Protocolei na prefeitura. Devo ter retorno até sexta.', false),
  ('11111111-1111-1111-1111-111111111111', 'Marina Silveira',  'Perfeito, obrigada!', true)
ON CONFLICT DO NOTHING;

-- Demais propriedades para o Kanban do admin
INSERT INTO public.properties (id, name, address, city, state, progress, current_stage, status) VALUES
  ('22222222-2222-2222-2222-222222222222', 'Casa Térrea',          'Rua das Flores, 88',            'São Paulo',    'SP', 10, 1, 'entrada'),
  ('33333333-3333-3333-3333-333333333333', 'Cobertura 21',         'Av. Faria Lima, 21',            'São Paulo',    'SP', 30, 2, 'analise'),
  ('44444444-4444-4444-4444-444444444444', 'Lote 88',              'Rua do Campo, 88',              'Campo Grande', 'MS', 30, 2, 'analise'),
  ('55555555-5555-5555-5555-555555555555', 'Sala comercial 305',   'Al. Santos, 305',               'São Paulo',    'SP', 55, 3, 'profissional'),
  ('66666666-6666-6666-6666-666666666666', 'Apto 808',             'Rua Voluntários da Pátria, 808','Rio de Janeiro','RJ', 75, 4, 'prefeitura'),
  ('77777777-7777-7777-7777-777777777777', 'Galpão B',             'Rod. Anhanguera, Km 12',        'Guarulhos',    'SP',100, 5, 'entregue'),
  ('88888888-8888-8888-8888-888888888888', 'Apto 302 Nova Lima',   'Rua Grão Mogol, 142',           'Belo Horizonte','MG',10, 1, 'entrada'),
  ('99999999-9999-9999-9999-999999999999', 'Terreno Sul',          'Rod. BR-040, Km 45',            'Brasília',     'DF', 55, 3, 'profissional')
ON CONFLICT (id) DO NOTHING;

-- Etapas para demais propriedades
INSERT INTO public.process_stages (property_id, stage_number, label, state)
SELECT p.id, s.stage_number, s.label,
  CASE
    WHEN s.stage_number < p.current_stage THEN 'done'
    WHEN s.stage_number = p.current_stage THEN 'active'
    ELSE 'pending'
  END
FROM public.properties p
CROSS JOIN (VALUES (1,'Cadastro'),(2,'Análise'),(3,'Profissional'),(4,'Tramitação'),(5,'Entrega')) s(stage_number, label)
WHERE p.id != '11111111-1111-1111-1111-111111111111'
ON CONFLICT (property_id, stage_number) DO NOTHING;
