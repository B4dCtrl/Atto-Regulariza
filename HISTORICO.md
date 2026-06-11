# Histórico do Projeto — Ato Regulariza

**Repositório:** `B4dCtrl/Atto-Regulariza`  
**Pasta local:** `C:\Users\Administrator\Desktop\App\Regularizan\landing`  
**Deploy:** [atoregulariza.com.br](https://atoregulariza.com.br) via Vercel  
**Stack:** React 19 + TanStack Router + Vite + TailwindCSS 4 + Supabase + Framer Motion

---

## O que foi construído

### Landing Page (site público)
- Hero com esfera de partículas 3D morphing (esfera → casa → documento → check)
- Nav animado com efeito merge/split glass — 3 pills separados (logo / links / CTAs)
- LogoBar marquee com efeito portal blur
- BlurHeadline com IntroCards fundidos
- Seção de captura de lead + consultoria B2B
- Topografia hero, glass nav, logos animadas
- Página `/profissionais` para captação de profissionais

### Identidade Visual / Branding
- Logo "Ato" com casa standalone + fonte Arsenica-Light
- Troca do logo-ato.png pelo novo logo com word scramble timing fix
- Remoção de blur excessivo em toda a landing
- Paleta e tipografia consolidadas em todas as páginas

### Painel do Profissional (`/painel-profissional`)
- Pipeline de 9 processos mock com urgência (alta / média / baixa)
- 5 etapas por processo com campos dinâmicos (checklist, select, textarea, date, number)
- Sistema de documentos: upload simulado, status (Enviado / Em análise / Aprovado)
- Chat interno profissional ↔ cliente
- Briefing expandido do imóvel (tipo, área, cidade, situação)
- **Sidebar retratil** estilo backoffice: ícone 64px colapsado, hover expande para 240px, logo no topo
- **4 seções:** Meus Processos · Estatísticas · Notificações · Configurações
- **Sistema de Pendências:** botão "+ Pendência" em cada etapa, modal de descrição, "Concluir Etapa" bloqueado enquanto há pendências abertas, resolução individual por pendência

### Painel do Cliente (`/painel-cliente`)
- Visão do processo pelo lado do cliente
- Página de perfil do cliente

### Back Office / Admin (`/dashboard`, `/backoffice`, `/gestao`)
- Sidebar retratil estilo admin com seções e hover-expand
- Módulo de Gestão: casos flutuantes, kanban de etapas
- Leads e captação de profissionais
- Undo de etapas
- Briefing + notificações no painel admin

### Componentes criados
- `UserProfileMenu.tsx` — menu popover no avatar (criado, pendente integração nas topbars)
- Componentes shadcn adicionados: popover, button, avatar, input, label, separator, textarea
- Páginas de perfil para cliente e profissional

### Infraestrutura / Deploy
- Fix 404 Vercel: `serverDir __server.func` + preset nitro vercel
- Modo pré-lançamento com página "em construção" + acesso dev por senha
- Acesso da equipe sem senha + barra de navegação staff
- Conexão Vercel → GitHub → deploy automático em push no `main`

---

## Pendentes (próximos passos)

| Item | Status |
|------|--------|
| Upload real de Procuração assinada (PDF nos processos) | Pendente |
| Revisão de etapas por tipo de processo (Unificação vs Averbação) | Pendente |
| Back Office "Vivo" — casos flutuando em tempo real | Pendente |
| Busca global + sininho de notificações | Pendente |
| Integrar `UserProfileMenu.tsx` nas topbars | Pendente |

---

## Todos os commits

| Hash | Data | Descrição |
|------|------|-----------|
| `9b684e7` | 10/06/2026 | feat: sidebar retratil + 4 secoes + sistema de pendencias no painel profissional |
| `c003ce1` | 10/06/2026 | chore: regenerar routeTree.gen.ts |
| `64c5b62` | 10/06/2026 | feat: adicionar imports para sidebar no painel profissional |
| `f51f551` | 10/06/2026 | feat: adicionar componentes shadcn + UserProfileMenu |
| `d60d30f` | 10/06/2026 | feat: páginas de perfil para cliente e profissional |
| `eb7cc08` | 10/06/2026 | brand: standalone house logo + Arsenica-Light font + nav sizing |
| `0677df5` | 10/06/2026 | brand: logo original size + Arsenica text 'ato' in accent color |
| `dc921b8` | 10/06/2026 | brand: increase logo size 3x across all pages |
| `406588f` | 10/06/2026 | brand: remove text label next to logo across all pages — logo only |
| `23af74f` | 10/06/2026 | brand: replace logo-ato.png com novo Ato logo + word scramble timing fix |
| `7867285` | 09/06/2026 | Logo 2 da ato |
| `e1ace04` | 09/06/2026 | feat: lead capture, B2B consultation, panel briefing + notifications |
| `9e7f623` | 09/06/2026 | feat: painel profissional completo + leads + docs padrão no backoffice |
| `f65c798` | 09/06/2026 | feat: rebranding completo para Ato Regulariza + fixes de UX |
| `4c8e1da` | 09/06/2026 | feat: GESTÃO — merge backoffice+gestão, módulos completos, undo de etapas |
| `51d23b7` | 09/06/2026 | brand: add Ato logo to nav + favicon; remove all blur do BlurHeadline |
| `1a30c79` | 09/06/2026 | hero: remove badge, fix headline line, aumento contraste, social proof |
| `123a98b` | 09/06/2026 | fix: ícones sem nuvem, sem rotação + mais contraste, morph ~1s |
| `f18196e` | 09/06/2026 | fix: ícones com halo de partículas + apenas esfera gira |
| `59750e9` | 09/06/2026 | feat: particle morphing — esfera → casa → documento → check |
| `5021b63` | 09/06/2026 | feat: hero com cores invertidas — fundo areia, partículas escuras |
| `e3861ce` | 09/06/2026 | fix: merged glass via AnimatePresence com delay — sem pill largo ao voltar |
| `9c23ba4` | 09/06/2026 | fix: wrapper do nav explicitamente transparente no estado split |
| `e310ef7` | 09/06/2026 | fix: nav merged mais visível na hero + scroll inicial correto |
| `2311a97` | 09/06/2026 | fix: nav glass visível — dois estilos conforme o fundo |
| `159fd09` | 09/06/2026 | feat: nav merge→split com animação estilo água |
| `e27e0be` | 09/06/2026 | feat: nav split islands — 3 pills separados (logo / links / CTAs) |
| `db183df` | 09/06/2026 | fix: nav blur 18.5→1.2 (quase 1, bem suave) |
| `57c35ef` | 09/06/2026 | feat: IntroCards fundidos dentro do container BlurHeadline |
| `b248bfe` | 09/06/2026 | feat: BlurHeadline após LogoBar + nav glass blur=18.5 brightness=1.16 |
| `aa330eb` | 09/06/2026 | feat: hero estilo Tailark — card escuro, esfera 3D, LogoBar marquee |
| `bfb6da3` | 09/06/2026 | feat: hero card cream arredondado + LogoBar efeito portal |
| `b5e9e9d` | 09/06/2026 | fix: remove bg-background da hero para vídeo e GLSLHills aparecerem |
| `1e78cda` | 09/06/2026 | feat: GLSLHills na hero, LogoBar marquee duplo, BlurHeadline blur 10→5 |
| `a1c80c7` | 08/06/2026 | Phase 3: Landing Hero + Onboarding System |
| `5c3044a` | 08/06/2026 | feat: logos reais, BlurHeadline, consent LGPD, ajustes hero |
| `4647d4c` | 08/06/2026 | fix: remove bg-background da Hero para GLSLHills aparecer |
| `01e7271` | 08/06/2026 | feat: visual overhaul — topografia hero, glass nav, logos animadas, /profissionais |
| `43b1334` | 08/06/2026 | Equipe entra sem senha + restaura página de login |
| `0bcb9e5` | 08/06/2026 | Acesso da equipe: botão com senha + barra de navegação staff |
| `75cec42` | 08/06/2026 | Fix 404 Vercel: serverDir __server.func casa com a rota /__server |
| `a82baf0` | 08/06/2026 | Fix deploy Vercel: nitro preset vercel + output .vercel/output |
| `a0977cb` | 08/06/2026 | Modo pré-lançamento: página em construção + acesso dev + login pausado |
| `22c619c` | 07/06/2026 | Hero simplificada: apenas título e texto |
| `2083b2b` | 06/06/2026 | Landing Regulariza: hero, liquid glass, back office e auth |
| `aed22cf` | 02/06/2026 | Adicionei os arquivos |
| `f81e5d8` | 31/05/2026 | Initial commit |

---

*Gerado em 10/06/2026*
