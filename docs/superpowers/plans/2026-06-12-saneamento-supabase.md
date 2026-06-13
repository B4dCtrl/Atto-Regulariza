# Saneamento total + migração para Supabase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para implementar tarefa-a-tarefa. Steps usam checkbox (`- [ ]`).

**Goal:** Eliminar todo dado falso/localStorage do produto, ligando captação de leads, clientes, perfis, cadastro de profissional, financeiro e documentos-padrão ao Supabase — sem nenhum erro de banco.

**Architecture:** Toda mudança de schema/RLS vai num **único script SQL idempotente** (Fase 0), rodado uma vez. Depois, cada página troca `localStorage`/mocks por chamadas Supabase, seguindo os padrões já usados no projeto (`supabase.from(...)`, RLS por papel, realtime onde fizer sentido). Criação de conta de profissional pelo admin usa **server function** com service role (não dá pra criar conta de terceiro com a chave pública).

**Tech Stack:** React 19, TanStack Router/Start, Vite, TailwindCSS 4, Supabase (Postgres + RLS + Auth Admin via service role), Zod. Sem framework de testes — verificação por `npm run build` + smoke test no navegador.

**Princípio anti-erro Supabase:** todo SQL é idempotente (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS`); toda leitura nova é precedida da atualização de `src/integrations/supabase/types.ts`; nenhuma coluna/política é usada antes de existir no script da Fase 0.

---

## File Structure

- **Modify** `supabase/migrations/20260612_saneamento.sql` (criar) — único script de schema.
- **Modify** `src/integrations/supabase/types.ts` — tipos das tabelas novas/colunas novas.
- **Modify** `src/routes/precos.tsx` — captação de lead → Supabase + planos do Supabase.
- **Modify** `src/routes/precos/institucional.tsx` — captação de lead → Supabase.
- **Modify** `src/routes/admin/leads.tsx` — leads do Supabase.
- **Modify** `src/routes/admin/clientes.tsx` — clientes de `properties`.
- **Modify** `src/routes/perfil.tsx` — perfil do cliente em `profiles` + guarda.
- **Modify** `src/routes/perfil-profissional.tsx` — perfil do profissional em `profiles` + guarda.
- **Modify** `src/routes/cadastrar.tsx` — wizard cria também a linha em `profiles` do cliente.
- **Create** `src/lib/api/professionals.functions.ts` — server fn `createProfessional` (service role).
- **Modify** `src/routes/admin/cadastro-profissional.tsx` — lista/cria profissionais reais.
- **Modify** `src/routes/admin/financeiro.tsx` — planos em `pricing_plans`.
- **Modify** `src/routes/admin/documentos-padrao.tsx` — modelos em `document_templates`.
- **Modify** `src/routes/dashboard.tsx` + `src/routes/painel-profissional.tsx` — limpeza (P3).

---

## FASE 0 — Schema (rodar UMA vez no Supabase)

### Task 0: Script SQL idempotente

**Files:** Create `supabase/migrations/20260612_saneamento.sql`

- [ ] **0.1** Criar o arquivo com EXATAMENTE este conteúdo:

```sql
-- ============================================================
-- SANEAMENTO 2026-06-12 — idempotente, seguro para rodar 1x.
-- ============================================================

-- 1) LEADS — workflow do admin
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS status            text NOT NULL DEFAULT 'novo';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS professional_name text;

-- 2) PROFILES — campos editáveis (cliente e profissional)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email       text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone       text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cpf         text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city        text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state       text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio         text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS council     text;          -- CAU/CREA/OAB
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS registro    text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS specialties text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS regions     text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS accepting   boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_cases   integer NOT NULL DEFAULT 8;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active      boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS settings    jsonb NOT NULL DEFAULT '{}'::jsonb;  -- prefs de notificação

-- 3) PRICING_PLANS — financeiro + página pública /precos
CREATE TABLE IF NOT EXISTS public.pricing_plans (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  price      text,
  period     text,
  descr      text,
  features   text[] NOT NULL DEFAULT '{}',
  popular    boolean NOT NULL DEFAULT false,
  tag        text,
  note       text,
  visible    boolean NOT NULL DEFAULT true,
  sort       integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pricing_select_public" ON public.pricing_plans;
DROP POLICY IF EXISTS "pricing_write_admin"  ON public.pricing_plans;
CREATE POLICY "pricing_select_public" ON public.pricing_plans
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "pricing_write_admin" ON public.pricing_plans
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT SELECT ON public.pricing_plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_plans TO authenticated;

-- 4) DOCUMENT_TEMPLATES — documentos-padrão (interno)
CREATE TABLE IF NOT EXISTS public.document_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  category    text,
  description text,
  size_text   text,
  file_path   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "doctpl_select_auth" ON public.document_templates;
DROP POLICY IF EXISTS "doctpl_write_admin" ON public.document_templates;
CREATE POLICY "doctpl_select_auth" ON public.document_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "doctpl_write_admin" ON public.document_templates
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_templates TO authenticated;

-- 5) SEED dos planos públicos (idempotente)
INSERT INTO public.pricing_plans (id, name, price, period, descr, features, popular, tag, visible, sort) VALUES
  ('matricula','Regularização de matrícula','a partir de R$ 3.999,99','por imóvel',
   'Atualização de registro, pendências cartoriais e documentação básica.',
   ARRAY['Análise documental completa','Especialista designado','Acompanhamento no painel','Tramitação cartorial'],
   false, NULL, true, 1),
  ('habitese','Habite-se / Averbação','a partir de R$ 3.999,99','por imóvel',
   'Legalização junto à prefeitura e registro da construção ou alteração.',
   ARRAY['Prefeitura + cartório','Resolução de exigências','Timeline visual','Suporte prioritário'],
   true, 'Mais pedido', true, 2),
  ('complexos','Casos complexos','Sob consulta','usucapião, inventário, multipropriedade',
   'Situações que exigem estratégia jurídica e operação dedicada.',
   ARRAY['Equipe especializada','Advogado no caso','Prazo personalizado','Mediação cartorial'],
   false, NULL, true, 3)
ON CONFLICT (id) DO NOTHING;

-- 6) profiles_select já permite ler profissionais (migração anterior). Sem mudança.
```

- [ ] **0.2** Rodar no Supabase › SQL Editor › Run. Esperado: **"Success. No rows returned"**.
- [ ] **0.3** Sanidade rápida no SQL Editor (esperado: retorna linhas, sem erro):
```sql
SELECT id, visible FROM public.pricing_plans ORDER BY sort;
SELECT count(*) FROM public.document_templates;
```

---

## FASE 1 — P0: Leads (não perder cliente pagador)

### Task 1: Tipos das tabelas novas em types.ts

**Files:** Modify `src/integrations/supabase/types.ts`

- [ ] **1.1** No bloco `leads.Row/Insert/Update`, adicionar os campos novos. Localizar `leads: { Row: {` e adicionar em **Row** (após `converted: boolean`):
```typescript
          status: string
          professional_name: string | null
```
Em **Insert** e **Update** (após `converted?: boolean`):
```typescript
          status?: string
          professional_name?: string | null
```

- [ ] **1.2** Adicionar as tabelas `pricing_plans` e `document_templates` dentro de `Tables: {` (após `leads`):
```typescript
      pricing_plans: {
        Row: { id: string; name: string; price: string | null; period: string | null; descr: string | null; features: string[]; popular: boolean; tag: string | null; note: string | null; visible: boolean; sort: number; updated_at: string }
        Insert: { id: string; name: string; price?: string | null; period?: string | null; descr?: string | null; features?: string[]; popular?: boolean; tag?: string | null; note?: string | null; visible?: boolean; sort?: number; updated_at?: string }
        Update: { id?: string; name?: string; price?: string | null; period?: string | null; descr?: string | null; features?: string[]; popular?: boolean; tag?: string | null; note?: string | null; visible?: boolean; sort?: number; updated_at?: string }
        Relationships: []
      }
      document_templates: {
        Row: { id: string; name: string; category: string | null; description: string | null; size_text: string | null; file_path: string | null; created_at: string }
        Insert: { id?: string; name: string; category?: string | null; description?: string | null; size_text?: string | null; file_path?: string | null; created_at?: string }
        Update: { id?: string; name?: string; category?: string | null; description?: string | null; size_text?: string | null; file_path?: string | null; created_at?: string }
        Relationships: []
      }
```

- [ ] **1.3** No bloco `profiles.Row/Insert/Update`, adicionar os campos novos. Em **Row** (após `specialization: string | null`):
```typescript
          email: string | null
          phone: string | null
          cpf: string | null
          city: string | null
          state: string | null
          bio: string | null
          council: string | null
          registro: string | null
          specialties: string[]
          regions: string[]
          accepting: boolean
          max_cases: number
          active: boolean
          settings: Json
```
Em **Insert** e **Update**, os mesmos campos com `?:` e os arrays/booleans opcionais (ex.: `email?: string | null` … `specialties?: string[]` … `settings?: Json`).

- [ ] **1.4** `npm run build` — esperado: sem erros. Commit: `chore(types): tabelas pricing_plans/document_templates + colunas leads/profiles`

---

### Task 2: precos.tsx — lead → Supabase + planos do Supabase

**Files:** Modify `src/routes/precos.tsx`

- [ ] **2.1** Adicionar import no topo (junto aos outros imports):
```tsx
import { supabase } from "@/integrations/supabase/client";
```

- [ ] **2.2** Substituir a função `storeLeadAppend` (linhas ~132-137) por uma gravação no Supabase. Remover `storeLeadAppend` e, em `submitStep2`, trocar o bloco que monta `lead` + `storeLeadAppend(lead)` por:
```tsx
  async function submitStep2(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    await supabase.from("leads").insert({
      name,
      email,
      phone,
      city,
      state,
      tipo_imovel: propType || "Imóvel",
      situacao:    situation || `Interesse em: ${modalProduct}`,
      urgencia:    urgency,
      notes:       `Produto de interesse: ${modalProduct}`,
      source:      "precos",
    });
    setLoading(false);
    setDone(true);
  }
```
(o `setTimeout` de 600ms sai; o feedback agora é o `await` real.)

- [ ] **2.3** Tornar os planos exibidos dinâmicos (admin controla via Financeiro). Localizar o array hardcoded de planos (`const plans = [...]` perto do topo) e, **mantendo-o como fallback**, carregar do Supabase. Adicionar no componente `PrecosPage`, junto aos outros `useState`:
```tsx
  const [planos, setPlanos] = useState(plans);
  useEffect(() => {
    supabase.from("pricing_plans").select("*").eq("visible", true).order("sort")
      .then(({ data }) => {
        if (data && data.length) {
          setPlanos(data.map((p) => ({
            id: p.id, name: p.name, price: p.price ?? "", period: p.period ?? "",
            desc: p.descr ?? "", features: p.features ?? [],
            popular: p.popular, tag: p.tag ?? undefined, note: p.note ?? undefined,
          })));
        }
      });
  }, []);
```
Garantir `import { useEffect } from "react"` (somar ao import existente de `useState`). Trocar onde o JSX faz `.map` sobre `plans` por `planos`.

- [ ] **2.4** `npm run build`. Smoke test: abrir `/precos`, pedir orçamento → conferir no Supabase Table Editor que a linha apareceu em `leads` com `source='precos'`. Commit: `feat(precos): captação de lead grava no Supabase + planos dinâmicos`

---

### Task 3: precos/institucional.tsx — lead → Supabase

**Files:** Modify `src/routes/precos/institucional.tsx`

- [ ] **3.1** Localizar a gravação de lead em `localStorage` (procurar por `localStorage` no arquivo). Adicionar `import { supabase } from "@/integrations/supabase/client";` e substituir a gravação por:
```tsx
await supabase.from("leads").insert({
  name, email, phone, city, state,
  situacao: situation || "Lead institucional",
  notes: "Origem: página institucional",
  source: "institucional",
});
```
Ajustar os nomes das variáveis de estado aos que existem no arquivo (ler o `useState` do formulário antes de mapear). Campos inexistentes no form podem ser omitidos (são opcionais na tabela).

- [ ] **3.2** `npm run build`. Commit: `feat(precos-institucional): lead institucional grava no Supabase`

---

### Task 4: admin/leads.tsx — leads reais do Supabase

**Files:** Modify `src/routes/admin/leads.tsx`

- [ ] **4.1** Remover `SEED_LEADS`, `STORAGE_KEY`, `storeGet`, `storeSet`. Adicionar `import { supabase } from "@/integrations/supabase/client";` e `import { useEffect } from "react";`.

- [ ] **4.2** Trocar o estado inicial e a persistência. O tipo `Lead` da UI tem campos que mapeiam para colunas da tabela `leads` assim: `propertyType↔tipo_imovel`, `situation↔situacao`, `urgency↔urgencia`, `professionalName↔professional_name`, `createdAt↔created_at`. Adicionar um mapeador e carregar:
```tsx
type LeadRow = Tables<"leads">;
function rowToLead(r: LeadRow): Lead {
  return {
    id: r.id, name: r.name ?? "—", phone: r.phone ?? "", email: r.email,
    city: r.city ?? "", state: r.state ?? "",
    propertyType: r.tipo_imovel ?? "—",
    situation: r.situacao ?? "—",
    urgency: (r.urgencia as Urgency) ?? "media",
    status: (r.status as LeadStatus) ?? "novo",
    professionalName: r.professional_name ?? null,
    notes: r.notes ?? "",
    createdAt: r.created_at,
  };
}
```
Adicionar `import type { Tables } from "@/integrations/supabase/types";`.
```tsx
  const [leads, setLeads] = useState<Lead[]>([]);
  useEffect(() => {
    supabase.from("leads").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setLeads(data.map((r) => rowToLead(r as LeadRow))); });
  }, []);
```

- [ ] **4.3** Trocar `update` (que escrevia no localStorage) por update no Supabase:
```tsx
  const update = async (id: string, patch: Partial<Lead>) => {
    const dbPatch: Record<string, unknown> = {};
    if (patch.status) dbPatch.status = patch.status;
    if (patch.professionalName !== undefined) dbPatch.professional_name = patch.professionalName;
    if (patch.notes !== undefined) dbPatch.notes = patch.notes;
    await supabase.from("leads").update(dbPatch).eq("id", id);
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    setSelectedLead((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  };
```
A função `advance` que setava `professionalName = "Carla Rocha"` deve parar de usar nome fixo: remover essa linha (a atribuição real de profissional é feita no `/admin/projeto/:id`). Manter só a troca de `status`.

- [ ] **4.4** `npm run build`. Smoke test: criar um lead via `/cadastrar` (wizard) e via `/precos`; abrir `/admin/leads` logado como admin → ambos aparecem. Commit: `feat(admin/leads): lista e atualiza leads do Supabase`

---

## FASE 2 — P1: Clientes reais

### Task 5: admin/clientes.tsx — de properties

**Files:** Modify `src/routes/admin/clientes.tsx`

- [ ] **5.1** Remover `STORAGE_KEY`, `loadClients`, os dois `useEffect` de polling/storage e o `localStorage` em `remove`. Adicionar `import { supabase } from "@/integrations/supabase/client";`.

- [ ] **5.2** Carregar clientes a partir de `properties` (cada imóvel = um cliente; o `Client` da UI mapeia 1:1):
```tsx
  useEffect(() => {
    supabase.from("properties")
      .select("id, client_name, client_email, client_phone, client_cpf, tipo_imovel, situacao, objetivo, city, state, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        setClients(data.map((p) => ({
          id: p.id,
          nome: p.client_name ?? "—",
          email: p.client_email ?? "—",
          telefone: p.client_phone ?? "",
          cpf: p.client_cpf ?? "",
          tipo_imovel: p.tipo_imovel ?? "",
          situacao: p.situacao ?? "",
          objetivo: p.objetivo ?? "",
          cidade: p.city ?? "",
          estado: p.state ?? "",
          cadastrado_em: p.created_at,
          tutorial_concluido: true,
        })));
      });
  }, []);
```

- [ ] **5.3** `remove` deve apenas tirar da UI (NÃO deletar o imóvel — isso destruiria o processo). Trocar por:
```tsx
  const remove = (_id: string) => {
    alert("Para remover um cliente, exclua o processo dele no Back office. Aqui é somente leitura.");
  };
```
(ou esconder o botão de lixeira no JSX.)

- [ ] **5.4** `npm run build`. Smoke test: `/admin/clientes` lista os clientes que se cadastraram. Commit: `feat(admin/clientes): lista clientes reais de properties`

---

## FASE 3 — P1: Perfis reais (cliente e profissional)

### Task 6: cadastrar.tsx — criar profiles do cliente

**Files:** Modify `src/routes/cadastrar.tsx`

- [ ] **6.1** No `submit()`, logo após obter `uid` (e antes/depois de criar a propriedade), inserir o profile do cliente:
```tsx
    await supabase.from("profiles").upsert({
      id: uid,
      name: data.nome,
      email: data.email,
      role: "cliente",
      city: data.cidade,
      state: data.estado,
    });
```
(upsert evita conflito com eventual trigger de signup.)

- [ ] **6.2** `npm run build`. Commit: `feat(cadastrar): cria linha de profile do cliente`

---

### Task 7: perfil.tsx — perfil do cliente em profiles + guarda

**Files:** Modify `src/routes/perfil.tsx`

- [ ] **7.1** Adicionar guarda de login e contexto. Trocar a definição da rota por:
```tsx
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
// ...
export const Route = createFileRoute("/perfil")({
  head: () => ({ meta: [{ title: "Meu Perfil — Regulariza" }] }),
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/entrar" });
    return { userId: session.user.id };
  },
  component: PerfilPage,
});
```

- [ ] **7.2** Remover `storeGet`/`storeSet` e o `DEFAULT` com "Marina Silveira". Carregar o profile real e o e-mail da sessão:
```tsx
  const { userId } = Route.useRouteContext();
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE); // EMPTY_PROFILE = mesmos campos, strings vazias / bool default
  useEffect(() => {
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle()
      .then(({ data }) => {
        if (data) setProfile((p) => ({
          ...p,
          nome: data.name ?? "", email: data.email ?? "",
          telefone: data.phone ?? "", cpf: data.cpf ?? "",
          cidade: data.city ?? "", estado: data.state ?? "",
          notifEmail: data.settings?.notifEmail ?? true,
          notifSms: data.settings?.notifSms ?? false,
          notifPush: data.settings?.notifPush ?? false,
          notifAtualizacoes: data.settings?.notifAtualizacoes ?? true,
          notifMarketing: data.settings?.notifMarketing ?? false,
        }));
      });
  }, [userId]);
```
Definir `EMPTY_PROFILE` com os mesmos campos do tipo `Profile`, tudo vazio/false.

- [ ] **7.3** Trocar o "Salvar" para gravar no Supabase + atualizar o nome no auth:
```tsx
  async function salvar() {
    await supabase.from("profiles").upsert({
      id: userId,
      name: profile.nome, email: profile.email, phone: profile.telefone,
      cpf: profile.cpf, city: profile.cidade, state: profile.estado,
      role: "cliente",
      settings: {
        notifEmail: profile.notifEmail, notifSms: profile.notifSms,
        notifPush: profile.notifPush, notifAtualizacoes: profile.notifAtualizacoes,
        notifMarketing: profile.notifMarketing,
      },
    });
    await supabase.auth.updateUser({ data: { name: profile.nome } });
  }
```
Ligar `salvar()` ao botão de salvar existente (hoje chama o storeSet). Campos de endereço (cep/logradouro/numero/...) podem ser guardados dentro de `settings` se quiser; manter simples: só os listados acima.

- [ ] **7.4** `npm run build`. Smoke test: logar como cliente → `/perfil` mostra nome/e-mail reais; editar telefone → salvar → recarregar → persistiu. Commit: `feat(perfil): perfil do cliente em profiles + guarda de login`

---

### Task 8: perfil-profissional.tsx — perfil do profissional em profiles + guarda

**Files:** Modify `src/routes/perfil-profissional.tsx`

- [ ] **8.1** Adicionar `beforeLoad` (mesma forma do Task 7.1) retornando `{ userId }`.

- [ ] **8.2** Remover storeGet/storeSet e o DEFAULT "Carla Rocha". Carregar de `profiles` e mapear `ProfProfile`:
```tsx
  useEffect(() => {
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle()
      .then(({ data }) => {
        if (data) setProfile((p) => ({
          ...p,
          nome: data.name ?? "", email: data.email ?? "", telefone: data.phone ?? "",
          bio: data.bio ?? "", conselho: data.council ?? "", registro: data.registro ?? "",
          especialidades: data.specialties ?? [], estados: data.regions ?? [],
          aceitandoCasos: data.accepting ?? true, maxCasos: data.max_cases ?? 8,
          notifMensagens: data.settings?.notifMensagens ?? true,
          notifAtribuicoes: data.settings?.notifAtribuicoes ?? true,
          notifPrazo: data.settings?.notifPrazo ?? true,
        }));
      });
  }, [userId]);
```

- [ ] **8.3** Salvar no Supabase:
```tsx
  async function salvar() {
    await supabase.from("profiles").upsert({
      id: userId, role: "profissional",
      name: profile.nome, email: profile.email, phone: profile.telefone,
      bio: profile.bio, council: profile.conselho, registro: profile.registro,
      specialties: profile.especialidades, regions: profile.estados,
      accepting: profile.aceitandoCasos, max_cases: profile.maxCasos,
      specialization: `${profile.conselho} ${profile.registro}`.trim(),
      settings: {
        notifMensagens: profile.notifMensagens,
        notifAtribuicoes: profile.notifAtribuicoes,
        notifPrazo: profile.notifPrazo,
      },
    });
    await supabase.auth.updateUser({ data: { name: profile.nome } });
  }
```
Dados bancários (banco/agencia/conta) podem ir em `settings` se quiser persistir; manter fora do escopo agora (não exibir promessa de pagamento que não existe).

- [ ] **8.4** `npm run build`. Smoke test: logar como profissional → editar bio → salvar → persiste. Commit: `feat(perfil-profissional): perfil em profiles + guarda`

---

## FASE 4 — P1: Admin cria profissional (server function, service role)

### Task 9: server function createProfessional

**Files:** Create `src/lib/api/professionals.functions.ts`

- [ ] **9.1** Criar o arquivo:
```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const createProfessional = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
    council: z.string().optional().default(""),
    registro: z.string().optional().default(""),
    specialties: z.array(z.string()).optional().default([]),
    regions: z.array(z.string()).optional().default([]),
  }))
  .handler(async ({ data, context }) => {
    // Só admin pode criar contas de profissional
    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", context.userId);
    if (!roles?.some((r) => r.role === "admin")) {
      throw new Error("Apenas administradores podem cadastrar profissionais.");
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name, role: "profissional" },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar usuário.");

    const uid = created.user.id;
    const initials = data.name.trim().split(/\s+/).map((n) => n[0]).slice(0, 2).join("").toUpperCase();
    const { error: pErr } = await supabaseAdmin.from("profiles").upsert({
      id: uid, name: data.name, email: data.email, initials,
      role: "profissional",
      council: data.council, registro: data.registro,
      specialties: data.specialties, regions: data.regions,
      specialization: `${data.council} ${data.registro}`.trim(),
    });
    if (pErr) throw new Error(pErr.message);

    return { id: uid };
  });
```

- [ ] **9.2** `npm run build` — confirmar que compila (server fn tree-shaken do client). Commit: `feat(api): server function createProfessional (service role)`

### Task 10: admin/cadastro-profissional.tsx — usar Supabase

**Files:** Modify `src/routes/admin/cadastro-profissional.tsx`

- [ ] **10.1** Remover `STORAGE_KEY` e toda leitura/escrita em localStorage. Adicionar:
```tsx
import { supabase } from "@/integrations/supabase/client";
import { createProfessional } from "@/lib/api/professionals.functions";
```

- [ ] **10.2** Listar profissionais reais (de `profiles`):
```tsx
  const [pros, setPros] = useState<{ id: string; name: string | null; email: string | null; specialization: string | null; active: boolean }[]>([]);
  async function loadPros() {
    const { data } = await supabase.from("profiles").select("id, name, email, specialization, active").eq("role", "profissional").order("name");
    setPros(data ?? []);
  }
  useEffect(() => { loadPros(); }, []);
```

- [ ] **10.3** No submit do formulário, chamar a server fn (gerar senha temporária e mostrar ao admin para repassar):
```tsx
  async function salvarProfissional() {
    const tempPwd = Math.random().toString(36).slice(-10) + "A1";
    try {
      await createProfessional({ data: {
        name: form.nome, email: form.email, password: tempPwd,
        council: CATEGORIAS.find((c) => c.id === form.categoria)?.registro ?? "",
        registro: form.registro_num,
        specialties: form.areas, regions: form.regioes,
      }});
      alert(`Profissional criado. Senha temporária: ${tempPwd}\nRepasse para ${form.email} trocar no primeiro acesso.`);
      loadPros();
    } catch (e) {
      alert(`Erro: ${(e as Error).message}`);
    }
  }
```
Ligar ao botão de salvar existente. Remover o estado/lista baseados em localStorage e renderizar `pros` na listagem.

- [ ] **10.4** `npm run build`. Smoke test: como admin, criar profissional → conferir em `profiles` (role profissional) → logar com o e-mail/senha temporária → cai em `/painel-profissional`. Commit: `feat(admin/cadastro-profissional): cria/lista profissionais reais via Supabase`

---

## FASE 5 — P2: Financeiro + Documentos-padrão

### Task 11: admin/financeiro.tsx — pricing_plans

**Files:** Modify `src/routes/admin/financeiro.tsx`

- [ ] **11.1** Remover persistência localStorage. Adicionar `import { supabase } from "@/integrations/supabase/client";`.

- [ ] **11.2** Carregar/gravar planos. `PricePlan.desc` ↔ coluna `descr`. Mapear:
```tsx
  useEffect(() => {
    supabase.from("pricing_plans").select("*").order("sort").then(({ data }) => {
      if (data) setPlans(data.map((p) => ({
        id: p.id, name: p.name, price: p.price ?? "", period: p.period ?? "",
        desc: p.descr ?? "", features: p.features ?? [],
        popular: p.popular, tag: p.tag ?? undefined, note: p.note ?? undefined, visible: p.visible,
      })));
    });
  }, []);

  async function savePlan(p: PricePlan, sort: number) {
    await supabase.from("pricing_plans").upsert({
      id: p.id, name: p.name, price: p.price, period: p.period, descr: p.desc,
      features: p.features, popular: !!p.popular, tag: p.tag ?? null, note: p.note ?? null,
      visible: p.visible, sort, updated_at: new Date().toISOString(),
    });
  }
  async function deletePlan(id: string) { await supabase.from("pricing_plans").delete().eq("id", id); }
```
Ligar o botão "Salvar" para chamar `savePlan` em cada plano (ou no plano editado) e o lixo para `deletePlan` + recarregar.

- [ ] **11.3** `npm run build`. Smoke test: editar um preço no Financeiro → abrir `/precos` (anônimo) → o preço novo aparece. Commit: `feat(admin/financeiro): planos no Supabase, refletem em /precos`

### Task 12: admin/documentos-padrao.tsx — document_templates

**Files:** Modify `src/routes/admin/documentos-padrao.tsx`

- [ ] **12.1** Remover `SEED_DOCS`, `STORAGE_KEY`, storeGet/storeSet. Adicionar `import { supabase } from "@/integrations/supabase/client";`.

- [ ] **12.2** Carregar/inserir/excluir:
```tsx
  useEffect(() => {
    supabase.from("document_templates").select("*").order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setDocs(data.map((d) => ({
          id: d.id, name: d.name, category: (d.category as DocCategory) ?? "Orientação",
          description: d.description ?? "", size: d.size_text ?? "—",
          uploadedAt: d.created_at.slice(0, 10),
        })));
      });
  }, []);

  async function addDoc(doc: Omit<PadraoDoc, "id" | "uploadedAt">) {
    await supabase.from("document_templates").insert({
      name: doc.name, category: doc.category, description: doc.description, size_text: doc.size,
    });
  }
  async function removeDoc(id: string) { await supabase.from("document_templates").delete().eq("id", id); }
```
Ligar aos botões existentes (criar/remover) + recarregar após cada ação.

- [ ] **12.3** `npm run build`. Commit: `feat(admin/documentos-padrao): modelos no Supabase`

---

## FASE 6 — P3: Limpeza e polish

### Task 13: Limpeza de código morto e no-ops

**Files:** Modify `src/routes/painel-profissional.tsx`, `src/routes/dashboard.tsx`, `src/routes/admin/index.tsx`

- [ ] **13.1** Em `painel-profissional.tsx`, remover constantes/funcs não usadas: `MOCK_PROCESSES`, `SEED_MSGS`, `AI_REPLIES`, `getAIReply`, `PROF_NAME`, `PROF_INITIALS`, e o import `Bot` de lucide-react (confirmar que nenhuma ainda é referenciada com grep antes de remover).

- [ ] **13.2** Em `dashboard.tsx` linha ~874, remover o `console.log("Tour completado!")`:
```tsx
    <TourProvider onComplete={() => {}}>
```

- [ ] **13.3** Em `admin/index.tsx` (~171), o item "Configurações" do menu do avatar é no-op. Apontar para `/perfil-profissional` (perfil do admin) como destino temporário, igual aos outros painéis:
```tsx
onClick={() => { setShowAvatar(false); navigate({ to: "/perfil-profissional" }); }}
```

- [ ] **13.4** `npm run build`. Commit: `chore: remove código morto, console.log e no-op de configurações`

### Task 14: Estado vazio nos painéis quando admin navega pela StaffBar

**Files:** Modify `src/routes/dashboard.tsx`, `src/routes/painel-profissional.tsx`

- [ ] **14.1** Em `dashboard.tsx`, quando `!property` após o load (cliente sem imóvel — ex.: admin abrindo pela StaffBar), em vez da tela vazia, renderizar um aviso. Localizar o `return` principal e, logo após o check de `loading`, adicionar:
```tsx
  if (!property) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface/50 p-6 text-center">
        <p className="text-sm text-ink-soft">Nenhum imóvel vinculado a esta conta.</p>
        <Link to="/cadastrar" className="rounded-full bg-foreground px-5 py-2.5 text-sm text-background">Cadastrar um imóvel</Link>
        <Link to="/" className="text-xs text-ink-soft underline">Voltar ao site</Link>
      </div>
    );
  }
```

- [ ] **14.2** Em `painel-profissional.tsx`, a lista vazia já mostra mensagem ("Nenhum processo atribuído…") — confirmar que aparece e está clara. Sem mudança se já ok.

- [ ] **14.3** `npm run build`. Commit: `feat(ux): estado vazio claro nos painéis sem dados`

---

## Ordem de execução e verificação final

1. **Fase 0** (rodar SQL) → confirmar "Success".
2. Fases 1→6 em ordem, cada task com `npm run build` + commit.
3. Ao final: `npm run build` completo + push → testar o ciclo no site:
   - Lead por `/precos` aparece em `/admin/leads`.
   - Cliente do wizard aparece em `/admin/clientes`.
   - Perfis de cliente e profissional persistem.
   - Admin cria profissional → ele loga e cai no painel.
   - Editar preço no Financeiro reflete em `/precos`.

## Self-review (feito)
- **Cobertura:** P0 (leads #2,#3,#4), P1 (clientes #5, perfis #6,#7,#8, cadastro-prof #9,#10), P2 (#11,#12), P3 (#13,#14). ✔
- **Sem placeholders:** SQL e chamadas Supabase completas; mapeamentos coluna↔campo explícitos. ✔
- **Consistência de tipos:** `desc↔descr`, `propertyType↔tipo_imovel`, `professionalName↔professional_name`, `especialidades↔specialties`, `estados↔regions` documentados e usados igual em todas as tasks. ✔
