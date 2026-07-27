-- ============================================================
-- Área de cursos (curso.atoregulariza.com.br) — schema inicial
-- Idempotente — seguro rodar de uma vez.
-- ============================================================

create table if not exists public.courses (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  title       text not null,
  description text,
  cover_url   text,
  published   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.course_modules (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references public.courses(id) on delete cascade,
  title      text not null,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.course_lessons (
  id          uuid primary key default gen_random_uuid(),
  module_id   uuid not null references public.course_modules(id) on delete cascade,
  title       text not null,
  description text,
  youtube_id  text,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);

-- Quem tem acesso liberado a qual curso (manual hoje; webhook Hotmart depois)
create table if not exists public.course_access (
  user_id    uuid not null references auth.users(id) on delete cascade,
  course_id  uuid not null references public.courses(id) on delete cascade,
  source     text not null default 'manual', -- 'manual' | 'hotmart'
  granted_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

-- Aulas assistidas/concluídas por aluno
create table if not exists public.lesson_progress (
  user_id      uuid not null references auth.users(id) on delete cascade,
  lesson_id    uuid not null references public.course_lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

alter table public.courses         enable row level security;
alter table public.course_modules  enable row level security;
alter table public.course_lessons  enable row level security;
alter table public.course_access   enable row level security;
alter table public.lesson_progress enable row level security;

-- courses/modules/lessons: só quem tem acesso liberado (ou admin) enxerga
drop policy if exists "courses_select" on public.courses;
create policy "courses_select" on public.courses for select to authenticated
  using ( public.is_admin() or exists (
    select 1 from public.course_access ca where ca.course_id = id and ca.user_id = auth.uid()
  ) );

drop policy if exists "modules_select" on public.course_modules;
create policy "modules_select" on public.course_modules for select to authenticated
  using ( public.is_admin() or exists (
    select 1 from public.course_access ca where ca.course_id = course_id and ca.user_id = auth.uid()
  ) );

drop policy if exists "lessons_select" on public.course_lessons;
create policy "lessons_select" on public.course_lessons for select to authenticated
  using ( public.is_admin() or exists (
    select 1 from public.course_modules m
    join public.course_access ca on ca.course_id = m.course_id
    where m.id = module_id and ca.user_id = auth.uid()
  ) );

-- course_access: usuário vê a própria liberação; admin vê/gerencia tudo
drop policy if exists "access_select_own" on public.course_access;
create policy "access_select_own" on public.course_access for select to authenticated
  using ( user_id = auth.uid() or public.is_admin() );

drop policy if exists "access_admin_manage" on public.course_access;
create policy "access_admin_manage" on public.course_access for all to authenticated
  using ( public.is_admin() ) with check ( public.is_admin() );

-- lesson_progress: usuário só mexe no próprio progresso
drop policy if exists "progress_own" on public.lesson_progress;
create policy "progress_own" on public.lesson_progress for all to authenticated
  using ( user_id = auth.uid() ) with check ( user_id = auth.uid() );

-- admin gerencia catálogo (courses/modules/lessons)
drop policy if exists "courses_admin_write" on public.courses;
create policy "courses_admin_write" on public.courses for all to authenticated
  using ( public.is_admin() ) with check ( public.is_admin() );

drop policy if exists "modules_admin_write" on public.course_modules;
create policy "modules_admin_write" on public.course_modules for all to authenticated
  using ( public.is_admin() ) with check ( public.is_admin() );

drop policy if exists "lessons_admin_write" on public.course_lessons;
create policy "lessons_admin_write" on public.course_lessons for all to authenticated
  using ( public.is_admin() ) with check ( public.is_admin() );

-- ============================================================
-- Seed: primeiro curso real — Regularização Fundiária de Imóveis
-- Públicos (conteúdo enviado pelo usuário em 2026-07-24)
-- ============================================================
insert into public.courses (slug, title, description, published)
values (
  'regularizacao-fundiaria-publica',
  'Regularização Fundiária de Imóveis Públicos',
  'Do capital morto ao capital vivo: como diagnosticar, saneiar e regularizar o patrimônio imobiliário público — dos fundamentos jurídicos ao registro definitivo.',
  true
)
on conflict (slug) do nothing;

do $$
declare
  v_course_id uuid;
  v_mod_id    uuid;
begin
  select id into v_course_id from public.courses where slug = 'regularizacao-fundiaria-publica';

  -- Módulo 1
  insert into public.course_modules (course_id, title, sort)
  values (v_course_id, '1. Contexto Estratégico e Riscos Institucionais', 1)
  returning id into v_mod_id;
  insert into public.course_lessons (module_id, title, description, sort) values
    (v_mod_id, 'Capital Morto vs. Capital Vivo',
     'Imóveis públicos abandonados ou sem regularização são "capital morto" — a regularização fundiária os transforma em "capital vivo", capaz de atrair investimentos e gerar benefícios econômicos e sociais.', 1),
    (v_mod_id, 'Requisito para Verbas Federais',
     'O Governo Federal exige a comprovação da regularidade do terreno para liberar recursos (via TransfereGov) destinados a obras públicas, protegendo o patrimônio público e garantindo segurança jurídica.', 2),
    (v_mod_id, 'Fiscalização e Penalidades',
     'O papel dos órgãos de controle (TCU e TCEs) e o risco da instauração de uma Tomada de Contas Especial — a necessidade de governança para evitar penalidades aos gestores públicos.', 3);

  -- Módulo 2
  insert into public.course_modules (course_id, title, sort)
  values (v_course_id, '2. Fundamentos Jurídicos e Registrais', 2)
  returning id into v_mod_id;
  insert into public.course_lessons (module_id, title, description, sort) values
    (v_mod_id, 'Transcrição vs. Matrícula',
     'A diferença entre a "transcrição" (sistema registral antigo e impreciso) e a "matrícula" (sistema moderno e individualizado) — muitos bens públicos antigos precisam ter a matrícula aberta para serem regularizados.', 1),
    (v_mod_id, 'Aplicação correta da REURB',
     'A Lei nº 13.465/2017 (REURB) regulariza núcleos urbanos informais consolidados, mas não se aplica a imóveis vazios ou já destinados a serviços públicos (como escolas e hospitais).', 2),
    (v_mod_id, 'Nota Técnica Jurídica (NTJ)',
     'Como o uso de notas técnicas padroniza o entendimento jurídico institucional, reduz retrabalhos e acelera a tramitação e aprovação interna dos processos.', 3);

  -- Módulo 3
  insert into public.course_modules (course_id, title, sort)
  values (v_course_id, '3. Diagnóstico e Classificação do Patrimônio', 3)
  returning id into v_mod_id;
  insert into public.course_lessons (module_id, title, description, sort) values
    (v_mod_id, 'Taxonomia D0–D7',
     'Classificação de imóveis de acordo com sua maturidade jurídica, desde bens sem nenhum registro (D0) até aqueles que possuem regularização jurídica mas carecem de um ato público formalizado (D7).', 1),
    (v_mod_id, 'Leitura de Sinais Documentais',
     'O que cada documento representa: diferenças e limitações práticas de escrituras, matrículas atualizadas, decretos de desapropriação e termos de cessão.', 2),
    (v_mod_id, 'Árvore de Decisão e Limites Técnicos',
     'O passo a passo de como classificar o imóvel e quando o gestor deve "se abster" e encaminhar casos de alta complexidade (conflitos, sobreposições) para análise especializada.', 3);

  -- Módulo 4
  insert into public.course_modules (course_id, title, sort)
  values (v_course_id, '4. A Execução do Processo (O Pipeline de Regularização)', 4)
  returning id into v_mod_id;
  insert into public.course_lessons (module_id, title, description, sort) values
    (v_mod_id, 'As 7 Etapas Fundamentais',
     'Triagem, diagnóstico, levantamento técnico, saneamento, protocolo, cumprimento de exigências cartorárias e o registro definitivo.', 1),
    (v_mod_id, 'Prevenção de Erros Comuns',
     'As falhas que travam os processos: confundir a escritura com o direito de propriedade (que exige registro), ignorar o histórico da cadeia dominial ou protocolar com documentos técnicos divergentes.', 2),
    (v_mod_id, 'Prazos Realistas (C1 a C4)',
     'Os prazos variam de acordo com a complexidade do imóvel — de 30 a 90 dias em casos simples (C1) a mais de 36 meses em casos com litígios (C4).', 3);

  -- Módulo 5
  insert into public.course_modules (course_id, title, sort)
  values (v_course_id, '5. Aplicação Tecnológica e Prática', 5)
  returning id into v_mod_id;
  insert into public.course_lessons (module_id, title, description, sort) values
    (v_mod_id, 'Uso de Tecnologia',
     'Plataformas de inteligência artificial aplicadas à triagem documental — quando confiar na automação e quando é necessária a revisão manual.', 1),
    (v_mod_id, 'Estudo de Caso e Projeto Final',
     'O aluno faz um diagnóstico preliminar e real de um imóvel de seu próprio órgão, transformando o exercício acadêmico em um dado prático que ajuda a resolver os problemas institucionais do próprio Estado.', 2);
end $$;
