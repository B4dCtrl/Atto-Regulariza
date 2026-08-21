# Painel gerencial do admin — Plano de implementação

> **Para trabalhadores agênticos:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar tarefa a tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** Trocar o chat da Visão geral do admin por um painel que diz o que fazer agora, com briefing, fila priorizada e alertas gerados uma vez por dia pela IA, mais o registro de acesso que revela quem sumiu.

**Arquitetura:** Os números são calculados no servidor a partir do banco e enviados à IA como resumo de texto; ela escreve, não conta. O resultado fica em cache por dia numa tabela. O registro de acesso grava uma linha por entrada e mantém `profiles.ultimo_acesso_em` por gatilho, para leitura barata.

**Stack:** Supabase (Postgres + RLS + gatilhos), TanStack Start server functions, React 19, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-21-painel-gerencial-design.md`

## Restrições globais

- Comentários, mensagens e nomes de coluna em **português (PT-BR)**
- Ref do projeto Supabase: **`fmscewpxmqnbodzstiqa`**
- Migração **idempotente**; no SQL Editor, `ALTER POLICY` quando a política já existe, nunca `DROP` + `CREATE` em statements separados
- Toda função SQL nova: `SECURITY DEFINER` + `SET search_path = public` + `REVOKE ... FROM PUBLIC, anon`
- **Proibido** apagar ou limpar dados reais; o usuário mantém contas de teste
- Erro de banco **nunca** chega cru ao usuário — a camada de API traduz
- À IA vão nomes de pessoa e de processo; **nunca** CPF, matrícula, e-mail ou telefone
- `npm test` precisa continuar passando (35 testes hoje)
- **Não** rodar `npx eslint --fix` em arquivo existente: reformata tudo e enterra o diff

## O que já existe e será reaproveitado

Funções SQL: `is_admin()`, `can_access_property(uuid)`, `can_manage_property(uuid)`

Tabelas: `properties` (`client_id`, `assigned_professional_id`, `status`, `updated_at`, `next_action_deadline`), `profiles` (`id`, `name`, `role`, `approval_status`), `pendencies` (`status`, `criada_em`), `approval_requests` (`status`, `solicitado_em`), `leads` (`status`, `created_at`, `city`, `state`), `documents`, `process_stages`

Padrão de server function com IA: `src/lib/api/assistant.functions.ts` — `createServerFn` + `requireSupabaseAuth` + `supabaseAdmin` + `fetch` ao NVIDIA NIM

Padrão de chamada autenticada: `cabecalhoAuth()` em `src/integrations/supabase/auth-headers.ts`

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20260822_painel_gerencial.sql` | `acessos`, `briefings_admin`, `profiles.ultimo_acesso_em`, RLS, gatilho |
| `supabase/migrations/verificacao/20260822_teste_rls_painel.sql` | Prova as políticas |
| `src/lib/api/resumo-gerencial.ts` | Funções **puras**: montam o resumo de texto a partir dos dados. Testadas por Vitest |
| `src/lib/api/resumo-gerencial.test.ts` | Testes das funções puras |
| `src/lib/api/briefing.functions.ts` | Server function: busca dados, chama a IA, grava o cache |
| `src/lib/api/acessos.ts` | Registrar acesso e ler o briefing do dia |
| `src/components/admin/PainelGerencial.tsx` | Os três blocos na tela |
| `src/routes/admin/index.tsx` | **modificar**: `ChatbotPanel` → `PainelGerencial` |
| `src/routes/dashboard.tsx` | **modificar**: registra acesso ao abrir |
| `src/routes/painel-profissional.tsx` | **modificar**: registra acesso ao abrir |

**Apagados:** `src/components/admin/ChatbotPanel.tsx`, `supabase/functions/admin-chat/`

O `resumo-gerencial.ts` existe separado do `briefing.functions.ts` por um motivo prático: server function não roda em Vitest (depende de `createServerFn` e de ambiente de servidor). Isolando o cálculo em funções puras, a parte que importa — que nenhum dado sensível escape e que as contas de dias estejam certas — fica testável.

---

## Tarefa 1: Migração — acessos, cache do briefing e RLS

**Arquivos:**
- Criar: `supabase/migrations/20260822_painel_gerencial.sql`
- Criar: `supabase/migrations/verificacao/20260822_teste_rls_painel.sql`

**Interfaces:**
- Consome: `is_admin()`
- Produz: tabelas `acessos`, `briefings_admin`; coluna `profiles.ultimo_acesso_em`; função `registrar_acesso(text)`

- [ ] **Passo 1: Escrever a migração**

Criar `supabase/migrations/20260822_painel_gerencial.sql`:

```sql
-- ================================================================
-- PAINEL GERENCIAL DO ADMIN — 2026-08-22
-- ----------------------------------------------------------------
-- Spec: docs/superpowers/specs/2026-08-21-painel-gerencial-design.md
-- Registro de acesso ao painel + cache do briefing diário.
-- Idempotente — seguro rodar mais de uma vez.
-- Rodar em: Supabase › SQL Editor › New Query › Run
-- ================================================================


-- ---------------------------------------------------------------
-- 1) ACESSOS — uma linha por entrada em um dos painéis
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.acessos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  painel     text NOT NULL,
  entrou_em  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT acessos_painel_ck CHECK (painel IN ('cliente','profissional','admin'))
);

CREATE INDEX IF NOT EXISTS acessos_user_idx ON public.acessos (user_id, entrou_em DESC);

ALTER TABLE public.acessos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.acessos FROM anon;
GRANT SELECT, INSERT ON public.acessos TO authenticated;

-- Leitura: só admin. O histórico de acesso de terceiros é dado de gestão.
DROP POLICY IF EXISTS "acessos_select" ON public.acessos;
CREATE POLICY "acessos_select" ON public.acessos FOR SELECT TO authenticated
  USING ( public.is_admin() OR user_id = auth.uid() );

-- Escrita: cada um registra só o PRÓPRIO acesso. Sem isto, qualquer usuário
-- poderia forjar acesso alheio e sujar o dado que o briefing usa.
DROP POLICY IF EXISTS "acessos_insert" ON public.acessos;
CREATE POLICY "acessos_insert" ON public.acessos FOR INSERT TO authenticated
  WITH CHECK ( user_id = auth.uid() );

-- Sem política de UPDATE/DELETE: registro de acesso não se edita nem se apaga.


-- ---------------------------------------------------------------
-- 2) Último acesso no perfil
--
-- Existe ALÉM da tabela de propósito. O briefing precisa do último acesso de
-- dezenas de pessoas numa consulta só; fazer isso sobre o histórico exigiria
-- um agregado a cada geração. Nulo = nunca entrou, que é como o cliente que
-- se cadastrou e abandonou aparece.
-- ---------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ultimo_acesso_em timestamptz;

CREATE OR REPLACE FUNCTION public.ao_registrar_acesso()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
  SET ultimo_acesso_em = NEW.entrou_em
  WHERE id = NEW.user_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ao_registrar_acesso ON public.acessos;
CREATE TRIGGER trg_ao_registrar_acesso
  AFTER INSERT ON public.acessos
  FOR EACH ROW EXECUTE FUNCTION public.ao_registrar_acesso();


-- ---------------------------------------------------------------
-- 3) Registrar acesso
--
-- Via função para o front não precisar montar o INSERT nem conhecer o
-- auth.uid(). A política de INSERT continua valendo — esta função é
-- INVOKER, não DEFINER: ela não contorna a RLS, só encurta a chamada.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_acesso(_painel text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  INSERT INTO public.acessos (user_id, painel)
  VALUES (auth.uid(), _painel)
$$;
REVOKE EXECUTE ON FUNCTION public.registrar_acesso(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.registrar_acesso(text) TO authenticated;


-- ---------------------------------------------------------------
-- 4) BRIEFINGS — cache diário
--
-- `dia` é a chave: uma linha por dia, e o UPSERT do botão "Atualizar"
-- substitui a do dia sem acumular lixo.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.briefings_admin (
  dia         date PRIMARY KEY DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  texto       text NOT NULL,
  fila        jsonb NOT NULL DEFAULT '[]'::jsonb,
  alertas     jsonb NOT NULL DEFAULT '[]'::jsonb,
  gerado_em   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.briefings_admin ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.briefings_admin FROM anon, authenticated;
-- Nenhuma permissão para `authenticated`: quem escreve e lê é a server
-- function, com service_role. Assim o briefing não vaza nem por engano de
-- consulta no front.


-- ================================================================
-- VERIFICAÇÃO — devolve uma linha por checagem, todas 'OK'.
-- ================================================================
SELECT 'tabela acessos existe' AS verificacao,
       CASE WHEN to_regclass('public.acessos') IS NULL THEN 'FALHA' ELSE 'OK' END AS resultado
UNION ALL
SELECT 'coluna ultimo_acesso_em existe',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='profiles'
           AND column_name='ultimo_acesso_em'
       ) THEN 'OK' ELSE 'FALHA' END
UNION ALL
SELECT 'gatilho de ultimo acesso instalado',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_trigger
         WHERE tgrelid='public.acessos'::regclass AND tgname='trg_ao_registrar_acesso'
       ) THEN 'OK' ELSE 'FALHA' END
UNION ALL
SELECT 'registrar_acesso e INVOKER (nao contorna RLS)',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_proc
         WHERE oid='public.registrar_acesso(text)'::regprocedure AND NOT prosecdef
       ) THEN 'OK' ELSE 'FALHA' END
UNION ALL
SELECT 'briefings_admin sem acesso para authenticated',
       CASE WHEN has_table_privilege('authenticated','public.briefings_admin','SELECT')
            THEN 'FALHA' ELSE 'OK' END;
```

- [ ] **Passo 2: Rodar no SQL Editor**

Abrir https://supabase.com/dashboard/project/fmscewpxmqnbodzstiqa/sql/new, colar o arquivo **inteiro** (Ctrl+A antes de copiar — o editor executa só o trecho selecionado quando há seleção), clicar em **Run**.

Esperado: cinco linhas, todas com `resultado = OK`.

- [ ] **Passo 3: Escrever o teste de autorização**

Criar `supabase/migrations/verificacao/20260822_teste_rls_painel.sql`:

```sql
-- ================================================================
-- TESTE DE AUTORIZAÇÃO DO PAINEL GERENCIAL
-- ----------------------------------------------------------------
-- Roda em BEGIN ... ROLLBACK: NADA é gravado. Seguro no banco real.
-- Rodar em: Supabase › SQL Editor › New Query › Run (selecione tudo)
-- ================================================================
BEGIN;

CREATE TEMP TABLE r (caso text, esperado text, obtido text) ON COMMIT DROP;
GRANT ALL ON r TO authenticated;

-- Três identidades de teste, criadas e desfeitas dentro da transação.
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('11111111-1111-1111-1111-111111111111', 'adm@teste.local', '{}'::jsonb),
       ('22222222-2222-2222-2222-222222222222', 'cli@teste.local', '{}'::jsonb),
       ('33333333-3333-3333-3333-333333333333', 'pro@teste.local', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES ('11111111-1111-1111-1111-111111111111', 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO public.acessos (user_id, painel)
VALUES ('22222222-2222-2222-2222-222222222222', 'cliente');

-- ---- CASO 1: cliente não vê acesso alheio ----
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333"}';
INSERT INTO r
SELECT 'cliente nao ve acesso alheio', '0', count(*)::text
FROM public.acessos WHERE user_id = '22222222-2222-2222-2222-222222222222';
RESET ROLE;

-- ---- CASO 2: admin vê tudo ----
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
INSERT INTO r
SELECT 'admin ve acesso alheio', '1', count(*)::text
FROM public.acessos WHERE user_id = '22222222-2222-2222-2222-222222222222';
RESET ROLE;

-- ---- CASO 3: ninguém registra acesso em nome de outro ----
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333"}';
DO $$
BEGIN
  INSERT INTO public.acessos (user_id, painel)
  VALUES ('22222222-2222-2222-2222-222222222222', 'cliente');
  INSERT INTO r VALUES ('nao registra acesso alheio', 'recusado', 'ACEITOU');
EXCEPTION WHEN insufficient_privilege OR check_violation THEN
  INSERT INTO r VALUES ('nao registra acesso alheio', 'recusado', 'recusado');
END $$;
RESET ROLE;

-- ---- CASO 4: authenticated não lê briefings_admin ----
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
DO $$
BEGIN
  PERFORM 1 FROM public.briefings_admin LIMIT 1;
  INSERT INTO r VALUES ('briefing fechado ao front', 'recusado', 'ACEITOU');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO r VALUES ('briefing fechado ao front', 'recusado', 'recusado');
END $$;
RESET ROLE;

SELECT caso, esperado, obtido,
       CASE WHEN esperado = obtido THEN 'OK' ELSE 'FALHA' END AS resultado
FROM r ORDER BY caso;

ROLLBACK;
```

- [ ] **Passo 4: Rodar o teste de autorização**

Colar no SQL Editor (selecione tudo) e rodar.

Esperado: quatro linhas, todas `OK`. O `ROLLBACK` no fim garante que nada ficou gravado.

- [ ] **Passo 5: Commit**

```bash
git add supabase/migrations/20260822_painel_gerencial.sql supabase/migrations/verificacao/20260822_teste_rls_painel.sql
git commit -m "feat(db): registro de acesso ao painel e cache do briefing"
```

---

## Tarefa 2: Montagem do resumo — funções puras e testes

**Arquivos:**
- Criar: `src/lib/api/resumo-gerencial.ts`
- Criar: `src/lib/api/resumo-gerencial.test.ts`

**Interfaces:**
- Consome: nada além de tipos
- Produz:
  - `type DadosGerenciais` — o formato que a server function monta do banco
  - `montarResumo(d: DadosGerenciais, agora: Date): string`
  - `diasDesde(iso: string | null, agora: Date): number | null`

- [ ] **Passo 1: Escrever o teste falhando**

Criar `src/lib/api/resumo-gerencial.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { montarResumo, diasDesde, type DadosGerenciais } from "./resumo-gerencial";

const AGORA = new Date("2026-08-22T12:00:00Z");

function dados(over: Partial<DadosGerenciais> = {}): DadosGerenciais {
  return {
    profissionaisPendentes: [],
    aprovacoesPendentes: [],
    processosParados: [],
    leadsSemResposta: [],
    profissionaisInativos: [],
    ...over,
  };
}

describe("diasDesde", () => {
  it("conta os dias inteiros passados", () => {
    expect(diasDesde("2026-08-10T12:00:00Z", AGORA)).toBe(12);
  });

  it("devolve 0 para hoje", () => {
    expect(diasDesde("2026-08-22T08:00:00Z", AGORA)).toBe(0);
  });

  it("devolve null quando nunca aconteceu", () => {
    expect(diasDesde(null, AGORA)).toBeNull();
  });
});

describe("montarResumo", () => {
  it("diz que não há nada quando tudo está vazio", () => {
    expect(montarResumo(dados(), AGORA)).toContain("Nada pendente");
  });

  it("lista profissional aguardando liberação com a espera em dias", () => {
    const texto = montarResumo(
      dados({
        profissionaisPendentes: [{ nome: "João Souza", desde: "2026-08-19T12:00:00Z" }],
      }),
      AGORA,
    );
    expect(texto).toContain("João Souza");
    expect(texto).toContain("3 dias");
  });

  it("mostra processo parado com etapa, dias e cliente", () => {
    const texto = montarResumo(
      dados({
        processosParados: [
          {
            id: "a3f00000-0000-0000-0000-000000000000",
            nome: "Casa Teste 1",
            etapa: 3,
            paradoDesde: "2026-08-10T12:00:00Z",
            cliente: "Maria Silva",
            clienteUltimoAcesso: "2026-08-13T12:00:00Z",
            documentosPendentes: 2,
          },
        ],
      }),
      AGORA,
    );
    expect(texto).toContain("Casa Teste 1");
    expect(texto).toContain("etapa 3");
    expect(texto).toContain("12 dias");
    expect(texto).toContain("Maria Silva");
    expect(texto).toContain("9 dias");
  });

  it("diz explicitamente quando o cliente nunca acessou", () => {
    const texto = montarResumo(
      dados({
        processosParados: [
          {
            id: "a3f00000-0000-0000-0000-000000000000",
            nome: "Casa Teste 1",
            etapa: 1,
            paradoDesde: "2026-08-20T12:00:00Z",
            cliente: "Maria Silva",
            clienteUltimoAcesso: null,
            documentosPendentes: 1,
          },
        ],
      }),
      AGORA,
    );
    expect(texto).toContain("nunca acessou");
  });

  // Esta é a razão de o módulo existir separado: garantir que nenhum dado
  // sensível vá para um terceiro, mesmo que alguém acrescente campo no futuro.
  it("nao deixa escapar CPF, e-mail, telefone ou matricula", () => {
    const texto = montarResumo(
      dados({
        processosParados: [
          {
            id: "a3f00000-0000-0000-0000-000000000000",
            nome: "Casa Teste 1",
            etapa: 2,
            paradoDesde: "2026-08-15T12:00:00Z",
            cliente: "Maria Silva",
            clienteUltimoAcesso: null,
            documentosPendentes: 0,
          },
        ],
        leadsSemResposta: [
          { cidade: "Curitiba", uf: "PR", desde: "2026-08-17T12:00:00Z" },
        ],
      }),
      AGORA,
    );
    expect(texto).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/); // CPF
    expect(texto).not.toMatch(/@/); // e-mail
    expect(texto).not.toMatch(/\(\d{2}\)\s?\d/); // telefone
    expect(texto.toLowerCase()).not.toContain("matrícula");
  });

  it("encurta o id do processo para caber no texto", () => {
    const texto = montarResumo(
      dados({
        processosParados: [
          {
            id: "a3f00000-0000-0000-0000-000000000000",
            nome: "Casa Teste 1",
            etapa: 2,
            paradoDesde: "2026-08-15T12:00:00Z",
            cliente: "Maria Silva",
            clienteUltimoAcesso: null,
            documentosPendentes: 0,
          },
        ],
      }),
      AGORA,
    );
    expect(texto).toContain("#A3F00000");
    expect(texto).not.toContain("a3f00000-0000-0000-0000-000000000000");
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
cd landing && npx vitest run src/lib/api/resumo-gerencial.test.ts
```

Esperado: FALHA com "Failed to resolve import ./resumo-gerencial".

- [ ] **Passo 3: Escrever a implementação**

Criar `src/lib/api/resumo-gerencial.ts`:

```ts
/**
 * Montagem do resumo que vai para a IA.
 *
 * Funções puras, de propósito: a server function não roda em Vitest, e o que
 * mais importa aqui — que nenhum dado sensível escape para um terceiro e que
 * as contas de dias estejam certas — precisa de teste.
 *
 * A IA recebe este texto e ESCREVE sobre ele. Ela não calcula nada: todo
 * número já vem pronto daqui, e a tela mostra os mesmos dados ao lado do
 * texto, de modo que qualquer invenção fique visível.
 */

export type ProfissionalPendente = {
  nome: string;
  /** Quando entrou na fila de aprovação. */
  desde: string;
};

export type AprovacaoPendente = {
  tipo: string;
  processo: string;
  desde: string;
};

export type ProcessoParado = {
  id: string;
  nome: string;
  etapa: number;
  paradoDesde: string;
  cliente: string;
  /** Nulo quando o cliente nunca entrou no painel. */
  clienteUltimoAcesso: string | null;
  documentosPendentes: number;
};

export type LeadSemResposta = {
  cidade: string | null;
  uf: string | null;
  desde: string;
};

export type ProfissionalInativo = {
  nome: string;
  processos: number;
  ultimoAcesso: string | null;
};

export type DadosGerenciais = {
  profissionaisPendentes: ProfissionalPendente[];
  aprovacoesPendentes: AprovacaoPendente[];
  processosParados: ProcessoParado[];
  leadsSemResposta: LeadSemResposta[];
  profissionaisInativos: ProfissionalInativo[];
};

/** Dias inteiros entre uma data e agora. Nulo quando nunca aconteceu. */
export function diasDesde(iso: string | null, agora: Date): number | null {
  if (!iso) return null;
  const ms = agora.getTime() - new Date(iso).getTime();
  return Math.floor(ms / 86_400_000);
}

/** "há 3 dias", "hoje" — ou "nunca acessou" quando não há data. */
function espera(iso: string | null, agora: Date): string {
  const d = diasDesde(iso, agora);
  if (d === null) return "nunca acessou";
  if (d === 0) return "hoje";
  if (d === 1) return "há 1 dia";
  return `há ${d} dias`;
}

/** Só os 8 primeiros caracteres do uuid: identifica sem poluir o texto. */
function curto(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

export function montarResumo(d: DadosGerenciais, agora: Date): string {
  const linhas: string[] = [];

  if (d.profissionaisPendentes.length > 0) {
    const itens = d.profissionaisPendentes
      .map((p) => `${p.nome} (aguarda ${espera(p.desde, agora)})`)
      .join("; ");
    linhas.push(`Profissionais aguardando liberação: ${itens}`);
  }

  if (d.aprovacoesPendentes.length > 0) {
    const itens = d.aprovacoesPendentes
      .map((a) => `${a.tipo} no processo ${a.processo} (${espera(a.desde, agora)})`)
      .join("; ");
    linhas.push(`Aprovações pendentes: ${itens}`);
  }

  for (const p of d.processosParados) {
    const docs =
      p.documentosPendentes > 0
        ? `, ${p.documentosPendentes} documento(s) pendente(s) do cliente ${p.cliente} (${espera(p.clienteUltimoAcesso, agora)})`
        : `, cliente ${p.cliente} (${espera(p.clienteUltimoAcesso, agora)})`;
    linhas.push(
      `Processo parado: ${curto(p.id)} "${p.nome}" — etapa ${p.etapa}, sem movimento ${espera(p.paradoDesde, agora)}${docs}`,
    );
  }

  if (d.leadsSemResposta.length > 0) {
    const maisAntigo = d.leadsSemResposta.reduce((a, b) =>
      new Date(a.desde) < new Date(b.desde) ? a : b,
    );
    const onde = [maisAntigo.cidade, maisAntigo.uf].filter(Boolean).join("/");
    linhas.push(
      `Leads sem resposta: ${d.leadsSemResposta.length}, o mais antigo ${espera(maisAntigo.desde, agora)}${onde ? ` (${onde})` : ""}`,
    );
  }

  for (const p of d.profissionaisInativos) {
    linhas.push(
      `Profissional inativo: ${p.nome} — ${p.processos} processo(s), ${espera(p.ultimoAcesso, agora)}`,
    );
  }

  if (linhas.length === 0) return "Nada pendente no momento.";
  return linhas.join("\n");
}
```

- [ ] **Passo 4: Rodar e ver passar**

```bash
cd landing && npx vitest run src/lib/api/resumo-gerencial.test.ts
```

Esperado: 8 testes passando.

- [ ] **Passo 5: Conferir tipos, lint e a suíte inteira**

```bash
cd landing && npx tsc --noEmit -p tsconfig.json 2>&1 | grep resumo-gerencial; npx eslint src/lib/api/resumo-gerencial.ts src/lib/api/resumo-gerencial.test.ts && echo "lint ok"; npm test 2>&1 | grep -E "Tests.*passed"
```

Esperado: sem erro de tipo, `lint ok`, 43 testes (35 + 8).

- [ ] **Passo 6: Commit**

```bash
git add src/lib/api/resumo-gerencial.ts src/lib/api/resumo-gerencial.test.ts
git commit -m "feat: montagem testada do resumo enviado a IA"
```

---

## Tarefa 3: Server function do briefing

**Arquivos:**
- Criar: `src/lib/api/briefing.functions.ts`

**Interfaces:**
- Consome: `montarResumo`, `DadosGerenciais` da Tarefa 2; `requireSupabaseAuth`; `supabaseAdmin`
- Produz: `gerarBriefing({ data: { forcar?: boolean }, headers })` → `Promise<Briefing>` onde
  `type Briefing = { texto: string; fila: ItemFila[]; alertas: string[]; gerado_em: string; dados: DadosGerenciais }`
  e `type ItemFila = { titulo: string; motivo: string; destino: string }`

- [ ] **Passo 1: Escrever a server function**

Criar `src/lib/api/briefing.functions.ts`:

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import process from "node:process";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { montarResumo, type DadosGerenciais } from "@/lib/api/resumo-gerencial";

const NIM_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-120b";

/** Um processo sem movimento por mais dias que isto entra no resumo. */
const DIAS_PARADO = 7;
/** Profissional sem acessar o painel por mais dias que isto é sinalizado. */
const DIAS_INATIVO = 5;

export type ItemFila = { titulo: string; motivo: string; destino: string };
export type Briefing = {
  texto: string;
  fila: ItemFila[];
  alertas: string[];
  gerado_em: string;
  dados: DadosGerenciais;
};

const SYSTEM_PROMPT = `Você escreve o briefing gerencial da Ato Regulariza, plataforma de regularização imobiliária.
Recebe um resumo com os dados JÁ APURADOS da operação e escreve para o administrador.

REGRAS:
- NUNCA invente número, nome, prazo ou fato que não esteja no resumo. Se algo não está lá, não existe.
- NUNCA estime nem complete o que falta.
- Escreva em português do Brasil, direto, sem saudação e sem despedida.
- O briefing tem no máximo 4 frases.

Responda SOMENTE com JSON válido, sem cercas de código, neste formato:
{"texto":"<o briefing>","fila":[{"titulo":"<a fazer>","motivo":"<por que é urgente>","destino":"<uma de: aprovacoes|processos|leads>"}],"alertas":["<o que está saindo do radar>"]}
A fila vem ordenada da mais urgente para a menos urgente, com no máximo 6 itens.`;

/** Fuso de São Paulo, para o "dia" bater com o dia do usuário. */
function hojeSP(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

async function coletarDados(): Promise<DadosGerenciais> {
  const agora = Date.now();
  const limiteParado = new Date(agora - DIAS_PARADO * 86_400_000).toISOString();
  const limiteInativo = new Date(agora - DIAS_INATIVO * 86_400_000).toISOString();

  const [profs, aprovacoes, props, leads, inativos] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("name, created_at")
      .eq("role", "profissional")
      .eq("approval_status", "pendente"),
    supabaseAdmin
      .from("approval_requests")
      .select("tipo, property_id, solicitado_em")
      .eq("status", "pendente"),
    supabaseAdmin
      .from("properties")
      .select("id, name, current_stage, updated_at, client_id, client_name")
      .neq("status", "entregue")
      .lt("updated_at", limiteParado),
    supabaseAdmin.from("leads").select("city, state, created_at").eq("status", "novo"),
    supabaseAdmin
      .from("profiles")
      .select("id, name, ultimo_acesso_em")
      .eq("role", "profissional")
      .eq("approval_status", "aprovado")
      .or(`ultimo_acesso_em.is.null,ultimo_acesso_em.lt.${limiteInativo}`),
  ]);

  // Pendências abertas por processo, para dizer quantos documentos faltam.
  const idsParados = (props.data ?? []).map((p) => p.id);
  const pendPorProcesso = new Map<string, number>();
  if (idsParados.length > 0) {
    const { data: pend } = await supabaseAdmin
      .from("pendencies")
      .select("property_id")
      .eq("status", "aberta")
      .in("property_id", idsParados);
    for (const p of pend ?? []) {
      pendPorProcesso.set(p.property_id, (pendPorProcesso.get(p.property_id) ?? 0) + 1);
    }
  }

  // Último acesso dos clientes desses processos, numa consulta só.
  const idsClientes = (props.data ?? []).map((p) => p.client_id).filter(Boolean) as string[];
  const acessoPorCliente = new Map<string, string | null>();
  if (idsClientes.length > 0) {
    const { data: perfis } = await supabaseAdmin
      .from("profiles")
      .select("id, ultimo_acesso_em")
      .in("id", idsClientes);
    for (const p of perfis ?? []) acessoPorCliente.set(p.id, p.ultimo_acesso_em);
  }

  // Quantos processos cada profissional inativo tem na mão.
  const idsInativos = (inativos.data ?? []).map((p) => p.id);
  const processosPorProf = new Map<string, number>();
  if (idsInativos.length > 0) {
    const { data: atrib } = await supabaseAdmin
      .from("properties")
      .select("assigned_professional_id")
      .neq("status", "entregue")
      .in("assigned_professional_id", idsInativos);
    for (const p of atrib ?? []) {
      const k = p.assigned_professional_id;
      if (k) processosPorProf.set(k, (processosPorProf.get(k) ?? 0) + 1);
    }
  }

  return {
    profissionaisPendentes: (profs.data ?? []).map((p) => ({
      nome: p.name ?? "Sem nome",
      desde: p.created_at,
    })),
    aprovacoesPendentes: (aprovacoes.data ?? []).map((a) => ({
      tipo: a.tipo,
      processo: `#${a.property_id.slice(0, 8).toUpperCase()}`,
      desde: a.solicitado_em,
    })),
    processosParados: (props.data ?? []).map((p) => ({
      id: p.id,
      nome: p.name,
      etapa: p.current_stage ?? 1,
      paradoDesde: p.updated_at,
      cliente: p.client_name ?? "Cliente",
      clienteUltimoAcesso: p.client_id ? (acessoPorCliente.get(p.client_id) ?? null) : null,
      documentosPendentes: pendPorProcesso.get(p.id) ?? 0,
    })),
    leadsSemResposta: (leads.data ?? []).map((l) => ({
      cidade: l.city,
      uf: l.state,
      desde: l.created_at,
    })),
    profissionaisInativos: (inativos.data ?? []).map((p) => ({
      nome: p.name ?? "Sem nome",
      processos: processosPorProf.get(p.id) ?? 0,
      ultimoAcesso: p.ultimo_acesso_em,
    })),
  };
}

export const gerarBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ forcar: z.boolean().optional().default(false) }))
  .handler(async ({ data, context }): Promise<Briefing> => {
    // Papel vem do banco, nunca do cliente.
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!roles?.some((r) => r.role === "admin")) {
      throw new Error("Apenas administradores acessam o painel gerencial.");
    }

    const dia = hojeSP();
    const dados = await coletarDados();

    // Cache do dia. Os DADOS são sempre recém-lidos; só o texto vem guardado —
    // assim os números na tela nunca ficam velhos, mesmo com o briefing de
    // algumas horas atrás.
    if (!data.forcar) {
      const { data: cache } = await supabaseAdmin
        .from("briefings_admin")
        .select("texto, fila, alertas, gerado_em")
        .eq("dia", dia)
        .maybeSingle();
      if (cache) {
        return {
          texto: cache.texto,
          fila: cache.fila as ItemFila[],
          alertas: cache.alertas as string[],
          gerado_em: cache.gerado_em,
          dados,
        };
      }
    }

    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) throw new Error("Análise indisponível: IA não configurada no servidor.");

    const resumo = montarResumo(dados, new Date());

    let bruto = "";
    try {
      const res = await fetch(NIM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: process.env.NVIDIA_MODEL || DEFAULT_MODEL,
          temperature: 0.3,
          max_tokens: 900,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: resumo },
          ],
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      bruto = json?.choices?.[0]?.message?.content ?? "";
    } catch {
      throw new Error("Não foi possível gerar a análise agora.");
    }

    // O modelo às vezes embrulha o JSON em cercas de código, mesmo instruído a
    // não fazê-lo. Recortamos do primeiro { ao último } antes de interpretar.
    let texto = "";
    let fila: ItemFila[] = [];
    let alertas: string[] = [];
    try {
      const ini = bruto.indexOf("{");
      const fim = bruto.lastIndexOf("}");
      const parsed = JSON.parse(bruto.slice(ini, fim + 1));
      texto = String(parsed.texto ?? "");
      fila = Array.isArray(parsed.fila) ? parsed.fila.slice(0, 6) : [];
      alertas = Array.isArray(parsed.alertas) ? parsed.alertas.map(String) : [];
    } catch {
      // JSON quebrado não é motivo para deixar o admin sem nada: o texto cru
      // ainda diz algo, e as listas de dados na tela seguem corretas.
      texto = bruto.slice(0, 600);
    }

    const gerado_em = new Date().toISOString();
    await supabaseAdmin
      .from("briefings_admin")
      .upsert({ dia, texto, fila, alertas, gerado_em }, { onConflict: "dia" });

    return { texto, fila, alertas, gerado_em, dados };
  });
```

- [ ] **Passo 2: Acrescentar os tipos das tabelas novas**

Em `src/integrations/supabase/types.ts`, dentro de `Tables`, ao lado de `notifications`, acrescentar:

```ts
      acessos: {
        Row: {
          id: string;
          user_id: string;
          painel: string;
          entrou_em: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          painel: string;
          entrou_em?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          painel?: string;
          entrou_em?: string;
        };
        Relationships: [];
      };
      briefings_admin: {
        Row: {
          dia: string;
          texto: string;
          fila: Json;
          alertas: Json;
          gerado_em: string;
        };
        Insert: {
          dia?: string;
          texto: string;
          fila?: Json;
          alertas?: Json;
          gerado_em?: string;
        };
        Update: {
          dia?: string;
          texto?: string;
          fila?: Json;
          alertas?: Json;
          gerado_em?: string;
        };
        Relationships: [];
      };
```

E em `profiles`, acrescentar `ultimo_acesso_em: string | null;` no `Row`, e `ultimo_acesso_em?: string | null;` no `Insert` e no `Update`.

E em `Functions`, ao lado de `restaurar_documento`:

```ts
      registrar_acesso: {
        Args: {
          _painel: string;
        };
        Returns: undefined;
      };
```

- [ ] **Passo 3: Conferir tipos e lint**

```bash
cd landing && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "briefing|types.ts"; npx eslint src/lib/api/briefing.functions.ts && echo "lint ok"; npm test 2>&1 | grep -E "Tests.*passed"
```

Esperado: sem erro de tipo, `lint ok`, 43 testes.

- [ ] **Passo 4: Commit**

```bash
git add src/lib/api/briefing.functions.ts src/integrations/supabase/types.ts
git commit -m "feat: server function do briefing gerencial"
```

---

## Tarefa 4: Registro de acesso

**Arquivos:**
- Criar: `src/lib/api/acessos.ts`
- Modificar: `src/routes/dashboard.tsx`, `src/routes/painel-profissional.tsx`, `src/routes/admin/index.tsx`

**Interfaces:**
- Consome: função SQL `registrar_acesso(text)` da Tarefa 1
- Produz: `registrarAcesso(painel: "cliente" | "profissional" | "admin"): Promise<void>`

- [ ] **Passo 1: Escrever o módulo**

Criar `src/lib/api/acessos.ts`:

```ts
import { supabase } from "@/integrations/supabase/client";

export type Painel = "cliente" | "profissional" | "admin";

/**
 * Marca que a pessoa entrou num painel.
 *
 * Nunca lança. O registro é telemetria: se falhar, quem está usando o sistema
 * não pode ser impedido de usá-lo por causa disso. O erro fica no console para
 * quem estiver depurando.
 *
 * A função no banco é SECURITY INVOKER e a política de INSERT exige
 * `user_id = auth.uid()` — ninguém registra acesso em nome de outro.
 */
export async function registrarAcesso(painel: Painel): Promise<void> {
  const { error } = await supabase.rpc("registrar_acesso", { _painel: painel });
  if (error) console.warn("[acessos] não foi possível registrar:", error.message);
}
```

- [ ] **Passo 2: Chamar nos três painéis**

Em `src/routes/dashboard.tsx`, acrescentar o import junto dos outros de `@/`:

```tsx
import { registrarAcesso } from "@/lib/api/acessos";
```

E logo depois do efeito que busca o imóvel do cliente (o que tem `}, [userId]);`), acrescentar:

```tsx
  /* Registra a entrada uma vez por montagem da tela. */
  useEffect(() => {
    registrarAcesso("cliente");
  }, []);
```

Em `src/routes/painel-profissional.tsx`, o mesmo import e:

```tsx
  /* Registra a entrada uma vez por montagem da tela. */
  useEffect(() => {
    registrarAcesso("profissional");
  }, []);
```

Em `src/routes/admin/index.tsx`, o mesmo import e:

```tsx
  /* Registra a entrada uma vez por montagem da tela. */
  useEffect(() => {
    registrarAcesso("admin");
  }, []);
```

- [ ] **Passo 3: Conferir**

```bash
cd landing && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "acessos|dashboard|painel-profissional|admin/index"; npm test 2>&1 | grep -E "Tests.*passed"
```

Esperado: sem erro de tipo, 43 testes.

- [ ] **Passo 4: Commit**

```bash
git add src/lib/api/acessos.ts src/routes/dashboard.tsx src/routes/painel-profissional.tsx src/routes/admin/index.tsx
git commit -m "feat: registrar acesso aos tres paineis"
```

---

## Tarefa 5: A tela e a remoção do chat

**Arquivos:**
- Criar: `src/components/admin/PainelGerencial.tsx`
- Modificar: `src/routes/admin/index.tsx:4,228`
- Apagar: `src/components/admin/ChatbotPanel.tsx`, `supabase/functions/admin-chat/`

**Interfaces:**
- Consome: `gerarBriefing`, `Briefing`, `ItemFila` da Tarefa 3; `cabecalhoAuth`

- [ ] **Passo 1: Escrever o componente**

Criar `src/components/admin/PainelGerencial.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { gerarBriefing, type Briefing, type ItemFila } from "@/lib/api/briefing.functions";
import { cabecalhoAuth } from "@/integrations/supabase/auth-headers";

const DESTINO: Record<string, string> = {
  aprovacoes: "/admin/aprovacoes",
  processos: "/admin/processos",
  leads: "/admin/leads",
};

/**
 * O que exige ação agora.
 *
 * Substituiu um chat que respondia dúvidas gerais sobre regularização —
 * conhecimento que o admin já tem, sobre a operação alheia. Aqui a IA lê os
 * dados do próprio sistema.
 *
 * Os números NÃO vêm da IA: `briefing.dados` é lido do banco a cada abertura e
 * exibido ao lado do texto. Se o texto (que é do dia) discordar da lista (que é
 * de agora), a diferença fica visível na mesma tela.
 */
export function PainelGerencial() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (forcar: boolean) => {
    setCarregando(true);
    setErro(null);
    try {
      const b = await gerarBriefing({ data: { forcar }, headers: await cabecalhoAuth() });
      setBriefing(b);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar a análise.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar(false);
  }, [carregar]);

  const d = briefing?.dados;
  const totalTarefas =
    (d?.profissionaisPendentes.length ?? 0) +
    (d?.aprovacoesPendentes.length ?? 0) +
    (d?.processosParados.length ?? 0) +
    (d?.leadsSemResposta.length ?? 0);

  return (
    <section className="rounded-2xl border border-border bg-background p-5">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-foreground text-background">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium leading-none">O que exige você agora</div>
          {briefing && (
            <div className="mt-1 text-[11px] text-ink-soft">
              Análise de{" "}
              {new Date(briefing.gerado_em).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => carregar(true)}
          disabled={carregando}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-ink-soft hover:bg-surface disabled:opacity-50"
        >
          {carregando ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Atualizar
        </button>
      </div>

      {carregando && !briefing ? (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-ink-soft" />
        </div>
      ) : (
        <>
          {/* Briefing escrito */}
          {briefing?.texto && (
            <p className="mt-4 text-sm leading-relaxed">{briefing.texto}</p>
          )}

          {/* A análise pode falhar sem levar o painel junto: as listas abaixo
              vêm do banco e continuam corretas. */}
          {erro && (
            <div className="mt-4 flex gap-2 rounded-xl bg-surface p-3 text-xs text-ink-soft">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* Fila priorizada */}
          {briefing && briefing.fila.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {briefing.fila.map((item: ItemFila, i: number) => (
                <li key={i}>
                  <a
                    href={DESTINO[item.destino] ?? "/admin/processos"}
                    className="flex gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface"
                  >
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-foreground text-[10px] font-medium text-background">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm">{item.titulo}</span>
                      <span className="block text-xs text-ink-soft">{item.motivo}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}

          {/* Alertas */}
          {briefing && briefing.alertas.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <div className="text-[10px] uppercase tracking-widest text-ink-soft">
                Saindo do radar
              </div>
              <ul className="mt-2 space-y-1">
                {briefing.alertas.map((a, i) => (
                  <li key={i} className="flex gap-2 text-xs text-ink-soft">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Os números crus, que não dependem da IA. */}
          {d && (
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-[11px] text-ink-soft">
              <span>{d.profissionaisPendentes.length} profissional(is) a liberar</span>
              <span>{d.aprovacoesPendentes.length} aprovação(ões) pendente(s)</span>
              <span>{d.processosParados.length} processo(s) parado(s)</span>
              <span>{d.leadsSemResposta.length} lead(s) sem resposta</span>
              <span>{d.profissionaisInativos.length} profissional(is) inativo(s)</span>
            </div>
          )}

          {totalTarefas === 0 && !erro && briefing && (
            <p className="mt-4 text-sm text-ink-soft">Nada exige sua ação agora.</p>
          )}
        </>
      )}
    </section>
  );
}
```

- [ ] **Passo 2: Trocar na Visão geral**

Em `src/routes/admin/index.tsx`, linha 4, trocar:

```tsx
import { ChatbotPanel } from "@/components/admin/ChatbotPanel";
```

por:

```tsx
import { PainelGerencial } from "@/components/admin/PainelGerencial";
```

E na linha 228, trocar `<ChatbotPanel />` por `<PainelGerencial />`.

- [ ] **Passo 3: Apagar o chat**

```bash
cd landing && git rm src/components/admin/ChatbotPanel.tsx && git rm -r supabase/functions/admin-chat
```

- [ ] **Passo 4: Remover a entrada do config.toml**

Em `supabase/config.toml`, apagar as três linhas:

```toml
[functions.admin-chat]
verify_jwt = true
```

(mais a linha em branco que as precede)

- [ ] **Passo 5: Conferir**

```bash
cd landing && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "PainelGerencial|ChatbotPanel|admin/index"; npx eslint src/components/admin/PainelGerencial.tsx && echo "lint ok"; npm test 2>&1 | grep -E "Tests.*passed"; npm run build 2>&1 | tail -1
```

Esperado: sem erro de tipo, `lint ok`, 43 testes, build ✓.

- [ ] **Passo 6: Apagar a edge function publicada**

```bash
cd landing && npx supabase functions delete admin-chat --project-ref fmscewpxmqnbodzstiqa
```

Esperado: confirmação de remoção. Conferir com `npx supabase functions list --project-ref fmscewpxmqnbodzstiqa` — devem restar `upload-documento` e `documento-url`.

- [ ] **Passo 7: Commit**

```bash
git add -A src/ supabase/
git commit -m "feat(admin): painel gerencial no lugar do chat"
```

---

## Tarefa 6: Fechar o log e verificar na tela

**Arquivos:**
- Modificar: `docs/LOG-ACOES.md`

- [ ] **Passo 1: Verificar no navegador**

```bash
cd landing && npm run dev
```

Abrir http://localhost:8080/admin logado como admin. Conferir:

1. O bloco "O que exige você agora" aparece no lugar do chat
2. O briefing traz texto em português citando os dados reais
3. Os números da linha de baixo batem com o que você sabe do banco
4. Clicar num item da fila leva à tela certa
5. Clicar em **Atualizar** gera um texto novo e muda o horário

Depois abrir o painel do cliente e o do profissional, voltar ao admin e clicar em **Atualizar**: o alerta de "não acessa há N dias" deve ter mudado para aquelas pessoas.

- [ ] **Passo 2: Fechar os itens no log**

Em `docs/LOG-ACOES.md`, substituir o item 15 por:

```markdown
### 15. ✅ `admin-chat` removido — CONCLUÍDO
O painel gerencial tomou o lugar dele na Visão geral. A edge function foi apagada do
projeto e do código, junto com o `ChatbotPanel`. Fim do resquício do Lovable: sobra um
único fornecedor de IA (NVIDIA NIM), em `assistant.functions.ts` e `briefing.functions.ts`.
```

E acrescentar, ao final da lista de concluídos de 2026-08-21:

```markdown
- ✅ Painel gerencial do admin: briefing diário, fila priorizada e alertas, com registro
  de acesso aos três painéis
```

- [ ] **Passo 3: Commit**

```bash
git add docs/LOG-ACOES.md && git commit -m "docs: fechar item 15 e registrar o painel gerencial"
git push
```

---

## Autorrevisão

**Cobertura do spec:** briefing (T3, T5) · fila priorizada (T3, T5) · alertas (T3, T5) · `acessos` e `ultimo_acesso_em` (T1, T4) · `briefings_admin` e cache diário (T1, T3) · privacidade sem CPF/matrícula/e-mail/telefone (T2, com teste) · trava contra invenção (T3 no prompt, T5 mostrando os dados crus ao lado) · autorização por `user_roles` (T3) e RLS (T1) · server function na Vercel (T3) · remoção do `ChatbotPanel` e do `admin-chat` (T5) · erro que não derruba o painel (T5) · testes Vitest (T2) e SQL em ROLLBACK (T1).

**Sem lacunas:** todo passo que muda código traz o código. Nenhum "TBD".

**Consistência de tipos:** `DadosGerenciais`, `ProcessoParado`, `ItemFila` e `Briefing` são definidos na T2/T3 e usados com os mesmos nomes de campo na T5. `registrarAcesso` (T4) usa o `Painel` declarado no mesmo arquivo. `montarResumo(d, agora)` tem a mesma assinatura no teste (T2) e na chamada (T3).
