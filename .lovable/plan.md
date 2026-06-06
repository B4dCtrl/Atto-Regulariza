
## Resumo

1. Remove o `VideoScroll` da home e apaga `public/regulariza.mp4`.
2. Cria login admin real (Lovable Cloud), com papel `admin` em tabela separada.
3. Cria back office `/admin` com sidebar, kanban visual (mock, arrastável), upload e chatbot IA (Lovable AI / Gemini).
4. Cria hub institucional `/institucional` (hero próprio para imobiliárias, construtoras e órgãos).
5. Refatora `/precos` em duas páginas: `/precos` (PF) e `/precos/institucional` (consulte).
6. Atualiza nav e CTAs.

---

## 1. Vídeo

- Remove `<VideoScroll />` de `src/routes/index.tsx`.
- Apaga `src/components/landing/VideoScroll.tsx` e `public/regulariza.mp4`.

## 2. Autenticação admin (Lovable Cloud)

**Credenciais combinadas:** email `admin@regulariza.com.br`, senha `admin123` (a senha "admin" tem só 5 caracteres e o Supabase exige mínimo 6 — uso `admin123` e você troca depois no painel se quiser).

Migração SQL:
- Enum `public.app_role` (`admin`, `cliente`).
- Tabela `public.user_roles` (id, user_id → auth.users, role, unique(user_id, role)) com RLS + GRANTs.
- Função `public.has_role(_user_id, _role)` security definer.
- Insere usuário admin via `auth.admin` no migration (usando `gen_random_uuid()` + `auth.users` + `auth.identities`) e cria a role `admin` para ele.
- Auto-confirma email do admin (sem precisar de verificação).

Auth config:
- `configure_auth`: signup habilitado, auto-confirm desligado (default), HIBP ligado.
- Sem Google por enquanto (admin é interno).

Frontend:
- `src/routes/entrar.tsx`: liga ao `supabase.auth.signInWithPassword`. Após login, se `has_role(user, 'admin')` → vai pra `/admin`. Senão → `/dashboard`.
- Layout `src/routes/_admin.tsx` (pathless): `beforeLoad` checa sessão + role admin via server fn; senão `redirect({to: "/entrar"})`.
- `src/integrations/supabase/auth-attacher.ts` já existe; confirmo `attachSupabaseAuth` em `src/start.ts`.

## 3. Back office `/admin`

Estrutura:
```
src/routes/_admin.tsx                  → guard + shell com sidebar
src/routes/_admin/index.tsx            → /admin (kanban + chat + upload)
src/routes/_admin/processos.tsx        → lista
src/routes/_admin/clientes.tsx         → lista mock
src/routes/_admin/documentos.tsx       → upload central
src/components/admin/AdminSidebar.tsx
src/components/admin/Kanban.tsx        → 4 colunas: Entrada · Análise · Em prefeitura · Entregue. Cards arrastáveis (HTML5 DnD nativo, mock state).
src/components/admin/UploadZone.tsx    → drag-drop visual (mock).
src/components/admin/ChatbotPanel.tsx  → chat IA real via edge function /functions/v1/admin-chat usando Lovable AI (google/gemini-3-flash-preview), streaming.
```

Edge function `supabase/functions/admin-chat/index.ts`:
- POST `{messages}` → stream do gateway `https://ai.gateway.lovable.dev/v1/chat/completions`.
- System prompt: "Você é o assistente do back office Regulariza. Tira dúvidas sobre processos de regularização imobiliária no Brasil (matrícula, habite-se, usucapião, ITBI, inventário). Tom direto, sem juridiquês."
- Trata 429/402 e devolve ao client.
- `config.toml`: `verify_jwt = false` (chamada feita pelo admin já logado, sem necessidade de bearer no edge).

UI (visual conforme imagem anexada — cards arredondados, badge ativa preta com bullet laranja, neutros + accent laranja):
- Sidebar fixa esquerda com nav (Visão geral, Processos, Clientes, Documentos, Mensagens, Configurações).
- Topbar: nome do admin + sair.
- Coluna principal: kanban (3/4 da largura) + painel direito com upload + chatbot.
- Chatbot abaixo do kanban em mobile.

## 4. Hub institucional `/institucional`

`src/routes/institucional.tsx`:
- Hero dedicado: "Regularização em escala para imobiliárias, construtoras e órgãos públicos."
- Sub-blocos: Imobiliárias / Construtoras / Institucional (cards).
- Benefícios: gestão de portfolio, SLA, dashboard multi-imóvel, integração via API, conta master + sub-usuários, NF mensal.
- Casos de uso + logos placeholder.
- CTA: "Falar com consultor" → WhatsApp `(67) 99851-3179`.
- Link cruzado para `/precos/institucional`.

Nav (`Nav.tsx`): adiciona "Para quem" com dropdown (Pessoa Física → `/`, Institucional → `/institucional`).

## 5. Páginas de preço separadas

`/precos` (PF) — refator da atual:
- Hero: "Preços por produto, sem mensalidade."
- 3 cards (por produto):
  - **Regularização de matrícula** — a partir de R$ 3.999,99
  - **Habite-se / Averbação** — a partir de R$ 3.999,99
  - **Casos complexos (usucapião, inventário, multipropriedade)** — sob consulta
- Cada card: CTA "Avaliação gratuita" → WhatsApp.
- FAQ específico PF.

`/precos/institucional` (nova):
- Hero: "Planos sob medida para volume."
- 3 cards:
  - **Imobiliária** — sob consulta · por imóvel ou mensal
  - **Construtora** — sob consulta · por empreendimento
  - **Órgão público / institucional** — sob consulta · contrato anual
- CTA único: "Falar com consultor" → WhatsApp com mensagem pré-preenchida "Olá, sou de uma imobiliária/construtora e quero avaliar parceria".
- Tabela comparativa de recursos institucionais (dashboard multi, API, SLA, gerente dedicado, NF mensal).

## 6. Detalhes técnicos

- Rotas novas precisam ser criadas como arquivos; `routeTree.gen.ts` é regenerado automaticamente.
- Kanban: HTML5 DnD nativo (sem libs extras), state local `useState`.
- Chatbot: parser SSE conforme `connecting-to-ai-models` (line-by-line, [DONE], 429/402).
- Tokens visuais reaproveitados de `src/styles.css` (foreground, accent, surface, ink-soft).
- Não toco em `src/integrations/supabase/*` (gerados).

## Ordem de execução

1. Migração SQL (cria role + admin user). ← primeiro, pra você aprovar.
2. Remove vídeo.
3. Cria edge function `admin-chat` + config.toml.
4. Cria rotas e componentes do back office.
5. Cria `/institucional`, refatora `/precos`, cria `/precos/institucional`.
6. Atualiza `Nav.tsx` e `entrar.tsx` (redirect por role).
