-- ================================================================
-- FOTO DE PERFIL — 2026-09-10
-- ----------------------------------------------------------------
-- O botão de câmera existia nos dois perfis (cliente e profissional) desde o
-- começo, bonito e sem nenhuma ação: a pessoa clicava e não acontecia nada.
-- Isto cria o que faltava por baixo — onde guardar e quem pode escrever.
--
-- Idempotente — seguro rodar mais de uma vez.
-- Rodar em: Supabase › SQL Editor › New Query › Run (selecione tudo antes)
-- ================================================================

-- 1) Onde a URL fica.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

COMMENT ON COLUMN public.profiles.avatar_url IS
  'URL pública da foto de perfil no bucket avatares. Nula = mostra as iniciais.';

-- 2) O bucket.
--
-- Leitura pública, escrita restrita. É o mesmo desenho que qualquer produto
-- usa para foto de perfil, e a razão é prática: a foto do profissional
-- aparece para o cliente e vice-versa, então uma leitura autenticada exigiria
-- assinar URL a cada exibição — mais peça para manter e mais um jeito de
-- quebrar. O que protegemos de verdade é a ESCRITA, logo abaixo.
--
-- O caminho do arquivo é sempre `<user_id>/<arquivo>`, e o id é um UUID: não
-- dá para adivinhar a foto de alguém sem já saber o id dessa pessoa.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatares',
  'avatares',
  true,
  2097152,                                   -- 2 MB: foto de perfil não precisa de mais
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3) Quem pode escrever.
--
-- Cada pessoa só mexe na PRÓPRIA pasta. Sem esta amarra, qualquer usuário
-- autenticado trocaria a foto de qualquer outro — inclusive a de um admin,
-- que aparece no painel como quem assina as mensagens.
DROP POLICY IF EXISTS avatares_leitura ON storage.objects;
CREATE POLICY avatares_leitura ON storage.objects
  FOR SELECT USING (bucket_id = 'avatares');

DROP POLICY IF EXISTS avatares_envio ON storage.objects;
CREATE POLICY avatares_envio ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatares'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS avatares_troca ON storage.objects;
CREATE POLICY avatares_troca ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatares'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS avatares_remocao ON storage.objects;
CREATE POLICY avatares_remocao ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatares'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
