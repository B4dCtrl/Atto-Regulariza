# Protocolo de coleta de documentos — Plano de implementação

> **Para trabalhadores agênticos:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar tarefa a tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** Fazer o cliente enviar os três documentos básicos logo após o tutorial, deixar a equipe analisar com a IA triando, e impedir que um processo receba profissional antes de identidade e comprovante de endereço estarem aprovados.

**Arquitetura:** Uma coluna `properties.coleta` acompanha o estado da papelada, separada de `properties.status`, que continua desenhando a barra de etapas. As pendências criadas na análise entram no fluxo de "O que falta de você" que já existe. A trava de delegação vive num gatilho do banco, não na tela.

**Stack:** Supabase (Postgres + RLS + gatilhos), TanStack Start server functions, React 19, TypeScript, Vitest, API do Claude.

**Spec:** `docs/superpowers/specs/2026-08-24-protocolo-documentos-design.md`

## Restrições globais

- Comentários, mensagens e nomes de coluna em **português (PT-BR)**
- Ref do projeto Supabase: **`fmscewpxmqnbodzstiqa`**
- Migração **idempotente**; no SQL Editor, `ALTER POLICY` quando a política já existe, nunca `DROP` + `CREATE` em statements separados
- Toda função SQL nova: `SECURITY DEFINER` + `SET search_path = public` + `REVOKE ... FROM PUBLIC, anon`
- **Proibido** apagar ou limpar dados reais; o usuário mantém contas de teste
- Erro de banco **nunca** chega cru ao usuário — a camada de API traduz
- Documentos essenciais (travam a delegação): `identidade` e `comprovante_endereco`
- Checklist padrão: `identidade`, `comprovante_endereco`, `matricula`
- Estados da coleta: `PENDENTE_INICIAL`, `EM_ANALISE`, `ACAO_REQUERIDA`, `PRONTO_PARA_DELEGACAO`
- A IA recebe **metadados**, nunca o conteúdo dos arquivos
- Toda chamada a server function passa `headers: await cabecalhoAuth()`
- `npm test` precisa continuar passando (68 testes hoje)
- **Não** rodar `npx eslint --fix` em arquivo existente: reformata tudo e enterra o diff

## O que já existe e será reaproveitado

`DOCUMENT_KINDS` com `origem` (`src/lib/document-kinds.ts`) · `documents.status` (`Pendente`/`Enviado`/`Em análise`/`Aprovado`) · `pendencies` + `TarefasDoCliente` · gatilho `ao_criar_versao_documento`, que fecha a pendência quando chega documento do tipo pedido · `enforce_assigned_professional` · edge function `upload-documento` · `UploadDocumento` com `tipoFixo` · `cabecalhoAuth()` · `MODELO_IA` e `aceitaEsforco()` em `src/lib/api/modelo-ia.ts`

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20260824_protocolo_documentos.sql` | Coluna `coleta`, gatilhos de transição, trava de delegação |
| `supabase/migrations/verificacao/20260824_teste_trava.sql` | Prova a trava e as transições |
| `src/lib/checklist-inicial.ts` | Funções **puras**: o que falta do checklist, se os essenciais passaram |
| `src/lib/checklist-inicial.test.ts` | Testes das funções puras |
| `src/components/cliente/ProtocoloInicial.tsx` | A tela pós-tutorial |
| `src/lib/api/analise.functions.ts` | Server function: sugestão da IA e publicação da análise |
| `src/routes/admin/analise.tsx` | A fila e a tela de revisão do admin |
| `src/routes/dashboard.tsx` | **modificar**: abre o protocolo ao fim do tutorial |
| `src/lib/document-kinds.ts` | **modificar**: acrescenta `comprovante_endereco` |
| `src/components/admin/AdminSidebar.tsx` | **modificar**: item "Em análise" |

---

## Tarefa 1: Tipo de documento novo e funções puras do checklist

**Arquivos:**
- Modificar: `src/lib/document-kinds.ts`
- Criar: `src/lib/checklist-inicial.ts`
- Criar: `src/lib/checklist-inicial.test.ts`

**Interfaces:**
- Consome: `DocumentKind` de `@/lib/document-kinds`
- Produz:
  - `CHECKLIST_PADRAO: readonly DocumentKind[]`
  - `KINDS_ESSENCIAIS: readonly DocumentKind[]`
  - `type DocumentoResumo = { kind: string; status: string; deleted_at: string | null }`
  - `faltamDoChecklist(docs: DocumentoResumo[]): DocumentKind[]`
  - `essenciaisAprovados(docs: DocumentoResumo[]): boolean`
  - `rotulosDe(kinds: DocumentKind[]): string`

- [ ] **Passo 1: Acrescentar o tipo `comprovante_endereco`**

Em `src/lib/document-kinds.ts`, no `type DocumentKind`, acrescentar `| "comprovante_endereco"` logo após `"identidade"`. E em `DOCUMENT_KINDS`, logo após a linha do `identidade`:

```ts
  { kind: "comprovante_endereco", label: "Comprovante de endereço", origem: "cliente" },
```

- [ ] **Passo 2: Escrever o teste falhando**

Criar `src/lib/checklist-inicial.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  CHECKLIST_PADRAO,
  KINDS_ESSENCIAIS,
  faltamDoChecklist,
  essenciaisAprovados,
  rotulosDe,
  type DocumentoResumo,
} from "./checklist-inicial";

function doc(over: Partial<DocumentoResumo> = {}): DocumentoResumo {
  return { kind: "identidade", status: "Enviado", deleted_at: null, ...over };
}

describe("CHECKLIST_PADRAO", () => {
  it("tem os três documentos do protocolo inicial", () => {
    expect([...CHECKLIST_PADRAO]).toEqual(["identidade", "comprovante_endereco", "matricula"]);
  });

  it("os essenciais são identidade e comprovante de endereço", () => {
    expect([...KINDS_ESSENCIAIS]).toEqual(["identidade", "comprovante_endereco"]);
  });
});

describe("faltamDoChecklist", () => {
  it("lista os três quando nada foi enviado", () => {
    expect(faltamDoChecklist([])).toEqual([
      "identidade",
      "comprovante_endereco",
      "matricula",
    ]);
  });

  it("não conta documento excluído como entregue", () => {
    const docs = [doc({ kind: "identidade", deleted_at: "2026-08-24T10:00:00Z" })];
    expect(faltamDoChecklist(docs)).toContain("identidade");
  });

  it("conta qualquer status como entregue — enviar já basta para sair da lista", () => {
    // O checklist mede ENVIO, não aprovação: quem enviou fez a parte dele e não
    // deve continuar vendo o item como pendente enquanto a equipe confere.
    const docs = [doc({ kind: "identidade", status: "Enviado" })];
    expect(faltamDoChecklist(docs)).not.toContain("identidade");
  });

  it("devolve lista vazia quando os três chegaram", () => {
    const docs = [
      doc({ kind: "identidade" }),
      doc({ kind: "comprovante_endereco" }),
      doc({ kind: "matricula" }),
    ];
    expect(faltamDoChecklist(docs)).toEqual([]);
  });

  it("ignora documento fora do checklist", () => {
    const docs = [doc({ kind: "iptu" })];
    expect(faltamDoChecklist(docs)).toHaveLength(3);
  });
});

describe("essenciaisAprovados", () => {
  it("é falso sem nenhum documento", () => {
    expect(essenciaisAprovados([])).toBe(false);
  });

  it("é falso com essencial apenas enviado", () => {
    const docs = [
      doc({ kind: "identidade", status: "Enviado" }),
      doc({ kind: "comprovante_endereco", status: "Aprovado" }),
    ];
    expect(essenciaisAprovados(docs)).toBe(false);
  });

  it("é verdadeiro com os dois essenciais aprovados", () => {
    const docs = [
      doc({ kind: "identidade", status: "Aprovado" }),
      doc({ kind: "comprovante_endereco", status: "Aprovado" }),
    ];
    expect(essenciaisAprovados(docs)).toBe(true);
  });

  it("não aceita essencial aprovado que foi excluído depois", () => {
    const docs = [
      doc({ kind: "identidade", status: "Aprovado", deleted_at: "2026-08-24T10:00:00Z" }),
      doc({ kind: "comprovante_endereco", status: "Aprovado" }),
    ];
    expect(essenciaisAprovados(docs)).toBe(false);
  });

  it("não exige matrícula — ela não trava", () => {
    const docs = [
      doc({ kind: "identidade", status: "Aprovado" }),
      doc({ kind: "comprovante_endereco", status: "Aprovado" }),
    ];
    expect(essenciaisAprovados(docs)).toBe(true);
  });
});

describe("rotulosDe", () => {
  it("junta os rótulos legíveis com vírgula", () => {
    expect(rotulosDe(["identidade", "matricula"])).toBe(
      "RG e CPF do proprietário, Matrícula / escritura",
    );
  });

  it("devolve vazio para lista vazia", () => {
    expect(rotulosDe([])).toBe("");
  });
});
```

- [ ] **Passo 3: Rodar e ver falhar**

```bash
cd landing && npx vitest run src/lib/checklist-inicial.test.ts
```

Esperado: FALHA com "Failed to resolve import ./checklist-inicial".

- [ ] **Passo 4: Escrever a implementação**

Criar `src/lib/checklist-inicial.ts`:

```ts
import { rotuloDoKind, type DocumentKind } from "@/lib/document-kinds";

/**
 * O checklist do protocolo inicial e a regra da trava.
 *
 * Funções puras, num arquivo só: a mesma resposta é precisa na tela do cliente
 * (o que ainda falta enviar), na do admin (o caso pode ser delegado?) e no
 * texto do erro do banco. Espalhar essa conta por três lugares garantiria que
 * um deles ficaria para trás.
 */

/** Os três que o cliente envia logo após o tutorial. */
export const CHECKLIST_PADRAO = [
  "identidade",
  "comprovante_endereco",
  "matricula",
] as const satisfies readonly DocumentKind[];

/**
 * Os que travam a delegação.
 *
 * Matrícula fica de fora de propósito: metade de quem procura regularização
 * não tem matrícula — é por isso que procura. Exigi-la para delegar deixaria
 * justamente esses casos parados sem o profissional que sabe resolvê-los.
 */
export const KINDS_ESSENCIAIS = [
  "identidade",
  "comprovante_endereco",
] as const satisfies readonly DocumentKind[];

export type DocumentoResumo = {
  kind: string;
  status: string;
  deleted_at: string | null;
};

/** Documento excluído não conta para nada. */
function vivos(docs: DocumentoResumo[]): DocumentoResumo[] {
  return docs.filter((d) => d.deleted_at === null);
}

/**
 * O que ainda falta do checklist padrão.
 *
 * Mede ENVIO, não aprovação: quem enviou fez a parte dele e não deve continuar
 * vendo o item como pendente enquanto a equipe confere.
 */
export function faltamDoChecklist(docs: DocumentoResumo[]): DocumentKind[] {
  const enviados = new Set(vivos(docs).map((d) => d.kind));
  return CHECKLIST_PADRAO.filter((k) => !enviados.has(k));
}

/** Os dois essenciais estão aprovados? É a regra da trava de delegação. */
export function essenciaisAprovados(docs: DocumentoResumo[]): boolean {
  const aprovados = new Set(
    vivos(docs)
      .filter((d) => d.status === "Aprovado")
      .map((d) => d.kind),
  );
  return KINDS_ESSENCIAIS.every((k) => aprovados.has(k));
}

/** Rótulos legíveis, para mensagem de tela. */
export function rotulosDe(kinds: DocumentKind[]): string {
  return kinds.map(rotuloDoKind).join(", ");
}
```

- [ ] **Passo 5: Rodar e ver passar**

```bash
cd landing && npx vitest run src/lib/checklist-inicial.test.ts
```

Esperado: 13 testes passando.

- [ ] **Passo 6: Conferir tipos, lint e a suíte**

```bash
cd landing && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "checklist-inicial|document-kinds"; npx eslint src/lib/checklist-inicial.ts src/lib/checklist-inicial.test.ts && echo "lint ok"; npm test 2>&1 | grep -E "Tests.*passed"
```

Esperado: sem erro de tipo, `lint ok`, 81 testes (68 + 13).

- [ ] **Passo 7: Commit**

```bash
git add src/lib/checklist-inicial.ts src/lib/checklist-inicial.test.ts src/lib/document-kinds.ts
git commit -m "feat: checklist inicial e regra dos documentos essenciais"
```

---

## Tarefa 2: Migração — estado da coleta e trava de delegação

**Arquivos:**
- Criar: `supabase/migrations/20260824_protocolo_documentos.sql`
- Criar: `supabase/migrations/verificacao/20260824_teste_trava.sql`

**Interfaces:**
- Produz: coluna `properties.coleta`; funções `public.essenciais_aprovados(uuid)`, `public.recalcular_coleta(uuid)`

- [ ] **Passo 1: Escrever a migração**

Criar `supabase/migrations/20260824_protocolo_documentos.sql`:

```sql
-- ================================================================
-- PROTOCOLO DE COLETA DE DOCUMENTOS — 2026-08-24
-- ----------------------------------------------------------------
-- Spec: docs/superpowers/specs/2026-08-24-protocolo-documentos-design.md
--
-- Acrescenta o estado da PAPELADA, separado do estado do PROCESSO.
-- `properties.status` continua desenhando a barra de etapas do cliente;
-- `properties.coleta` responde outra pergunta: em que pé estão os documentos.
--
-- Idempotente — seguro rodar mais de uma vez.
-- Rodar em: Supabase › SQL Editor › New Query › Run (selecione tudo antes)
-- ================================================================


-- ---------------------------------------------------------------
-- 1) Estado da coleta
-- ---------------------------------------------------------------
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS coleta text NOT NULL DEFAULT 'PENDENTE_INICIAL';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'properties_coleta_ck'
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_coleta_ck CHECK (coleta IN (
        'PENDENTE_INICIAL', 'EM_ANALISE', 'ACAO_REQUERIDA', 'PRONTO_PARA_DELEGACAO'
      ));
  END IF;
END $$;


-- ---------------------------------------------------------------
-- 2) Os essenciais estão aprovados?
--
-- Mesma regra de `essenciaisAprovados` em src/lib/checklist-inicial.ts.
-- Existe nos dois lugares porque a tela precisa dela para explicar e o banco
-- precisa dela para impedir — e só a do banco é inviolável.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.essenciais_aprovados(_property_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM unnest(ARRAY['identidade','comprovante_endereco']) AS essencial(kind)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.property_id = _property_id
        AND d.kind = essencial.kind
        AND d.status = 'Aprovado'
        AND d.deleted_at IS NULL
    )
  )
$$;
REVOKE EXECUTE ON FUNCTION public.essenciais_aprovados(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.essenciais_aprovados(uuid) TO authenticated, service_role;


-- ---------------------------------------------------------------
-- 3) Recalcular o estado da coleta
--
-- Chamada pelos gatilhos de documento e de pendência. Concentrar a decisão
-- aqui evita que dois gatilhos discordem sobre o mesmo processo.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalcular_coleta(_property_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_faltam    int;
  v_pendentes int;
  v_novo      text;
BEGIN
  -- Quantos do checklist padrão ainda não foram enviados.
  SELECT count(*) INTO v_faltam
  FROM unnest(ARRAY['identidade','comprovante_endereco','matricula']) AS req(kind)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.property_id = _property_id
      AND d.kind = req.kind
      AND d.deleted_at IS NULL
  );

  SELECT count(*) INTO v_pendentes
  FROM public.pendencies p
  WHERE p.property_id = _property_id AND p.status = 'aberta';

  IF public.essenciais_aprovados(_property_id) THEN
    v_novo := 'PRONTO_PARA_DELEGACAO';
  ELSIF v_faltam > 0 THEN
    v_novo := 'PENDENTE_INICIAL';
  ELSIF v_pendentes > 0 THEN
    v_novo := 'ACAO_REQUERIDA';
  ELSE
    v_novo := 'EM_ANALISE';
  END IF;

  UPDATE public.properties SET coleta = v_novo
  WHERE id = _property_id AND coleta IS DISTINCT FROM v_novo;
END $$;
REVOKE EXECUTE ON FUNCTION public.recalcular_coleta(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.recalcular_coleta(uuid) TO authenticated, service_role;


-- ---------------------------------------------------------------
-- 4) Gatilhos que mantêm o estado em dia
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ao_mudar_documento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recalcular_coleta(COALESCE(NEW.property_id, OLD.property_id));
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_ao_mudar_documento ON public.documents;
CREATE TRIGGER trg_ao_mudar_documento
  AFTER INSERT OR UPDATE OF status, deleted_at, kind ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.ao_mudar_documento();

CREATE OR REPLACE FUNCTION public.ao_mudar_pendencia()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recalcular_coleta(COALESCE(NEW.property_id, OLD.property_id));
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_ao_mudar_pendencia ON public.pendencies;
CREATE TRIGGER trg_ao_mudar_pendencia
  AFTER INSERT OR UPDATE OF status ON public.pendencies
  FOR EACH ROW EXECUTE FUNCTION public.ao_mudar_pendencia();


-- ---------------------------------------------------------------
-- 5) A trava de delegação
--
-- Acrescenta a segunda regra ao gatilho que já existe. Recriamos a função
-- inteira porque ela é substituída, não somada.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_assigned_professional()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_faltando text;
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

    -- Trava só no essencial: identidade e comprovante de endereço. Matrícula
    -- fica de fora porque metade de quem procura regularização não a tem, e é
    -- o profissional quem sabe dizer o caminho nesses casos.
    IF NOT public.essenciais_aprovados(NEW.id) THEN
      SELECT string_agg(rotulo, ', ') INTO v_faltando
      FROM (
        SELECT CASE e.kind
                 WHEN 'identidade' THEN 'RG e CPF do proprietário'
                 ELSE 'Comprovante de endereço'
               END AS rotulo
        FROM unnest(ARRAY['identidade','comprovante_endereco']) AS e(kind)
        WHERE NOT EXISTS (
          SELECT 1 FROM public.documents d
          WHERE d.property_id = NEW.id AND d.kind = e.kind
            AND d.status = 'Aprovado' AND d.deleted_at IS NULL
        )
      ) f;

      RAISE EXCEPTION 'Faltam documentos essenciais aprovados: %', v_faltando;
    END IF;
  END IF;

  RETURN NEW;
END $$;


-- ---------------------------------------------------------------
-- 6) Alinhar os processos que já existem
-- ---------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.properties LOOP
    PERFORM public.recalcular_coleta(r.id);
  END LOOP;
END $$;


-- ================================================================
-- VERIFICAÇÃO — todas as linhas devem sair 'OK'.
-- ================================================================
SELECT 'coluna coleta existe' AS verificacao,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='properties' AND column_name='coleta'
       ) THEN 'OK' ELSE 'FALHA' END AS resultado
UNION ALL
SELECT 'essenciais_aprovados existe',
       CASE WHEN to_regprocedure('public.essenciais_aprovados(uuid)') IS NULL
            THEN 'FALHA' ELSE 'OK' END
UNION ALL
SELECT 'trava de delegacao instalada',
       CASE WHEN (SELECT prosrc FROM pg_proc
                  WHERE oid='public.enforce_assigned_professional()'::regprocedure)
                 LIKE '%essenciais_aprovados%'
            THEN 'OK' ELSE 'FALHA' END
UNION ALL
SELECT 'gatilho de documento instalado',
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_trigger
         WHERE tgrelid='public.documents'::regclass AND tgname='trg_ao_mudar_documento'
       ) THEN 'OK' ELSE 'FALHA' END
UNION ALL
SELECT 'nenhum processo ficou com coleta invalida',
       CASE WHEN EXISTS (
         SELECT 1 FROM public.properties
         WHERE coleta NOT IN ('PENDENTE_INICIAL','EM_ANALISE','ACAO_REQUERIDA','PRONTO_PARA_DELEGACAO')
       ) THEN 'FALHA' ELSE 'OK' END;
```

- [ ] **Passo 2: Rodar no SQL Editor**

Abrir https://supabase.com/dashboard/project/fmscewpxmqnbodzstiqa/sql/new, **Ctrl+A** antes de copiar (o editor executa só o trecho selecionado quando há seleção), colar e **Run**.

Esperado: cinco linhas, todas `OK`.

- [ ] **Passo 3: Escrever o teste da trava**

Criar `supabase/migrations/verificacao/20260824_teste_trava.sql`:

```sql
-- ================================================================
-- TESTE DA TRAVA DE DELEGAÇÃO
-- ----------------------------------------------------------------
-- Roda em BEGIN ... ROLLBACK: NADA é gravado. Seguro no banco real.
-- Rodar em: Supabase › SQL Editor › New Query › Run (selecione tudo)
-- ================================================================
BEGIN;

CREATE TEMP TABLE r (caso text, esperado text, obtido text) ON COMMIT DROP;

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'cli@teste.local', '{}'::jsonb),
       ('aaaaaaaa-0000-0000-0000-000000000002', 'pro@teste.local', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, name, email, role, approval_status)
VALUES ('aaaaaaaa-0000-0000-0000-000000000002', 'Pro Teste', 'pro@teste.local',
        'profissional', 'aprovado')
ON CONFLICT (id) DO UPDATE SET role='profissional', approval_status='aprovado';

INSERT INTO public.properties (id, name, client_id, status, current_stage, progress)
VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'Casa do teste',
        'aaaaaaaa-0000-0000-0000-000000000001', 'entrada', 1, 0);

-- ---- CASO 1: sem documento nenhum, delegar falha ----
DO $$
BEGIN
  UPDATE public.properties
  SET assigned_professional_id = 'aaaaaaaa-0000-0000-0000-000000000002'
  WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001';
  INSERT INTO r VALUES ('delegar sem essencial', 'recusado', 'ACEITOU');
EXCEPTION WHEN raise_exception THEN
  INSERT INTO r VALUES ('delegar sem essencial', 'recusado', 'recusado');
END $$;

-- ---- CASO 2: com só um essencial aprovado, ainda falha ----
INSERT INTO public.documents (property_id, name, kind, origem, status)
VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'rg.pdf', 'identidade', 'cliente', 'Aprovado');

DO $$
BEGIN
  UPDATE public.properties
  SET assigned_professional_id = 'aaaaaaaa-0000-0000-0000-000000000002'
  WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001';
  INSERT INTO r VALUES ('delegar com um essencial', 'recusado', 'ACEITOU');
EXCEPTION WHEN raise_exception THEN
  INSERT INTO r VALUES ('delegar com um essencial', 'recusado', 'recusado');
END $$;

-- ---- CASO 3: com os dois aprovados, passa ----
INSERT INTO public.documents (property_id, name, kind, origem, status)
VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'conta.pdf',
        'comprovante_endereco', 'cliente', 'Aprovado');

DO $$
BEGIN
  UPDATE public.properties
  SET assigned_professional_id = 'aaaaaaaa-0000-0000-0000-000000000002'
  WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001';
  INSERT INTO r VALUES ('delegar com os dois', 'aceito', 'aceito');
EXCEPTION WHEN raise_exception THEN
  INSERT INTO r VALUES ('delegar com os dois', 'aceito', 'RECUSOU');
END $$;

-- ---- CASO 4: matrícula não é exigida ----
INSERT INTO r
SELECT 'matricula nao trava', 'true', public.essenciais_aprovados(
  'bbbbbbbb-0000-0000-0000-000000000001')::text;

-- ---- CASO 5: o estado virou PRONTO_PARA_DELEGACAO ----
INSERT INTO r
SELECT 'coleta recalculada', 'PRONTO_PARA_DELEGACAO', coleta
FROM public.properties WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001';

SELECT caso, esperado, obtido,
       CASE WHEN esperado = obtido THEN 'OK' ELSE 'FALHA' END AS resultado
FROM r ORDER BY caso;

ROLLBACK;
```

- [ ] **Passo 4: Rodar o teste**

Colar no SQL Editor (selecionar tudo) e rodar. Esperado: cinco linhas `OK`. O `ROLLBACK` garante que nada ficou gravado.

- [ ] **Passo 5: Acrescentar os tipos**

Em `src/integrations/supabase/types.ts`, no bloco `properties`, acrescentar `coleta: string;` no `Row` e `coleta?: string;` no `Insert` e no `Update`. E em `Functions`, ao lado de `registrar_acesso`:

```ts
      essenciais_aprovados: {
        Args: {
          _property_id: string;
        };
        Returns: boolean;
      };
```

- [ ] **Passo 6: Commit**

```bash
git add supabase/migrations/20260824_protocolo_documentos.sql supabase/migrations/verificacao/20260824_teste_trava.sql src/integrations/supabase/types.ts
git commit -m "feat(db): estado da coleta e trava de delegacao no essencial"
```

---

## Tarefa 3: Tela do protocolo inicial

**Arquivos:**
- Criar: `src/components/cliente/ProtocoloInicial.tsx`
- Modificar: `src/routes/dashboard.tsx:542-549`

**Interfaces:**
- Consome: `CHECKLIST_PADRAO`, `faltamDoChecklist`, `DocumentoResumo` da Tarefa 1; `UploadDocumento` com `tipoFixo`; `rotuloDoKind`
- Produz: `<ProtocoloInicial propertyId={string} aoSair={() => void} />`

- [ ] **Passo 1: Escrever o componente**

Criar `src/components/cliente/ProtocoloInicial.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import { Check, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { UploadDocumento } from "@/components/documentos/UploadDocumento";
import { rotuloDoKind, type DocumentKind } from "@/lib/document-kinds";
import {
  CHECKLIST_PADRAO,
  faltamDoChecklist,
  type DocumentoResumo,
} from "@/lib/checklist-inicial";

/**
 * O que o cliente faz logo depois do tutorial.
 *
 * Antes desta tela, o tutorial terminava e a pessoa caía no painel sem
 * instrução nenhuma — podia nunca enviar documento algum, e o processo ficava
 * parado sem ninguém perceber.
 *
 * É tela, não modal: modal se fecha e nunca mais volta. E tem saída — prender
 * alguém numa tela sem escapatória faz fechar a aba, e aí perde-se o cliente
 * inteiro em vez de um documento. Quem sai reencontra os mesmos itens em
 * "O que falta de você".
 */
export function ProtocoloInicial({
  propertyId,
  aoSair,
}: {
  propertyId: string;
  aoSair: () => void;
}) {
  const [docs, setDocs] = useState<DocumentoResumo[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(() => {
    supabase
      .from("documents")
      .select("kind, status, deleted_at")
      .eq("property_id", propertyId)
      .then(({ data }) => {
        setDocs((data ?? []) as DocumentoResumo[]);
        setCarregando(false);
      });
  }, [propertyId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const faltam = faltamDoChecklist(docs);
  const enviados = CHECKLIST_PADRAO.length - faltam.length;
  const completo = faltam.length === 0;

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface/40">
        <Loader2 className="h-5 w-5 animate-spin text-ink-soft" />
      </div>
    );
  }

  if (completo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface/40 px-4">
        <div className="w-full max-w-lg rounded-3xl bg-background p-8 text-center ring-1 ring-border">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent/10">
            <Check className="h-5 w-5 text-accent" />
          </span>
          <h1 className="mt-5 font-serif text-2xl">Recebemos seus documentos.</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Nossa equipe está conferindo. Em até 2 dias úteis você recebe aqui a lista do que
            ainda falta para o seu caso.
          </p>
          <button
            type="button"
            onClick={aoSair}
            className="mt-6 rounded-xl bg-foreground px-5 py-2.5 text-sm text-background"
          >
            Ir para o meu painel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface/40 px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <h1 className="font-serif text-3xl leading-tight">Vamos começar pelos documentos</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Com esses três em mãos, nossa equipe consegue analisar seu caso e dizer exatamente o
          que falta. Sem eles, seu processo não sai do lugar.
        </p>
        <p className="mt-1 text-xs text-ink-soft">
          Leva 2 minutos se você já tiver os arquivos no celular.
        </p>

        <div className="mt-6 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${(enviados / CHECKLIST_PADRAO.length) * 100}%` }}
            />
          </div>
          <span className="shrink-0 text-xs text-ink-soft">
            {enviados} de {CHECKLIST_PADRAO.length} enviados
          </span>
        </div>

        <div className="mt-6 space-y-3">
          {CHECKLIST_PADRAO.map((kind) => {
            const pendente = faltam.includes(kind);
            return (
              <div
                key={kind}
                className={`rounded-2xl p-4 ring-1 ${
                  pendente ? "bg-background ring-border" : "bg-accent/5 ring-accent/20"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {pendente ? (
                    <FileText className="h-4 w-4 shrink-0 text-ink-soft" />
                  ) : (
                    <Check className="h-4 w-4 shrink-0 text-accent" />
                  )}
                  <span className="text-sm font-medium">{rotuloDoKind(kind)}</span>
                  {!pendente && <span className="ml-auto text-xs text-accent">enviado</span>}
                </div>

                {kind === "matricula" && pendente && (
                  <p className="mt-2 text-xs leading-relaxed text-ink-soft">
                    Não tem a matrícula? Envie o contrato de compra e venda, ou pule este item —
                    muitos imóveis ainda não têm registro, e é justamente isso que vamos
                    resolver.
                  </p>
                )}

                {pendente && (
                  <div className="mt-3">
                    <UploadDocumento
                      propertyId={propertyId}
                      origem="cliente"
                      tipoFixo={kind as DocumentKind}
                      onEnviado={carregar}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={aoSair}
          className="mt-6 w-full rounded-xl border border-border py-2.5 text-sm text-ink-soft transition-colors hover:bg-surface"
        >
          Enviar depois
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Passo 2: Abrir a tela ao fim do tutorial**

Em `src/routes/dashboard.tsx`, acrescentar o import junto dos outros de `@/`:

```tsx
import { ProtocoloInicial } from "@/components/cliente/ProtocoloInicial";
```

Acrescentar o estado, ao lado de `showTutorial`:

```tsx
  const [showProtocolo, setShowProtocolo] = useState(false);
```

Trocar o bloco do tutorial (hoje em `dashboard.tsx:542-549`) por:

```tsx
        {showTutorial && (
          <FirstTimeTutorial
            onDone={() => {
              setShowTutorial(false);
              // O protocolo entra no lugar do modal de "procurando profissional":
              // não há profissional a procurar antes de os documentos chegarem.
              setShowProtocolo(true);
            }}
          />
        )}
```

E, logo antes de `<div className="flex h-screen overflow-hidden">`, acrescentar:

```tsx
      {showProtocolo && propertyId && (
        <ProtocoloInicial propertyId={propertyId} aoSair={() => setShowProtocolo(false)} />
      )}
```

- [ ] **Passo 3: Conferir**

```bash
cd landing && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "ProtocoloInicial|dashboard"; npx eslint src/components/cliente/ProtocoloInicial.tsx && echo "lint ok"; npm test 2>&1 | grep -E "Tests.*passed"; npm run build 2>&1 | tail -1
```

Esperado: sem erro de tipo, `lint ok`, 81 testes, build ✓.

- [ ] **Passo 4: Commit**

```bash
git add src/components/cliente/ProtocoloInicial.tsx src/routes/dashboard.tsx
git commit -m "feat(cliente): protocolo inicial de documentos apos o tutorial"
```

---

## Tarefa 4: Server function da análise

**Arquivos:**
- Criar: `src/lib/api/analise.functions.ts`

**Interfaces:**
- Consome: `requireSupabaseAuth`, `supabaseAdmin`, `MODELO_IA`, `aceitaEsforco`
- Produz:
  - `type SugestaoDocumento = { id: string; kind: string; nome: string; aprovar: boolean; motivo: string }`
  - `type SugestaoPendencia = { kind: string; descricao: string }`
  - `type Analise = { processo: {...}; documentos: SugestaoDocumento[]; pendencias: SugestaoPendencia[]; parecer: string; erroIA?: string }`
  - `sugerirAnalise({ data: { propertyId }, headers })` → `Promise<Analise>`
  - `publicarAnalise({ data: { propertyId, documentos, pendencias, parecer }, headers })` → `Promise<{ ok: true }>`

- [ ] **Passo 1: Escrever a server function**

Criar `src/lib/api/analise.functions.ts`:

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import process from "node:process";
import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { MODELO_IA, aceitaEsforco } from "@/lib/api/modelo-ia";

export type SugestaoDocumento = {
  id: string;
  kind: string;
  nome: string;
  aprovar: boolean;
  motivo: string;
};

export type SugestaoPendencia = { kind: string; descricao: string };

export type Analise = {
  processo: {
    id: string;
    nome: string;
    tipo: string | null;
    situacao: string | null;
    objetivo: string | null;
    cidade: string | null;
    uf: string | null;
    cliente: string | null;
  };
  documentos: SugestaoDocumento[];
  pendencias: SugestaoPendencia[];
  parecer: string;
  /** Preenchido quando a IA falhou. A tela abre mesmo assim, sem sugestão. */
  erroIA?: string;
};

const SYSTEM_PROMPT = `Você prepara a análise documental da Ato Regulariza, plataforma brasileira de regularização imobiliária. Quem decide é uma pessoa da equipe; você adianta o trabalho dela.

Recebe os dados de um processo e a lista de documentos que o cliente enviou — apenas tipo, nome do arquivo e data. Você NÃO vê o conteúdo dos arquivos.

Devolva:
- para cada documento, se sugere APROVAR e por quê, em uma linha. Como não vê o conteúdo, aprove quando o tipo enviado faz sentido para o caso, e recuse quando o tipo é claramente incompatível.
- as pendências que costumam faltar para esse perfil de caso. Use APENAS estes tipos: matricula, iptu, identidade, comprovante_endereco, planta, habite_se, ccir_car, outro.
- um parecer de no máximo 3 frases, escrito para a equipe.

REGRAS:
- Não invente documento que não esteja na lista.
- Não peça o que já foi enviado.
- A descrição da pendência é lida pelo CLIENTE: escreva direto, sem jargão, dizendo o que ele precisa providenciar.
- Escreva em português do Brasil, sem markdown e sem emoji.`;

const FORMATO_ANALISE = {
  type: "object",
  properties: {
    documentos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "O id do documento, copiado da entrada." },
          aprovar: { type: "boolean" },
          motivo: { type: "string" },
        },
        required: ["id", "aprovar", "motivo"],
        additionalProperties: false,
      },
    },
    pendencias: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: [
              "matricula",
              "iptu",
              "identidade",
              "comprovante_endereco",
              "planta",
              "habite_se",
              "ccir_car",
              "outro",
            ],
          },
          descricao: { type: "string" },
        },
        required: ["kind", "descricao"],
        additionalProperties: false,
      },
    },
    parecer: { type: "string" },
  },
  required: ["documentos", "pendencias", "parecer"],
  additionalProperties: false,
} as const;

/** Confere que quem chamou é admin. Papel vem do banco, nunca do cliente. */
async function exigirAdmin(userId: string): Promise<void> {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Apenas administradores analisam processos.");
  }
}

export const sugerirAnalise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ propertyId: z.string().uuid() }))
  .handler(async ({ data, context }): Promise<Analise> => {
    await exigirAdmin(context.userId);

    const { data: prop } = await supabaseAdmin
      .from("properties")
      .select("id, name, tipo_imovel, situacao, objetivo, city, state, client_name")
      .eq("id", data.propertyId)
      .maybeSingle();
    if (!prop) throw new Error("Processo não encontrado.");

    const { data: docs } = await supabaseAdmin
      .from("documents")
      .select("id, kind, name, created_at")
      .eq("property_id", data.propertyId)
      .is("deleted_at", null)
      .order("created_at");

    const processo = {
      id: prop.id,
      nome: prop.name,
      tipo: prop.tipo_imovel,
      situacao: prop.situacao,
      objetivo: prop.objetivo,
      cidade: prop.city,
      uf: prop.state,
      cliente: prop.client_name,
    };

    const documentosBase: SugestaoDocumento[] = (docs ?? []).map((d) => ({
      id: d.id,
      kind: d.kind,
      nome: d.name,
      aprovar: true,
      motivo: "",
    }));

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        processo,
        documentos: documentosBase,
        pendencias: [],
        parecer: "",
        erroIA: "IA não configurada no servidor (ANTHROPIC_API_KEY ausente).",
      };
    }

    const entrada = [
      `Imóvel: ${processo.nome}`,
      processo.tipo ? `Tipo: ${processo.tipo}` : null,
      processo.situacao ? `Situação: ${processo.situacao}` : null,
      processo.objetivo ? `Objetivo: ${processo.objetivo}` : null,
      processo.cidade ? `Local: ${processo.cidade}/${processo.uf ?? ""}` : null,
      "",
      "Documentos enviados:",
      ...(docs ?? []).map(
        (d) => `- id=${d.id} tipo=${d.kind} arquivo="${d.name}" em ${d.created_at.slice(0, 10)}`,
      ),
      (docs ?? []).length === 0 ? "- nenhum" : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const cliente = new Anthropic({ apiKey });
      const resposta = await cliente.messages.parse(
        {
          model: MODELO_IA,
          max_tokens: 2000,
          output_config: {
            ...(aceitaEsforco() ? { effort: "low" as const } : {}),
            format: jsonSchemaOutputFormat(FORMATO_ANALISE),
          },
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: entrada }],
        },
        { timeout: 45_000 },
      );

      const saida = resposta.parsed_output;
      if (!saida) throw new Error("resposta fora do formato esperado");

      // A sugestão da IA é casada com os documentos REAIS pelo id. Documento
      // que ela invente não tem par e é descartado; documento que ela esqueça
      // mantém o padrão "aprovar".
      const porId = new Map(saida.documentos.map((d) => [d.id, d]));
      const documentos = documentosBase.map((d) => {
        const s = porId.get(d.id);
        return s ? { ...d, aprovar: s.aprovar, motivo: s.motivo } : d;
      });

      return { processo, documentos, pendencias: saida.pendencias, parecer: saida.parecer };
    } catch (e) {
      console.error("[analise] falha ao chamar a IA:", e);
      return {
        processo,
        documentos: documentosBase,
        pendencias: [],
        parecer: "",
        erroIA: "Não foi possível gerar a sugestão automática. Faça a análise à mão.",
      };
    }
  });

export const publicarAnalise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      propertyId: z.string().uuid(),
      documentos: z.array(
        z.object({ id: z.string().uuid(), aprovar: z.boolean(), motivo: z.string() }),
      ),
      pendencias: z.array(z.object({ kind: z.string(), descricao: z.string().min(1) })),
      parecer: z.string(),
    }),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId);

    // Status de cada documento. Recusado volta a "Enviado" e ganha pendência
    // pelo bloco seguinte — não existe status "recusado" na tabela, e inventar
    // um agora quebraria as telas que já leem esta coluna.
    for (const d of data.documentos) {
      await supabaseAdmin
        .from("documents")
        .update({ status: d.aprovar ? "Aprovado" : "Enviado" })
        .eq("id", d.id)
        .eq("property_id", data.propertyId);
    }

    if (data.pendencias.length > 0) {
      await supabaseAdmin.from("pendencies").insert(
        data.pendencias.map((p) => ({
          property_id: data.propertyId,
          descricao: p.descricao,
          kind: p.kind,
          criada_por: context.userId,
        })),
      );
    }

    if (data.parecer.trim()) {
      await supabaseAdmin.from("process_notes").upsert(
        {
          property_id: data.propertyId,
          conteudo: data.parecer,
          autor_id: context.userId,
        },
        { onConflict: "property_id" },
      );
    }

    // O estado da coleta é recalculado pelos gatilhos das duas tabelas acima.
    return { ok: true as const };
  });
```

- [ ] **Passo 2: Conferir**

```bash
cd landing && npx tsc --noEmit -p tsconfig.json 2>&1 | grep analise; npx eslint src/lib/api/analise.functions.ts && echo "lint ok"; npm test 2>&1 | grep -E "Tests.*passed"
```

Esperado: sem erro de tipo, `lint ok`, 81 testes.

- [ ] **Passo 3: Commit**

```bash
git add src/lib/api/analise.functions.ts
git commit -m "feat: server function da analise documental com sugestao da IA"
```

---

## Tarefa 5: Tela de análise do admin

**Arquivos:**
- Criar: `src/routes/admin/analise.tsx`
- Modificar: `src/components/admin/AdminSidebar.tsx`

**Interfaces:**
- Consome: `sugerirAnalise`, `publicarAnalise`, `Analise` da Tarefa 4; `cabecalhoAuth`; `rotuloDoKind`, `kindsPara`

- [ ] **Passo 1: Escrever a rota**

Criar `src/routes/admin/analise.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cabecalhoAuth } from "@/integrations/supabase/auth-headers";
import {
  sugerirAnalise,
  publicarAnalise,
  type Analise,
  type SugestaoPendencia,
} from "@/lib/api/analise.functions";
import { rotuloDoKind, kindsPara } from "@/lib/document-kinds";

export const Route = createFileRoute("/admin/analise")({
  component: AnalisePage,
});

type ItemFila = { id: string; name: string; client_name: string | null; updated_at: string };

function AnalisePage() {
  const [fila, setFila] = useState<ItemFila[]>([]);
  const [aberto, setAberto] = useState<Analise | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [publicando, setPublicando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregarFila() {
    const { data } = await supabase
      .from("properties")
      .select("id, name, client_name, updated_at")
      .eq("coleta", "EM_ANALISE")
      // Quem espera há mais tempo aparece primeiro.
      .order("updated_at", { ascending: true });
    setFila((data ?? []) as ItemFila[]);
    setCarregando(false);
  }

  useEffect(() => {
    carregarFila();
  }, []);

  async function abrir(propertyId: string) {
    setErro(null);
    setCarregando(true);
    try {
      const a = await sugerirAnalise({ data: { propertyId }, headers: await cabecalhoAuth() });
      setAberto(a);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível abrir a análise.");
    } finally {
      setCarregando(false);
    }
  }

  async function publicar() {
    if (!aberto) return;
    setPublicando(true);
    setErro(null);
    try {
      await publicarAnalise({
        data: {
          propertyId: aberto.processo.id,
          documentos: aberto.documentos.map((d) => ({
            id: d.id,
            aprovar: d.aprovar,
            motivo: d.motivo,
          })),
          pendencias: aberto.pendencias,
          parecer: aberto.parecer,
        },
        headers: await cabecalhoAuth(),
      });
      setAberto(null);
      await carregarFila();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível publicar.");
    } finally {
      setPublicando(false);
    }
  }

  function alterarPendencia(i: number, campo: keyof SugestaoPendencia, valor: string) {
    if (!aberto) return;
    const pendencias = aberto.pendencias.map((p, n) =>
      n === i ? { ...p, [campo]: valor } : p,
    );
    setAberto({ ...aberto, pendencias });
  }

  if (carregando && !aberto) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-ink-soft" />
      </div>
    );
  }

  if (aberto) {
    return (
      <div className="mx-auto max-w-3xl p-6 lg:p-8">
        <button
          type="button"
          onClick={() => setAberto(null)}
          className="text-xs text-ink-soft underline"
        >
          voltar à fila
        </button>

        <h1 className="mt-3 font-serif text-3xl">{aberto.processo.nome}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {aberto.processo.cliente ?? "Cliente"}
          {aberto.processo.tipo ? ` · ${aberto.processo.tipo}` : ""}
          {aberto.processo.cidade ? ` · ${aberto.processo.cidade}/${aberto.processo.uf ?? ""}` : ""}
        </p>

        {aberto.erroIA && (
          <div className="mt-4 flex gap-2 rounded-xl bg-surface p-3 text-xs text-ink-soft">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{aberto.erroIA}</span>
          </div>
        )}

        <h2 className="mt-6 text-sm font-medium">Documentos enviados</h2>
        <div className="mt-2 space-y-2">
          {aberto.documentos.length === 0 && (
            <p className="text-sm text-ink-soft">Nenhum documento enviado ainda.</p>
          )}
          {aberto.documentos.map((d, i) => (
            <div key={d.id} className="rounded-xl bg-background p-3 ring-1 ring-border">
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{d.nome}</span>
                  <span className="text-xs text-ink-soft">{rotuloDoKind(d.kind)}</span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setAberto({
                      ...aberto,
                      documentos: aberto.documentos.map((x, n) =>
                        n === i ? { ...x, aprovar: true } : x,
                      ),
                    })
                  }
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] ${
                    d.aprovar ? "bg-accent text-accent-foreground" : "ring-1 ring-border"
                  }`}
                >
                  <Check className="h-3 w-3" /> Aprovar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setAberto({
                      ...aberto,
                      documentos: aberto.documentos.map((x, n) =>
                        n === i ? { ...x, aprovar: false } : x,
                      ),
                    })
                  }
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] ${
                    !d.aprovar ? "bg-red-600 text-white" : "ring-1 ring-border"
                  }`}
                >
                  <X className="h-3 w-3" /> Recusar
                </button>
              </div>
              {d.motivo && <p className="mt-1.5 text-xs text-ink-soft">{d.motivo}</p>}
            </div>
          ))}
        </div>

        <h2 className="mt-6 text-sm font-medium">O que pedir ao cliente</h2>
        <div className="mt-2 space-y-2">
          {aberto.pendencias.map((p, i) => (
            <div key={i} className="flex gap-2 rounded-xl bg-background p-3 ring-1 ring-border">
              <select
                value={p.kind}
                onChange={(e) => alterarPendencia(i, "kind", e.target.value)}
                className="shrink-0 rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
              >
                {kindsPara("cliente").map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {k.label}
                  </option>
                ))}
              </select>
              <input
                value={p.descricao}
                onChange={(e) => alterarPendencia(i, "descricao", e.target.value)}
                placeholder="O que o cliente precisa providenciar"
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() =>
                  setAberto({
                    ...aberto,
                    pendencias: aberto.pendencias.filter((_, n) => n !== i),
                  })
                }
                aria-label="Remover pendência"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-surface"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setAberto({
                ...aberto,
                pendencias: [...aberto.pendencias, { kind: "outro", descricao: "" }],
              })
            }
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-ink-soft hover:bg-surface"
          >
            <Plus className="h-3 w-3" /> Acrescentar pedido
          </button>
        </div>

        <h2 className="mt-6 text-sm font-medium">Parecer da equipe</h2>
        <textarea
          value={aberto.parecer}
          onChange={(e) => setAberto({ ...aberto, parecer: e.target.value })}
          rows={3}
          className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm"
        />

        {erro && (
          <div role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {erro}
          </div>
        )}

        <button
          type="button"
          onClick={publicar}
          disabled={publicando || aberto.pendencias.some((p) => !p.descricao.trim())}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-3 text-sm text-background disabled:opacity-50"
        >
          {publicando && <Loader2 className="h-4 w-4 animate-spin" />}
          Publicar análise
        </button>
        <p className="mt-2 text-center text-[11px] text-ink-soft">
          O cliente vê os pedidos na hora, em “O que falta de você”.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <div className="text-[10px] uppercase tracking-widest text-ink-soft">Gestão</div>
      <h1 className="font-serif text-3xl">Processos em análise</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {fila.length} aguardando conferência · quem espera há mais tempo aparece primeiro
      </p>

      {erro && (
        <div role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      <div className="mt-6 space-y-2">
        {fila.length === 0 && (
          <p className="text-sm text-ink-soft">Nenhum processo aguardando análise.</p>
        )}
        {fila.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => abrir(p.id)}
            className="flex w-full items-center gap-3 rounded-xl bg-background p-4 text-left ring-1 ring-border hover:ring-foreground/30"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{p.name}</span>
              <span className="text-xs text-ink-soft">{p.client_name ?? "Cliente"}</span>
            </span>
            <span className="shrink-0 text-xs text-ink-soft">
              desde {new Date(p.updated_at).toLocaleDateString("pt-BR")}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Passo 2: Item no menu do admin**

Em `src/components/admin/AdminSidebar.tsx`, acrescentar `ClipboardCheck` ao import de `lucide-react` e, em `mainItems`, logo após a linha de `/admin/leads`:

```tsx
  { to: "/admin/analise", label: "Em análise", icon: ClipboardCheck },
```

- [ ] **Passo 3: Conferir**

```bash
cd landing && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "admin/analise|AdminSidebar"; npx eslint src/routes/admin/analise.tsx && echo "lint ok"; npm test 2>&1 | grep -E "Tests.*passed"; npm run build 2>&1 | tail -1
```

Esperado: sem erro de tipo, `lint ok`, 81 testes, build ✓.

- [ ] **Passo 4: Commit**

```bash
git add src/routes/admin/analise.tsx src/components/admin/AdminSidebar.tsx src/routeTree.gen.ts
git commit -m "feat(admin): tela de analise documental com sugestao da IA"
```

---

## Tarefa 6: Verificar na tela e fechar o log

**Arquivos:**
- Modificar: `docs/LOG-ACOES.md`

- [ ] **Passo 1: Verificar o caminho inteiro**

```bash
cd landing && npm run dev
```

Com uma conta de cliente nova, em janela anônima:

1. Concluir o cadastro e o tutorial → a tela **"Vamos começar pelos documentos"** aparece
2. Enviar identidade e comprovante → o progresso vai a "2 de 3"
3. Clicar em **Enviar depois** → cai no painel, e os itens que faltam aparecem em "O que falta de você"
4. Voltar e enviar a matrícula → a tela mostra **"Recebemos seus documentos"**

Como admin, em outra janela:

5. **Em análise** no menu → o processo está na fila
6. Abrir → a sugestão da IA aparece preenchida
7. Recusar um documento, acrescentar um pedido, escrever o parecer, **Publicar análise**

De volta ao cliente:

8. A pendência publicada aparece em "O que falta de você", com envio embutido
9. Enviar o documento pedido → a tarefa some sozinha

Como admin, na tela de processos:

10. Tentar designar profissional antes de aprovar os essenciais → erro dizendo qual falta
11. Aprovar identidade e comprovante na análise → designar passa

- [ ] **Passo 2: Registrar no log**

Em `docs/LOG-ACOES.md`, acrescentar ao final da lista de concluídos:

```markdown
- ✅ Protocolo de coleta de documentos: checklist inicial pós-tutorial, análise com IA triando
  e pessoa confirmando, e trava de delegação nos documentos essenciais
```

- [ ] **Passo 3: Commit**

```bash
git add docs/LOG-ACOES.md && git commit -m "docs: registrar o protocolo de coleta de documentos"
git push
```

---

## Autorrevisão

**Cobertura do spec:** tipo `comprovante_endereco` (T1) · checklist padrão e essenciais (T1, com teste) · coluna `coleta` e os quatro estados (T2) · transições por gatilho (T2) · trava de delegação no banco com mensagem nomeando o que falta (T2, com teste em ROLLBACK) · tela pós-tutorial com progresso, microcopy e "Enviar depois" (T3) · fila de análise ordenada pelo mais antigo (T5) · sugestão da IA sobre metadados, sem conteúdo de arquivo (T4) · revisão e publicação em um clique (T4, T5) · pendências entrando no fluxo existente (T4) · IA que falha não bloqueia a análise (T4, T5) · autorização por `user_roles` (T4) · o que o profissional recebe pronto (T2 recalcula, T4 grava o parecer em `process_notes`).

**Sem lacunas:** todo passo que muda código traz o código. Nenhum "TBD".

**Consistência de tipos:** `DocumentoResumo`, `CHECKLIST_PADRAO`, `KINDS_ESSENCIAIS`, `faltamDoChecklist`, `essenciaisAprovados` são definidos na T1 e usados com os mesmos nomes na T3. `Analise`, `SugestaoDocumento` e `SugestaoPendencia` são definidos na T4 e consumidos na T5 com os mesmos campos. A regra dos essenciais existe em TypeScript (T1) e em SQL (T2) com a mesma lista, e o comentário de cada uma aponta para a outra.
