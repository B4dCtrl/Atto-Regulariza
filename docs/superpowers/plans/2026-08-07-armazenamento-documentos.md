# Armazenamento de Documentos com Versionamento — Plano de Implementação

> **Para trabalhadores agênticos:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar tarefa a tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** Guardar arquivos de verdade no Supabase Storage, com histórico de versões, validação de conteúdo no servidor e isolamento por autorização.

**Arquitetura:** O arquivo sobe pela edge function `upload-documento`, que confere identidade, permissão, tamanho e assinatura real do conteúdo antes de gravar. O caminho no bucket é composto só de UUIDs — nome enviado pelo usuário nunca compõe caminho. Leitura sai por URL assinada de 5 minutos, emitida pela função `documento-url` após checar `can_read_document()`, a mesma função que governa a RLS da tabela e a do Storage.

**Stack:** Supabase (Postgres + Storage + Edge Functions/Deno), React 19, TanStack Router/Start, Vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-07-armazenamento-documentos-design.md`

## Restrições globais

- Tipos aceitos, **apenas estes três**: `application/pdf`, `image/jpeg`, `image/png`
- Tamanho máximo: **26214400 bytes (25 MB)**, validado na edge function **e** na configuração do bucket
- Bucket `documentos` com `public = false` — nunca URL pública
- Caminho no Storage: `{property_id}/{document_id}/{version_id}` — sem nome de arquivo
- URL assinada expira em **300 segundos**
- CORS das edge functions restrito a: `https://atoregulariza.com.br`, `https://www.atoregulariza.com.br`, `https://curso.atoregulariza.com.br`, `http://localhost:8080` — nunca `*`
- Escrita direta no bucket é **negada** para `authenticated`; só `service_role` (edge function) grava
- SVG e HTML são proibidos por decisão explícita (script embutido → XSS armazenado)
- Nome do arquivo: remover caracteres de controle `\x00-\x1f`, cortar em 255; **preservar acento e espaço**
- Sem tokens CSRF — a sessão é Bearer em `localStorage`, não cookie (ver spec, seção CSRF)
- Referência do projeto Supabase: `fmscewpxmqnbodzstiqa`
- Textos de interface e comentários de código em **português (PT-BR)**
- Marcador `[PENDÊNCIA: e-mail do admin]` fica literal na mensagem de arquivo grande até o usuário criar o endereço

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/functions/_shared/documento-validacao.ts` | Funções puras: assinatura de conteúdo, normalização de nome, limites. Fonte única, usada pela edge function e testada por Vitest |
| `supabase/functions/_shared/cors.ts` | Cabeçalhos CORS por origem permitida |
| `supabase/functions/upload-documento/index.ts` | Recebe, valida, grava no Storage e no banco |
| `supabase/functions/documento-url/index.ts` | Emite URL assinada após checar permissão |
| `supabase/migrations/20260808_documentos_storage.sql` | Tabelas, funções de decisão, RLS, bucket |
| `src/lib/document-kinds.ts` | Tipos de documento e resolução de versão. Fonte única do seletor |
| `src/lib/api/documentos.ts` | Client: enviar, listar, histórico, URL assinada |
| `src/components/documentos/DocumentPreview.tsx` | Modal de visualização |
| `src/components/documentos/UploadDocumento.tsx` | Seletor de tipo + envio |
| `src/components/documentos/DocumentList.tsx` | Lista da versão vigente + histórico |

## Estratégia de verificação — leia antes de começar

O projeto **não tem nenhuma infraestrutura de teste**: sem runner, sem um único arquivo de teste. A Tarefa 1 instala o Vitest.

Ainda assim, nem tudo aqui é testável por unidade, e o plano não finge que é. Três camadas, cada uma com o método que realmente prova aquilo:

| Camada | Como se verifica | Automatizado? |
|---|---|---|
| Lógica pura (assinatura, nome, tipos) | Vitest | Sim |
| Autorização (RLS, funções SQL) | Script SQL executado no Supabase, com `set local role` e JWT simulado | Não — execução manual, resultado conferido |
| Interface e integração | Navegador via ferramentas de preview | Não — verificação manual guiada |

Os testes de RLS são os **mais importantes do plano**: são eles que provam a trava de visibilidade do cliente. Não pule a Tarefa 3.

---

## Tarefa 1: Vitest e validação de conteúdo

**Arquivos:**
- Modificar: `package.json`
- Criar: `vitest.config.ts`
- Criar: `supabase/functions/_shared/documento-validacao.ts`
- Criar: `supabase/functions/_shared/documento-validacao.test.ts`

**Interfaces:**
- Produz:
  - `TAMANHO_MAXIMO_BYTES: number` (26214400)
  - `MIMES_PERMITIDOS: readonly string[]`
  - `type MimePermitido = "application/pdf" | "image/jpeg" | "image/png"`
  - `assinaturaConfere(bytes: Uint8Array, mime: string): boolean`
  - `normalizarNomeArquivo(nome: string): string | null` — `null` se inválido
  - `validarArquivo(input: { bytes: Uint8Array; mime: string; nome: string; tamanho: number }): { ok: true; nome: string } | { ok: false; codigo: CodigoErro; mensagem: string }`
  - `type CodigoErro = "tamanho" | "tipo" | "assinatura" | "nome"`

- [ ] **Passo 1: Instalar o Vitest**

```bash
cd landing && npm install -D vitest@^3.2.4
```

- [ ] **Passo 2: Criar a configuração**

Criar `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Ambiente Node: os testes cobrem lógica pura, sem DOM.
    environment: "node",
    include: ["src/**/*.test.ts", "supabase/functions/**/*.test.ts"],
  },
});
```

- [ ] **Passo 3: Adicionar o script de teste**

Em `package.json`, dentro de `"scripts"`, acrescentar após `"format"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Passo 4: Escrever os testes que falham**

Criar `supabase/functions/_shared/documento-validacao.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  TAMANHO_MAXIMO_BYTES,
  assinaturaConfere,
  normalizarNomeArquivo,
  validarArquivo,
} from "./documento-validacao";

/** Monta bytes iniciais seguidos de lixo, simulando um arquivo real. */
function comAssinatura(...prefixo: number[]): Uint8Array {
  return new Uint8Array([...prefixo, 0x00, 0x01, 0x02, 0x03]);
}

const PDF = comAssinatura(0x25, 0x50, 0x44, 0x46, 0x2d);
const JPEG = comAssinatura(0xff, 0xd8, 0xff);
const PNG = comAssinatura(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
// "<html>" — o disfarce clássico
const HTML = new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x3e]);

describe("assinaturaConfere", () => {
  it("aceita PDF, JPEG e PNG legítimos", () => {
    expect(assinaturaConfere(PDF, "application/pdf")).toBe(true);
    expect(assinaturaConfere(JPEG, "image/jpeg")).toBe(true);
    expect(assinaturaConfere(PNG, "image/png")).toBe(true);
  });

  it("recusa HTML que se declara PDF", () => {
    expect(assinaturaConfere(HTML, "application/pdf")).toBe(false);
  });

  it("recusa PDF que se declara imagem", () => {
    expect(assinaturaConfere(PDF, "image/png")).toBe(false);
  });

  it("recusa arquivo curto demais para ter assinatura", () => {
    expect(assinaturaConfere(new Uint8Array([0x25]), "application/pdf")).toBe(false);
  });

  it("recusa tipo fora da lista mesmo com bytes coerentes", () => {
    const svg = new Uint8Array([0x3c, 0x73, 0x76, 0x67]);
    expect(assinaturaConfere(svg, "image/svg+xml")).toBe(false);
  });
});

describe("normalizarNomeArquivo", () => {
  it("preserva acento e espaço", () => {
    expect(normalizarNomeArquivo("Matrícula nº 12.345 — Lote B.pdf"))
      .toBe("Matrícula nº 12.345 — Lote B.pdf");
  });

  it("remove caracteres de controle", () => {
    expect(normalizarNomeArquivo("nota\x00\x1ffiscal.pdf")).toBe("notafiscal.pdf");
  });

  it("corta em 255 caracteres", () => {
    const longo = "a".repeat(300) + ".pdf";
    expect(normalizarNomeArquivo(longo)!.length).toBe(255);
  });

  it("devolve null para nome vazio ou só espaços", () => {
    expect(normalizarNomeArquivo("")).toBeNull();
    expect(normalizarNomeArquivo("   ")).toBeNull();
    expect(normalizarNomeArquivo("\x00")).toBeNull();
  });

  it("mantém o nome intacto mesmo com sequência de travessia", () => {
    // Não é papel desta função barrar travessia: o nome nunca compõe caminho.
    // Guardar o texto original é correto; o caminho é feito só de UUIDs.
    expect(normalizarNomeArquivo("../../etc/passwd")).toBe("../../etc/passwd");
  });
});

describe("validarArquivo", () => {
  const base = { bytes: PDF, mime: "application/pdf", nome: "doc.pdf", tamanho: 1000 };

  it("aceita um PDF válido", () => {
    const r = validarArquivo(base);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.nome).toBe("doc.pdf");
  });

  it("recusa acima do limite", () => {
    const r = validarArquivo({ ...base, tamanho: TAMANHO_MAXIMO_BYTES + 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe("tamanho");
  });

  it("recusa tipo não permitido", () => {
    const r = validarArquivo({ ...base, mime: "image/svg+xml" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe("tipo");
  });

  it("recusa conteúdo que não bate com o tipo declarado", () => {
    const r = validarArquivo({ ...base, bytes: HTML });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe("assinatura");
  });

  it("recusa nome vazio", () => {
    const r = validarArquivo({ ...base, nome: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe("nome");
  });

  it("não revela qual checagem falhou na mensagem de assinatura", () => {
    const r = validarArquivo({ ...base, bytes: HTML });
    if (!r.ok) {
      expect(r.mensagem).not.toMatch(/assinatura|magic|byte/i);
      expect(r.mensagem).toMatch(/corrompido/i);
    }
  });
});
```

- [ ] **Passo 5: Rodar e confirmar que falha**

```bash
cd landing && npm test
```

Esperado: FALHA — `Failed to resolve import "./documento-validacao"`.

- [ ] **Passo 6: Escrever a implementação**

Criar `supabase/functions/_shared/documento-validacao.ts`:

```ts
/**
 * Validação de arquivos enviados — fonte única.
 *
 * Roda dentro da edge function (Deno) e é testada por Vitest (Node). Por isso
 * só usa APIs padrão da linguagem: nada de Deno.*, nada de Node.*.
 *
 * A validação de verdade acontece aqui, no servidor. O que o navegador checa
 * serve ao usuário de boa-fé; quem controla o cliente controla o que o cliente
 * declara, então o Content-Type recebido é declaração, não fato.
 */

export const TAMANHO_MAXIMO_BYTES = 26_214_400; // 25 MB

export const MIMES_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png"] as const;
export type MimePermitido = (typeof MIMES_PERMITIDOS)[number];

export type CodigoErro = "tamanho" | "tipo" | "assinatura" | "nome";

/**
 * Bytes iniciais que identificam cada formato. Lista de permissão: o que não
 * está aqui é recusado, inclusive formato que ainda não existe.
 *
 * SVG e HTML ficam de fora por decisão explícita — SVG é XML que aceita
 * <script>, e seria servido como imagem para o olho e código para o navegador.
 */
const ASSINATURAS: Record<MimePermitido, number[]> = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
};

function ehMimePermitido(mime: string): mime is MimePermitido {
  return (MIMES_PERMITIDOS as readonly string[]).includes(mime);
}

/** O conteúdo real corresponde ao tipo declarado? */
export function assinaturaConfere(bytes: Uint8Array, mime: string): boolean {
  if (!ehMimePermitido(mime)) return false;
  const esperada = ASSINATURAS[mime];
  if (bytes.length < esperada.length) return false;
  return esperada.every((b, i) => bytes[i] === b);
}

/**
 * Prepara o nome para armazenamento como TEXTO.
 *
 * Este nome nunca compõe caminho, URL ou HTML bruto — o caminho no bucket é
 * feito só de UUIDs, e o React escapa na renderização. Por isso preservamos
 * acento e espaço: "Matrícula nº 12.345 — Lote B.pdf" é informação legítima do
 * usuário, e descaracterizá-la não fecha vetor nenhum.
 *
 * Removemos apenas caracteres de controle, que não têm uso legítimo em nome de
 * arquivo e sujam log e terminal.
 */
export function normalizarNomeArquivo(nome: string): string | null {
  // eslint-disable-next-line no-control-regex
  const limpo = nome.replace(/[\x00-\x1f\x7f]/g, "").trim();
  if (limpo.length === 0) return null;
  return limpo.slice(0, 255);
}

export function validarArquivo(input: {
  bytes: Uint8Array;
  mime: string;
  nome: string;
  tamanho: number;
}): { ok: true; nome: string } | { ok: false; codigo: CodigoErro; mensagem: string } {
  if (input.tamanho > TAMANHO_MAXIMO_BYTES) {
    const mb = (input.tamanho / 1_048_576).toFixed(0);
    return {
      ok: false,
      codigo: "tamanho",
      mensagem:
        `Este arquivo tem ${mb} MB e o limite é 25 MB. Envie uma versão comprimida ` +
        `ou mande para [PENDÊNCIA: e-mail do admin] que a equipe anexa ao seu processo.`,
    };
  }

  if (!ehMimePermitido(input.mime)) {
    return {
      ok: false,
      codigo: "tipo",
      mensagem: "Aceitamos PDF, JPEG e PNG. Converta o arquivo e tente de novo.",
    };
  }

  if (!assinaturaConfere(input.bytes, input.mime)) {
    // Mensagem deliberadamente vaga: se for tentativa de ataque, não entregamos
    // qual checagem pegou.
    return {
      ok: false,
      codigo: "assinatura",
      mensagem:
        "Não conseguimos validar este arquivo. Ele pode estar corrompido — tente gerar novamente.",
    };
  }

  const nome = normalizarNomeArquivo(input.nome);
  if (nome === null) {
    return { ok: false, codigo: "nome", mensagem: "Nome de arquivo inválido." };
  }

  return { ok: true, nome };
}
```

- [ ] **Passo 7: Rodar e confirmar que passa**

```bash
cd landing && npm test
```

Esperado: PASSA — 16 testes.

- [ ] **Passo 8: Commit**

```bash
cd landing && git add package.json package-lock.json vitest.config.ts supabase/functions/_shared/ && git commit -m "feat: validacao de conteudo de arquivo com testes"
```

---

## Tarefa 2: Tipos de documento

**Arquivos:**
- Criar: `src/lib/document-kinds.ts`
- Criar: `src/lib/document-kinds.test.ts`

**Interfaces:**
- Consome: nada
- Produz:
  - `type DocumentKind` (união literal dos 11 tipos)
  - `type DocumentOrigem = "cliente" | "profissional"`
  - `DOCUMENT_KINDS: readonly { kind: DocumentKind; label: string; origem: DocumentOrigem }[]`
  - `kindsPara(origem: DocumentOrigem)` — retorno inferido; **não anotar** como
    `typeof DOCUMENT_KINDS`: no ramo `cliente` o `filter` devolve array mutável de um
    subtipo, incompatível com a tupla `readonly` de 11 itens. Consumir como
    `{ kind, label, origem }[]`.
  - `rotuloDoKind(kind: string): string`

- [ ] **Passo 1: Escrever os testes que falham**

Criar `src/lib/document-kinds.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { DOCUMENT_KINDS, kindsPara, rotuloDoKind } from "./document-kinds";

describe("DOCUMENT_KINDS", () => {
  it("não tem kind repetido", () => {
    const kinds = DOCUMENT_KINDS.map((k) => k.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it("todo kind tem rótulo não vazio", () => {
    for (const k of DOCUMENT_KINDS) expect(k.label.length).toBeGreaterThan(0);
  });
});

describe("kindsPara", () => {
  it("oferece ao cliente os documentos dele e 'outro'", () => {
    const kinds = kindsPara("cliente").map((k) => k.kind);
    expect(kinds).toContain("matricula");
    expect(kinds).toContain("iptu");
    expect(kinds).toContain("outro");
  });

  it("não oferece peça técnica ao cliente", () => {
    const kinds = kindsPara("cliente").map((k) => k.kind);
    expect(kinds).not.toContain("art_rrt");
    expect(kinds).not.toContain("laudo");
    expect(kinds).not.toContain("projeto");
  });

  it("oferece ao profissional todos os tipos", () => {
    expect(kindsPara("profissional").length).toBe(DOCUMENT_KINDS.length);
  });
});

describe("rotuloDoKind", () => {
  it("traduz um kind conhecido", () => {
    expect(rotuloDoKind("matricula")).toBe("Matrícula / escritura");
  });

  it("devolve rótulo genérico para kind desconhecido", () => {
    expect(rotuloDoKind("inexistente")).toBe("Documento");
  });
});
```

- [ ] **Passo 2: Rodar e confirmar que falha**

```bash
cd landing && npm test -- document-kinds
```

Esperado: FALHA — `Failed to resolve import "./document-kinds"`.

- [ ] **Passo 3: Escrever a implementação**

Criar `src/lib/document-kinds.ts`:

```ts
/**
 * Tipos de documento — fonte única.
 *
 * Usado pelo seletor do cliente, pelo do profissional e pelos rótulos das
 * listagens. Ter um só lugar evita que a lista do seletor e a da exibição
 * divirjam com o tempo.
 */

export type DocumentOrigem = "cliente" | "profissional";

export type DocumentKind =
  | "matricula"
  | "iptu"
  | "identidade"
  | "planta"
  | "habite_se"
  | "ccir_car"
  | "art_rrt"
  | "laudo"
  | "projeto"
  | "protocolo"
  | "outro";

export const DOCUMENT_KINDS = [
  { kind: "matricula",  label: "Matrícula / escritura",     origem: "cliente" },
  { kind: "iptu",       label: "IPTU atualizado",           origem: "cliente" },
  { kind: "identidade", label: "RG e CPF do proprietário",  origem: "cliente" },
  { kind: "planta",     label: "Planta do imóvel",          origem: "cliente" },
  { kind: "habite_se",  label: "Habite-se",                 origem: "cliente" },
  { kind: "ccir_car",   label: "CCIR / CAR (rural)",        origem: "cliente" },
  { kind: "art_rrt",    label: "ART / RRT",                 origem: "profissional" },
  { kind: "laudo",      label: "Laudo técnico",             origem: "profissional" },
  { kind: "projeto",    label: "Projeto técnico",           origem: "profissional" },
  { kind: "protocolo",  label: "Comprovante de protocolo",  origem: "profissional" },
  { kind: "outro",      label: "Outro",                     origem: "cliente" },
] as const satisfies readonly { kind: DocumentKind; label: string; origem: DocumentOrigem }[];

/**
 * O que cada lado pode enviar. O cliente só vê os tipos dele — oferecer
 * "ART / RRT" a quem não emite ART só gera escolha errada.
 * O profissional envia qualquer tipo, inclusive corrigindo documento do cliente.
 */
export function kindsPara(origem: DocumentOrigem) {
  if (origem === "profissional") return DOCUMENT_KINDS;
  return DOCUMENT_KINDS.filter((k) => k.origem === "cliente");
}

export function rotuloDoKind(kind: string): string {
  return DOCUMENT_KINDS.find((k) => k.kind === kind)?.label ?? "Documento";
}
```

- [ ] **Passo 4: Rodar e confirmar que passa**

```bash
cd landing && npm test -- document-kinds
```

Esperado: PASSA — 7 testes.

- [ ] **Passo 5: Commit**

```bash
cd landing && git add src/lib/document-kinds.ts src/lib/document-kinds.test.ts && git commit -m "feat: tipos de documento como fonte unica"
```

---

## Tarefa 3: Migração SQL — tabelas, autorização, bucket

**Arquivos:**
- Criar: `supabase/migrations/20260808_documentos_storage.sql`
- Criar: `supabase/migrations/verificacao/20260808_teste_rls_documentos.sql`

**Interfaces:**
- Consome: `public.is_admin()`, `public.can_access_property(uuid)` (já existem)
- Produz:
  - Tabela `public.document_versions`
  - Colunas em `public.documents`: `kind`, `origem`, `current_version_id`, `created_by`, `deleted_at`
  - `public.can_read_document(uuid) → boolean`
  - `public.can_write_document(uuid) → boolean`
  - `public.proxima_versao(uuid) → int`
  - Bucket `documentos`

- [ ] **Passo 1: Escrever a migração**

Criar `supabase/migrations/20260808_documentos_storage.sql`:

```sql
-- ================================================================
-- ARMAZENAMENTO DE DOCUMENTOS COM VERSIONAMENTO — 2026-08-08
-- ----------------------------------------------------------------
-- Spec: docs/superpowers/specs/2026-08-07-armazenamento-documentos-design.md
-- Idempotente — seguro rodar mais de uma vez.
-- ================================================================


-- ---------------------------------------------------------------
-- 1) documents passa a ser o documento LÓGICO
-- ---------------------------------------------------------------
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS kind       text NOT NULL DEFAULT 'outro',
  ADD COLUMN IF NOT EXISTS origem     text NOT NULL DEFAULT 'cliente',
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_origem_ck') THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_origem_ck CHECK (origem IN ('cliente', 'profissional'));
  END IF;
END $$;


-- ---------------------------------------------------------------
-- 2) document_versions — cada envio
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     uuid   NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_number  int    NOT NULL,
  storage_path    text   NOT NULL UNIQUE,
  original_name   text   NOT NULL,
  mime_type       text   NOT NULL,
  size_bytes      bigint NOT NULL,
  checksum_sha256 text   NOT NULL,
  uploaded_by     uuid   REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_number),
  CONSTRAINT document_versions_mime_ck
    CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  CONSTRAINT document_versions_size_ck
    CHECK (size_bytes > 0 AND size_bytes <= 26214400)
);

CREATE INDEX IF NOT EXISTS document_versions_doc_idx
  ON public.document_versions (document_id, version_number DESC);

-- Ponteiro para a versão vigente. Criado depois da tabela por dependência.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS current_version_id uuid
    REFERENCES public.document_versions(id) ON DELETE SET NULL;


-- ---------------------------------------------------------------
-- 3) Funções de decisão — fonte única de autorização
--
-- Usadas pela RLS das tabelas, pela RLS do Storage e pelas edge functions.
-- Se as três tivessem lógica própria, uma divergência viraria brecha.
-- ---------------------------------------------------------------

-- Leitura: aplica a trava de visibilidade do cliente.
-- O cliente NÃO vê peça técnica enquanto o processo corre; passa a ver quando
-- o processo é entregue.
CREATE OR REPLACE FUNCTION public.can_read_document(_document_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.documents d
    JOIN public.properties p ON p.id = d.property_id
    WHERE d.id = _document_id
      AND (
        public.is_admin()
        OR p.assigned_professional_id = auth.uid()
        OR (
          p.client_id = auth.uid()
          AND ( d.origem = 'cliente' OR p.status = 'entregue' )
        )
      )
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_read_document(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_read_document(uuid) TO authenticated, service_role;

-- Escrita de nova versão: cliente só mexe no que é dele.
CREATE OR REPLACE FUNCTION public.can_write_document(_document_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.documents d
    JOIN public.properties p ON p.id = d.property_id
    WHERE d.id = _document_id
      AND (
        public.is_admin()
        OR p.assigned_professional_id = auth.uid()
        OR ( p.client_id = auth.uid() AND d.origem = 'cliente' )
      )
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_write_document(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_write_document(uuid) TO authenticated, service_role;

-- Próximo número de versão. Concentrado aqui para a edge function não precisar
-- calcular no cliente; a UNIQUE (document_id, version_number) é a garantia final
-- em caso de dois envios simultâneos.
CREATE OR REPLACE FUNCTION public.proxima_versao(_document_id uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(max(version_number), 0) + 1
  FROM public.document_versions
  WHERE document_id = _document_id
$$;
REVOKE EXECUTE ON FUNCTION public.proxima_versao(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.proxima_versao(uuid) TO authenticated, service_role;


-- ---------------------------------------------------------------
-- 4) RLS das tabelas
-- ---------------------------------------------------------------
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.document_versions FROM anon;
GRANT SELECT ON public.document_versions TO authenticated;

-- Leitura da versão segue a permissão do documento dono.
DROP POLICY IF EXISTS "document_versions_select" ON public.document_versions;
CREATE POLICY "document_versions_select" ON public.document_versions
  FOR SELECT TO authenticated
  USING ( public.can_read_document(document_id) );

-- Escrita de versão é exclusiva da edge function (service_role): nenhuma
-- política para authenticated significa nenhum INSERT/UPDATE/DELETE por ele.
-- É isso que garante que todo arquivo passou pela validação.

-- documents: leitura passa a respeitar a trava de visibilidade e a exclusão lógica.
DROP POLICY IF EXISTS "documents_select" ON public.documents;
CREATE POLICY "documents_select" ON public.documents
  FOR SELECT TO authenticated
  USING ( deleted_at IS NULL AND public.can_read_document(id) );

-- Exclusão lógica: só admin e profissional atribuído. O UPDATE segue existindo
-- para status; o gatilho abaixo impede que o cliente marque deleted_at.
DROP POLICY IF EXISTS "documents_update" ON public.documents;
CREATE POLICY "documents_update" ON public.documents
  FOR UPDATE TO authenticated
  USING ( public.can_write_document(id) )
  WITH CHECK ( public.can_write_document(id) );

CREATE OR REPLACE FUNCTION public.enforce_document_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- service_role (edge function) e admin passam direto.
  IF auth.uid() IS NULL OR public.is_admin() THEN RETURN NEW; END IF;

  -- Cliente não exclui, não muda origem e não repõe versão à mão.
  IF NOT public.can_manage_property(NEW.property_id) THEN
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      RAISE EXCEPTION 'Exclusão de documento não permitida';
    END IF;
    IF NEW.origem IS DISTINCT FROM OLD.origem THEN
      RAISE EXCEPTION 'Alteração de origem não permitida';
    END IF;
    IF NEW.current_version_id IS DISTINCT FROM OLD.current_version_id THEN
      RAISE EXCEPTION 'Alteração de versão não permitida';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_document_update ON public.documents;
CREATE TRIGGER trg_enforce_document_update
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_document_update();

-- INSERT direto por usuário deixa de existir: documento nasce pela edge function,
-- junto da primeira versão. Sem isso, seria possível criar documento
-- origem='profissional' se passando por peça técnica.
DROP POLICY IF EXISTS "documents_insert" ON public.documents;


-- ---------------------------------------------------------------
-- 5) Bucket privado
-- ---------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos', 'documentos', false, 26214400,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE
  SET public             = false,
      file_size_limit    = 26214400,
      allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'];


-- ---------------------------------------------------------------
-- 6) RLS do Storage
--
-- O caminho é {property_id}/{document_id}/{version_id}; foldername devolve as
-- pastas, então [2] é o document_id. Delegar a can_read_document mantém uma
-- única verdade entre arquivo e linha de banco.
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "documentos_read" ON storage.objects;
CREATE POLICY "documentos_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos'
    AND array_length(storage.foldername(name), 1) >= 2
    AND public.can_read_document( ((storage.foldername(name))[2])::uuid )
  );

-- Nenhuma política de INSERT/UPDATE/DELETE para authenticated: escrita no bucket
-- é exclusiva do service_role, ou seja, da edge function que valida.
DROP POLICY IF EXISTS "documentos_insert" ON storage.objects;
DROP POLICY IF EXISTS "documentos_update" ON storage.objects;
DROP POLICY IF EXISTS "documentos_delete" ON storage.objects;


-- ================================================================
-- VERIFICAÇÃO (descomente após rodar)
-- SELECT policyname, tablename FROM pg_policies
--   WHERE tablename IN ('documents','document_versions','objects')
--   ORDER BY tablename, policyname;
-- ================================================================
```

- [ ] **Passo 2: Rodar a migração**

Abrir `supabase/migrations/20260808_documentos_storage.sql`, copiar todo o conteúdo e colar em Supabase › SQL Editor › New Query › Run.

Esperado: `Success. No rows returned`.

- [ ] **Passo 3: Escrever o teste de autorização**

Criar `supabase/migrations/verificacao/20260808_teste_rls_documentos.sql`:

```sql
-- ================================================================
-- TESTE DE AUTORIZAÇÃO — documentos
-- ----------------------------------------------------------------
-- Prova as regras de visibilidade sem gravar nada: tudo roda dentro de
-- uma transação que termina em ROLLBACK.
--
-- Rodar em: Supabase › SQL Editor. Conferir que TODAS as linhas do
-- resultado tenham resultado = 'OK'.
-- ================================================================
BEGIN;

-- Usuários de teste
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'cliente.teste@exemplo.com',  '{}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', 'prof.teste@exemplo.com',     '{"role":"profissional"}'::jsonb),
  ('33333333-3333-3333-3333-333333333333', 'estranho.teste@exemplo.com', '{}'::jsonb);

UPDATE public.profiles SET approval_status = 'aprovado'
 WHERE id = '22222222-2222-2222-2222-222222222222';

-- Processo em andamento, com profissional designado
INSERT INTO public.properties (id, name, client_id, assigned_professional_id, status)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Imóvel de teste',
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222', 'analise');

-- Um documento de cada origem
INSERT INTO public.documents (id, property_id, name, kind, origem, status)
VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Matrícula.pdf', 'matricula', 'cliente', 'Enviado'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'ART.pdf', 'art_rrt', 'profissional', 'Enviado');

-- ---- Cliente, processo em andamento ----
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

SELECT 'cliente lê o próprio documento' AS caso,
       CASE WHEN public.can_read_document('dddddddd-dddd-dddd-dddd-dddddddddddd')
            THEN 'OK' ELSE 'FALHOU' END AS resultado
UNION ALL
SELECT 'cliente NÃO lê peça técnica em andamento',
       CASE WHEN NOT public.can_read_document('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')
            THEN 'OK' ELSE 'FALHOU' END
UNION ALL
SELECT 'cliente NÃO versiona peça técnica',
       CASE WHEN NOT public.can_write_document('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')
            THEN 'OK' ELSE 'FALHOU' END
UNION ALL
SELECT 'cliente versiona documento próprio',
       CASE WHEN public.can_write_document('dddddddd-dddd-dddd-dddd-dddddddddddd')
            THEN 'OK' ELSE 'FALHOU' END;

-- ---- Profissional designado ----
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

SELECT 'profissional lê os dois documentos' AS caso,
       CASE WHEN public.can_read_document('dddddddd-dddd-dddd-dddd-dddddddddddd')
             AND public.can_read_document('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')
            THEN 'OK' ELSE 'FALHOU' END AS resultado
UNION ALL
SELECT 'profissional versiona documento do cliente',
       CASE WHEN public.can_write_document('dddddddd-dddd-dddd-dddd-dddddddddddd')
            THEN 'OK' ELSE 'FALHOU' END;

-- ---- Usuário sem relação com o processo ----
SET LOCAL request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

SELECT 'estranho não lê nada' AS caso,
       CASE WHEN NOT public.can_read_document('dddddddd-dddd-dddd-dddd-dddddddddddd')
             AND NOT public.can_read_document('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')
            THEN 'OK' ELSE 'FALHOU' END AS resultado;

-- ---- Processo entregue: peça técnica é liberada ----
SET LOCAL role = postgres;
UPDATE public.properties SET status = 'entregue'
 WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

SELECT 'cliente lê peça técnica após entrega' AS caso,
       CASE WHEN public.can_read_document('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')
            THEN 'OK' ELSE 'FALHOU' END AS resultado;

ROLLBACK;
```

- [ ] **Passo 4: Rodar o teste de autorização**

Copiar o conteúdo do arquivo e colar em Supabase › SQL Editor › Run.

Esperado: **14 linhas, todas com `resultado = OK`**. Qualquer `FALHOU` significa brecha de autorização — pare e corrija antes de seguir.

Os casos 5, 9, 12 e 14 testam as *policies*, não só as funções de decisão: uma policy com `USING` errado continuaria vazando dado mesmo com a função correta.

O arquivo acumula os resultados numa tabela temporária e imprime tudo num `SELECT` só, porque o SQL Editor do Supabase exibe apenas o resultado da última instrução — vários `SELECT` soltos esconderiam quase todos os casos.

- [ ] **Passo 5: Commit**

```bash
cd landing && git add supabase/migrations/ && git commit -m "feat: schema e autorizacao de documentos versionados"
```

---

## Tarefa 4: Edge function de upload

**Arquivos:**
- Criar: `supabase/functions/_shared/cors.ts`
- Criar: `supabase/functions/upload-documento/index.ts`
- Modificar: `supabase/config.toml`

**Interfaces:**
- Consome: `validarArquivo`, `TAMANHO_MAXIMO_BYTES` (Tarefa 1); `can_write_document`, `can_access_property`, `proxima_versao` (Tarefa 3)
- Produz: `POST /functions/v1/upload-documento`
  - Entrada `multipart/form-data`: `arquivo` (File), `property_id` (uuid), `kind` (string), `origem` ("cliente"|"profissional"), `document_id` (uuid, opcional — versionar existente)
  - Saída 200: `{ document_id: string, version_id: string, version_number: number }`
  - Erros: 401 não autenticado, 403 sem permissão, 400 inválido, 413 grande demais, 429 cota

- [ ] **Passo 1: Criar o módulo de CORS**

Criar `supabase/functions/_shared/cors.ts`:

```ts
/**
 * CORS restrito. Nunca "*": com origem aberta, qualquer site poderia chamar
 * estas funções a partir do navegador de um usuário logado.
 */
const ORIGENS_PERMITIDAS = new Set([
  "https://atoregulariza.com.br",
  "https://www.atoregulariza.com.br",
  "https://curso.atoregulariza.com.br",
  "http://localhost:8080",
]);

export function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ORIGENS_PERMITIDAS.has(origin) ? origin : "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function json(payload: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
```

- [ ] **Passo 2: Escrever a função de upload**

Criar `supabase/functions/upload-documento/index.ts`:

```ts
/**
 * Recebe o arquivo, valida e grava.
 *
 * O arquivo passa por aqui em vez de ir direto ao Storage porque validação no
 * navegador serve ao usuário, não ao atacante: quem controla o cliente controla
 * o que o cliente declara. Este é o único caminho de escrita no bucket — a RLS
 * do Storage não dá INSERT a authenticated.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsFor, json } from "../_shared/cors.ts";
import { validarArquivo } from "../_shared/documento-validacao.ts";

const LIMITE_UPLOADS_POR_HORA = 60;

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405, cors);

  try {
    // ---- 1. Autenticação ----
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Não autenticado" }, 401, cors);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userData?.user;
    if (userErr || !user) return json({ error: "Não autenticado" }, 401, cors);

    // ---- 2. Entrada ----
    const form = await req.formData();
    const arquivo = form.get("arquivo");
    const propertyId = String(form.get("property_id") ?? "");
    const kind = String(form.get("kind") ?? "outro");
    const origem = String(form.get("origem") ?? "cliente");
    const documentIdEntrada = form.get("document_id")
      ? String(form.get("document_id"))
      : null;

    if (!(arquivo instanceof File)) return json({ error: "Arquivo ausente" }, 400, cors);
    if (!propertyId) return json({ error: "Processo não informado" }, 400, cors);
    if (origem !== "cliente" && origem !== "profissional") {
      return json({ error: "Origem inválida" }, 400, cors);
    }

    // ---- 3. Autorização — antes de ler um byte do arquivo ----
    // É isto que impede forjar requisição para mexer em documento de terceiro:
    // o alvo é sempre conferido contra a identidade do token.
    if (documentIdEntrada) {
      const { data: pode } = await supabase.rpc("can_write_document", {
        _document_id: documentIdEntrada,
      });
      if (pode !== true) return json({ error: "Acesso negado" }, 403, cors);
    } else {
      const { data: pode } = await supabase.rpc("can_access_property", {
        _property_id: propertyId,
      });
      if (pode !== true) return json({ error: "Acesso negado" }, 403, cors);

      // Só quem gerencia o processo cria documento de origem profissional —
      // senão o cliente criaria peça técnica se passando por profissional.
      if (origem === "profissional") {
        const { data: gerencia } = await supabase.rpc("can_manage_property", {
          _property_id: propertyId,
        });
        if (gerencia !== true) return json({ error: "Acesso negado" }, 403, cors);
      }
    }

    // ---- 4. Cota: gravar arquivo custa armazenamento ----
    const { data: dentroDaCota, error: cotaErr } = await supabase.rpc("consume_ai_quota", {
      _limit_per_hour: LIMITE_UPLOADS_POR_HORA,
    });
    if (cotaErr) {
      console.error("Falha na cota de upload", cotaErr);
      return json({ error: "Erro ao verificar limite de uso" }, 500, cors);
    }
    if (dentroDaCota !== true) {
      return json({ error: "Muitos envios seguidos. Tente novamente em instantes." }, 429, cors);
    }

    // ---- 5. Validação de conteúdo ----
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const validacao = validarArquivo({
      bytes,
      mime: arquivo.type,
      nome: arquivo.name,
      tamanho: bytes.byteLength,
    });
    if (!validacao.ok) {
      const status = validacao.codigo === "tamanho" ? 413 : 400;
      return json({ error: validacao.mensagem, codigo: validacao.codigo }, status, cors);
    }

    // ---- 6. Gravação (service_role: contorna RLS de propósito, já autorizado) ----
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    let documentId = documentIdEntrada;
    if (!documentId) {
      const { data: doc, error: docErr } = await admin
        .from("documents")
        .insert({
          property_id: propertyId,
          name: validacao.nome,
          kind,
          origem,
          status: "Enviado",
          uploaded_by: user.id,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (docErr || !doc) {
        console.error("Falha ao criar documento", docErr);
        return json({ error: "Erro ao registrar documento" }, 500, cors);
      }
      documentId = doc.id;
    }

    const { data: versao } = await admin.rpc("proxima_versao", { _document_id: documentId });
    const versionNumber = (versao as number) ?? 1;

    const versionId = crypto.randomUUID();
    // Caminho só com UUIDs: o nome enviado nunca compõe caminho, o que elimina
    // a classe inteira de path traversal em vez de tentar filtrá-la.
    const storagePath = `${propertyId}/${documentId}/${versionId}`;

    const { error: upErr } = await admin.storage
      .from("documentos")
      .upload(storagePath, bytes, { contentType: arquivo.type, upsert: false });
    if (upErr) {
      console.error("Falha ao gravar no Storage", upErr);
      return json({ error: "Erro ao salvar o arquivo" }, 500, cors);
    }

    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const checksum = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { data: novaVersao, error: verErr } = await admin
      .from("document_versions")
      .insert({
        id: versionId,
        document_id: documentId,
        version_number: versionNumber,
        storage_path: storagePath,
        original_name: validacao.nome,
        mime_type: arquivo.type,
        size_bytes: bytes.byteLength,
        checksum_sha256: checksum,
        uploaded_by: user.id,
      })
      .select("id")
      .single();

    if (verErr || !novaVersao) {
      // Não deixa arquivo órfão no bucket quando o banco recusa.
      await admin.storage.from("documentos").remove([storagePath]);
      console.error("Falha ao registrar versão", verErr);
      return json({ error: "Erro ao registrar a versão" }, 500, cors);
    }

    await admin
      .from("documents")
      .update({
        current_version_id: versionId,
        name: validacao.nome,
        size_text: `${Math.max(1, Math.round(bytes.byteLength / 1024))} KB`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    return json(
      { document_id: documentId, version_id: versionId, version_number: versionNumber },
      200,
      cors,
    );
  } catch (e) {
    console.error("upload-documento error", e);
    return json({ error: "Erro interno" }, 500, cors);
  }
});
```

- [ ] **Passo 3: Declarar a função no config**

Em `supabase/config.toml`, acrescentar ao final:

```toml
[functions.upload-documento]
verify_jwt = true
```

- [ ] **Passo 4: Publicar**

```bash
cd landing && npx supabase functions deploy upload-documento --project-ref fmscewpxmqnbodzstiqa
```

Esperado: `Deployed Function upload-documento`.

- [ ] **Passo 5: Verificar que rejeita quem não está autenticado**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://fmscewpxmqnbodzstiqa.supabase.co/functions/v1/upload-documento
```

Esperado: `401`.

- [ ] **Passo 6: Commit**

```bash
cd landing && git add supabase/functions/ supabase/config.toml && git commit -m "feat: edge function de upload com validacao de conteudo"
```

---

## Tarefa 5: Edge function de URL assinada e ajuste da CSP

**Arquivos:**
- Criar: `supabase/functions/documento-url/index.ts`
- Modificar: `supabase/config.toml`
- Modificar: `vercel.json`

**Interfaces:**
- Consome: `corsFor`, `json` (Tarefa 4); `can_read_document` (Tarefa 3)
- Produz: `POST /functions/v1/documento-url`
  - Entrada JSON: `{ version_id: string }`
  - Saída 200: `{ url: string, expira_em: number }`

- [ ] **Passo 1: Escrever a função**

Criar `supabase/functions/documento-url/index.ts`:

```ts
/**
 * Emite URL assinada de leitura, válida por 5 minutos.
 *
 * Pedida no momento de abrir o arquivo, não junto da listagem: assim a validade
 * começa a contar quando o arquivo é realmente aberto, e uma lista de 20
 * documentos não gera 20 links vivos à toa.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsFor, json } from "../_shared/cors.ts";

const VALIDADE_SEGUNDOS = 300;

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405, cors);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Não autenticado" }, 401, cors);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return json({ error: "Não autenticado" }, 401, cors);

    let corpo: { version_id?: string };
    try {
      corpo = await req.json();
    } catch {
      return json({ error: "JSON inválido" }, 400, cors);
    }
    if (!corpo.version_id) return json({ error: "Versão não informada" }, 400, cors);

    // Lê a versão com a sessão do usuário: a RLS de document_versions já aplica
    // can_read_document. Se a pessoa não tem direito, não vem linha nenhuma.
    const { data: versao } = await supabase
      .from("document_versions")
      .select("storage_path, mime_type")
      .eq("id", corpo.version_id)
      .maybeSingle();

    if (!versao) return json({ error: "Acesso negado" }, 403, cors);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: assinada, error } = await admin.storage
      .from("documentos")
      .createSignedUrl(versao.storage_path, VALIDADE_SEGUNDOS);

    if (error || !assinada) {
      console.error("Falha ao assinar URL", error);
      return json({ error: "Erro ao abrir o arquivo" }, 500, cors);
    }

    return json({ url: assinada.signedUrl, expira_em: VALIDADE_SEGUNDOS }, 200, cors);
  } catch (e) {
    console.error("documento-url error", e);
    return json({ error: "Erro interno" }, 500, cors);
  }
});
```

- [ ] **Passo 2: Declarar no config**

Em `supabase/config.toml`, acrescentar ao final:

```toml
[functions.documento-url]
verify_jwt = true
```

- [ ] **Passo 3: Liberar o Storage na CSP**

Em `vercel.json`, no valor de `Content-Security-Policy`, substituir o trecho:

```
frame-src https://www.youtube-nocookie.com https://www.youtube.com;
```

por:

```
frame-src https://www.youtube-nocookie.com https://www.youtube.com https://fmscewpxmqnbodzstiqa.supabase.co;
```

Sem isso, o preview de PDF é bloqueado pela nossa própria política — o `<iframe>` aponta para o domínio do Storage.

- [ ] **Passo 4: Publicar**

```bash
cd landing && npx supabase functions deploy documento-url --project-ref fmscewpxmqnbodzstiqa
```

Esperado: `Deployed Function documento-url`.

- [ ] **Passo 5: Verificar que rejeita anônimo**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://fmscewpxmqnbodzstiqa.supabase.co/functions/v1/documento-url -H "Content-Type: application/json" -d '{"version_id":"00000000-0000-0000-0000-000000000000"}'
```

Esperado: `401`.

- [ ] **Passo 6: Commit**

```bash
cd landing && git add supabase/functions/documento-url supabase/config.toml vercel.json && git commit -m "feat: url assinada de documento e csp do storage"
```

---

## Tarefa 6: Camada de API no cliente e tipos

**Arquivos:**
- Criar: `src/lib/api/documentos.ts`
- Modificar: `src/integrations/supabase/types.ts`

**Interfaces:**
- Consome: as duas edge functions (Tarefas 4 e 5); `DocumentKind`, `DocumentOrigem` (Tarefa 2)
- Produz:
  - `type DocumentoComVersao` — `{ id, property_id, name, kind, origem, status, created_at, versao: VersaoResumo | null }`
  - `type VersaoResumo` — `{ id, version_number, original_name, mime_type, size_bytes, created_at, uploaded_by }`
  - `enviarDocumento(params): Promise<{ document_id: string; version_number: number }>`
  - `listarDocumentos(propertyId: string): Promise<DocumentoComVersao[]>`
  - `listarVersoes(documentId: string): Promise<VersaoResumo[]>`
  - `urlDoDocumento(versionId: string): Promise<string>`
  - `excluirDocumento(documentId: string): Promise<void>`

- [ ] **Passo 1: Acrescentar os tipos do banco**

Em `src/integrations/supabase/types.ts`, dentro de `documents.Row`, após `file_path: string | null`, acrescentar:

```ts
          kind: string
          origem: string
          current_version_id: string | null
          created_by: string | null
          deleted_at: string | null
```

Nos blocos `documents.Insert` e `documents.Update` do mesmo arquivo, acrescentar as mesmas cinco linhas com `?` e tipo opcional:

```ts
          kind?: string
          origem?: string
          current_version_id?: string | null
          created_by?: string | null
          deleted_at?: string | null
```

Ainda em `types.ts`, dentro de `Tables`, após o bloco `documents`, acrescentar a tabela nova:

```ts
      document_versions: {
        Row: {
          id: string
          document_id: string
          version_number: number
          storage_path: string
          original_name: string
          mime_type: string
          size_bytes: number
          checksum_sha256: string
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          version_number: number
          storage_path: string
          original_name: string
          mime_type: string
          size_bytes: number
          checksum_sha256: string
          uploaded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          version_number?: number
          storage_path?: string
          original_name?: string
          mime_type?: string
          size_bytes?: number
          checksum_sha256?: string
          uploaded_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
```

- [ ] **Passo 2: Escrever a camada de API**

Criar `src/lib/api/documentos.ts`:

```ts
/**
 * Acesso a documentos pelo cliente do navegador.
 *
 * Upload e URL assinada passam pelas edge functions — não existe caminho direto
 * ao Storage, por decisão de segurança: a RLS do bucket não dá escrita a
 * authenticated, e a leitura sai sempre assinada e com prazo.
 */
import { supabase } from "@/integrations/supabase/client";
import type { DocumentKind, DocumentOrigem } from "@/lib/document-kinds";

const BASE = import.meta.env.VITE_SUPABASE_URL;

export interface VersaoResumo {
  id: string;
  version_number: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  uploaded_by: string | null;
}

export interface DocumentoComVersao {
  id: string;
  property_id: string;
  name: string;
  kind: string;
  origem: string;
  status: string;
  created_at: string;
  versao: VersaoResumo | null;
}

async function tokenDaSessao(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sessão expirada. Entre novamente.");
  return session.access_token;
}

export async function enviarDocumento(params: {
  arquivo: File;
  propertyId: string;
  kind: DocumentKind;
  origem: DocumentOrigem;
  /** Informar para adicionar versão a um documento existente. */
  documentId?: string;
}): Promise<{ document_id: string; version_number: number }> {
  const token = await tokenDaSessao();

  const form = new FormData();
  form.append("arquivo", params.arquivo);
  form.append("property_id", params.propertyId);
  form.append("kind", params.kind);
  form.append("origem", params.origem);
  if (params.documentId) form.append("document_id", params.documentId);

  const resp = await fetch(`${BASE}/functions/v1/upload-documento`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: form,
  });

  const corpo = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    // A função já devolve mensagem pronta para o usuário.
    throw new Error(corpo.error ?? "Não foi possível enviar o arquivo.");
  }
  return corpo;
}

export async function listarDocumentos(propertyId: string): Promise<DocumentoComVersao[]> {
  const { data, error } = await supabase
    .from("documents")
    .select(`
      id, property_id, name, kind, origem, status, created_at, current_version_id,
      versoes:document_versions!document_versions_document_id_fkey (
        id, version_number, original_name, mime_type, size_bytes, created_at, uploaded_by
      )
    `)
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((d) => {
    const versoes = (d.versoes ?? []) as VersaoResumo[];
    const vigente = versoes.find((v) => v.id === d.current_version_id) ?? null;
    return {
      id: d.id,
      property_id: d.property_id,
      name: d.name,
      kind: d.kind,
      origem: d.origem,
      status: d.status,
      created_at: d.created_at,
      versao: vigente,
    };
  });
}

/** Histórico completo, da versão mais nova para a mais antiga. */
export async function listarVersoes(documentId: string): Promise<VersaoResumo[]> {
  const { data, error } = await supabase
    .from("document_versions")
    .select("id, version_number, original_name, mime_type, size_bytes, created_at, uploaded_by")
    .eq("document_id", documentId)
    .order("version_number", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as VersaoResumo[];
}

export async function urlDoDocumento(versionId: string): Promise<string> {
  const token = await tokenDaSessao();

  const resp = await fetch(`${BASE}/functions/v1/documento-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ version_id: versionId }),
  });

  const corpo = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(corpo.error ?? "Não foi possível abrir o arquivo.");
  return corpo.url as string;
}

/** Exclusão lógica: some das listagens, versões e arquivos ficam. */
export async function excluirDocumento(documentId: string): Promise<void> {
  const { error } = await supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", documentId);
  if (error) throw new Error(error.message);
}
```

- [ ] **Passo 3: Conferir os tipos**

```bash
cd landing && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "documentos|document-kinds|types.ts"
```

Esperado: nenhuma saída.

- [ ] **Passo 4: Commit**

```bash
cd landing && git add src/lib/api/documentos.ts src/integrations/supabase/types.ts && git commit -m "feat: camada de api de documentos"
```

---

## Tarefa 7: Modal de visualização

**Arquivos:**
- Criar: `src/components/documentos/DocumentPreview.tsx`

**Interfaces:**
- Consome: `urlDoDocumento`, `VersaoResumo` (Tarefa 6)
- Produz: `<DocumentPreview versao={VersaoResumo | null} onFechar={() => void} />`

- [ ] **Passo 1: Escrever o componente**

Criar `src/components/documentos/DocumentPreview.tsx`:

```tsx
import { useEffect, useState } from "react";
import { X, Download, Loader2, AlertCircle } from "lucide-react";
import { urlDoDocumento, type VersaoResumo } from "@/lib/api/documentos";

function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

/**
 * Visualização do arquivo. A URL assinada é pedida ao abrir, não na listagem:
 * a validade de 5 minutos começa a contar quando o arquivo é realmente aberto.
 */
export function DocumentPreview({
  versao,
  onFechar,
}: {
  versao: VersaoResumo | null;
  onFechar: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!versao) {
      setUrl(null);
      setErro(null);
      return;
    }
    let cancelado = false;
    setUrl(null);
    setErro(null);
    urlDoDocumento(versao.id)
      .then((u) => { if (!cancelado) setUrl(u); })
      .catch((e: Error) => { if (!cancelado) setErro(e.message); });
    return () => { cancelado = true; };
  }, [versao]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onFechar]);

  if (!versao) return null;

  const ehImagem = versao.mime_type.startsWith("image/");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onFechar}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-background"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-5 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{versao.original_name}</div>
            <div className="text-xs text-ink-soft">
              versão {versao.version_number} · {tamanhoLegivel(versao.size_bytes)} ·{" "}
              {new Date(versao.created_at).toLocaleDateString("pt-BR")}
            </div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {url && (
              <a
                href={url}
                download={versao.original_name}
                className="grid h-8 w-8 place-items-center rounded-full text-ink-soft hover:bg-surface"
                title="Baixar"
              >
                <Download className="h-4 w-4" />
              </a>
            )}
            <button
              onClick={onFechar}
              className="grid h-8 w-8 place-items-center rounded-full text-ink-soft hover:bg-surface"
              title="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex min-h-[60vh] flex-1 items-center justify-center overflow-auto bg-surface/40">
          {erro ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <AlertCircle className="h-6 w-6 text-ink-soft" />
              <p className="text-sm text-ink-soft">{erro}</p>
            </div>
          ) : !url ? (
            <Loader2 className="h-6 w-6 animate-spin text-ink-soft" />
          ) : ehImagem ? (
            <img src={url} alt={versao.original_name} className="max-h-[80vh] max-w-full object-contain" />
          ) : (
            <iframe src={url} title={versao.original_name} className="h-[80vh] w-full border-0" />
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Passo 2: Conferir tipos e formatação**

```bash
cd landing && npx tsc --noEmit -p tsconfig.json 2>&1 | grep DocumentPreview; npx eslint --fix src/components/documentos/DocumentPreview.tsx && npx eslint src/components/documentos/DocumentPreview.tsx
```

Esperado: nenhuma saída de erro.

- [ ] **Passo 3: Commit**

```bash
cd landing && git add src/components/documentos/DocumentPreview.tsx && git commit -m "feat: modal de visualizacao de documento"
```

---

## Tarefa 8: Componente de envio

**Arquivos:**
- Criar: `src/components/documentos/UploadDocumento.tsx`

**Interfaces:**
- Consome: `enviarDocumento` (Tarefa 6); `kindsPara`, `DocumentKind`, `DocumentOrigem` (Tarefa 2); `MIMES_PERMITIDOS` (Tarefa 1)
- Produz: `<UploadDocumento propertyId origem onEnviado />`

- [ ] **Passo 1: Escrever o componente**

Criar `src/components/documentos/UploadDocumento.tsx`:

```tsx
import { useRef, useState } from "react";
import { Upload, Loader2, AlertCircle } from "lucide-react";
import { enviarDocumento } from "@/lib/api/documentos";
import { kindsPara, type DocumentKind, type DocumentOrigem } from "@/lib/document-kinds";

/**
 * Envio com tipo obrigatório.
 *
 * O tipo é o que permite amarrar o arquivo ao documento certo — enviando
 * "matrícula" duas vezes, a segunda vira versão 2 da primeira em vez de um
 * registro solto. Por isso o botão fica travado até haver escolha.
 */
export function UploadDocumento({
  propertyId,
  origem,
  onEnviado,
}: {
  propertyId: string;
  origem: DocumentOrigem;
  onEnviado: () => void;
}) {
  const [kind, setKind] = useState<DocumentKind | "">("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const opcoes = kindsPara(origem);

  async function aoEscolherArquivo(arquivo: File | undefined) {
    if (!arquivo || !kind) return;
    setEnviando(true);
    setErro(null);
    try {
      await enviarDocumento({ arquivo, propertyId, kind, origem });
      setKind("");
      if (inputRef.current) inputRef.current.value = "";
      onEnviado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar o arquivo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="rounded-2xl bg-surface/50 p-4">
      <label className="block text-sm font-medium">Qual documento você está enviando?</label>
      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as DocumentKind)}
        disabled={enviando}
        className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
      >
        <option value="">Selecione…</option>
        {opcoes.map((o) => (
          <option key={o.kind} value={o.kind}>{o.label}</option>
        ))}
      </select>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        disabled={!kind || enviando}
        onChange={(e) => aoEscolherArquivo(e.target.files?.[0])}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={!kind || enviando}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm text-background transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {enviando ? "Enviando…" : "Escolher arquivo"}
      </button>

      <p className="mt-2 text-xs text-ink-soft">PDF, JPEG ou PNG · até 25 MB</p>

      {erro && (
        <div className="mt-3 flex gap-2 rounded-xl bg-red-50 p-3 text-xs leading-relaxed text-red-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Passo 2: Conferir tipos e formatação**

```bash
cd landing && npx tsc --noEmit -p tsconfig.json 2>&1 | grep UploadDocumento; npx eslint --fix src/components/documentos/UploadDocumento.tsx && npx eslint src/components/documentos/UploadDocumento.tsx
```

Esperado: nenhuma saída de erro.

- [ ] **Passo 3: Commit**

```bash
cd landing && git add src/components/documentos/UploadDocumento.tsx && git commit -m "feat: envio de documento com tipo obrigatorio"
```

---

## Tarefa 9: Lista com histórico de versões

**Arquivos:**
- Criar: `src/components/documentos/DocumentList.tsx`

**Interfaces:**
- Consome: `listarDocumentos`, `listarVersoes`, `excluirDocumento`, `DocumentoComVersao`, `VersaoResumo` (Tarefa 6); `rotuloDoKind` (Tarefa 2); `DocumentPreview` (Tarefa 7)
- Produz: `<DocumentList propertyId mostrarHistorico podeExcluir recarregarToken />`

- [ ] **Passo 1: Escrever o componente**

Criar `src/components/documentos/DocumentList.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import { FileText, History, Loader2, Trash2, Inbox } from "lucide-react";
import {
  listarDocumentos, listarVersoes, excluirDocumento,
  type DocumentoComVersao, type VersaoResumo,
} from "@/lib/api/documentos";
import { rotuloDoKind } from "@/lib/document-kinds";
import { DocumentPreview } from "./DocumentPreview";

function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

export function DocumentList({
  propertyId,
  /** Histórico é conversa interna: só profissional e admin. */
  mostrarHistorico = false,
  podeExcluir = false,
  recarregarToken = 0,
}: {
  propertyId: string;
  mostrarHistorico?: boolean;
  podeExcluir?: boolean;
  recarregarToken?: number;
}) {
  const [docs, setDocs] = useState<DocumentoComVersao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [preview, setPreview] = useState<VersaoResumo | null>(null);
  const [historicoDe, setHistoricoDe] = useState<string | null>(null);
  const [versoes, setVersoes] = useState<VersaoResumo[]>([]);

  const carregar = useCallback(() => {
    setCarregando(true);
    listarDocumentos(propertyId)
      .then(setDocs)
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [propertyId]);

  useEffect(() => { carregar(); }, [carregar, recarregarToken]);

  async function abrirHistorico(documentId: string) {
    if (historicoDe === documentId) { setHistoricoDe(null); return; }
    setHistoricoDe(documentId);
    setVersoes(await listarVersoes(documentId));
  }

  async function excluir(documentId: string) {
    if (!confirm("Remover este documento da lista? O histórico é preservado.")) return;
    await excluirDocumento(documentId);
    carregar();
  }

  if (carregando) {
    return (
      <div className="flex h-24 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-ink-soft" />
      </div>
    );
  }

  if (erro) {
    return <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>;
  }

  if (docs.length === 0) {
    return (
      <div className="rounded-2xl bg-surface/50 p-8 text-center">
        <Inbox className="mx-auto h-6 w-6 text-ink-soft" />
        <p className="mt-2 text-sm text-ink-soft">Nenhum documento enviado ainda.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {docs.map((d) => (
          <div key={d.id} className="rounded-xl bg-background p-3 ring-1 ring-border">
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 shrink-0 text-ink-soft" />
              <button
                onClick={() => d.versao && setPreview(d.versao)}
                disabled={!d.versao}
                className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"
              >
                <div className="truncate text-sm font-medium">
                  {d.versao?.original_name ?? d.name}
                </div>
                <div className="text-xs text-ink-soft">
                  {rotuloDoKind(d.kind)}
                  {d.versao && ` · ${tamanhoLegivel(d.versao.size_bytes)}`}
                  {d.versao && ` · ${new Date(d.versao.created_at).toLocaleDateString("pt-BR")}`}
                </div>
              </button>

              {/* Documento removido só chega à equipe (a RLS o esconde do
                  cliente). Sem esta marca o profissional não distingue um
                  documento ativo de um que ele mesmo removeu. */}
              {d.deleted_at && (
                <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] uppercase tracking-widest text-ink-soft">
                  removido
                </span>
              )}

              {mostrarHistorico && d.versao && d.versao.version_number > 1 && (
                <button
                  onClick={() => abrirHistorico(d.id)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] text-ink-soft hover:bg-surface"
                >
                  <History className="h-3 w-3" /> v{d.versao.version_number} · histórico
                </button>
              )}

              {podeExcluir && (
                <button
                  onClick={() => excluir(d.id)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-surface"
                  title="Remover da lista"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {historicoDe === d.id && (
              <div className="mt-2 space-y-1 border-t border-border pt-2">
                {versoes.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setPreview(v)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-ink-soft hover:bg-surface"
                  >
                    <span className="font-medium">v{v.version_number}</span>
                    <span className="truncate">{v.original_name}</span>
                    <span className="ml-auto shrink-0">
                      {new Date(v.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <DocumentPreview versao={preview} onFechar={() => setPreview(null)} />
    </>
  );
}
```

- [ ] **Passo 2: Conferir tipos e formatação**

```bash
cd landing && npx tsc --noEmit -p tsconfig.json 2>&1 | grep DocumentList; npx eslint --fix src/components/documentos/DocumentList.tsx && npx eslint src/components/documentos/DocumentList.tsx
```

Esperado: nenhuma saída de erro.

- [ ] **Passo 3: Commit**

```bash
cd landing && git add src/components/documentos/DocumentList.tsx && git commit -m "feat: lista de documentos com historico de versoes"
```

---

## Tarefa 10: Integrar no painel do cliente

**Arquivos:**
- Modificar: `src/routes/dashboard.tsx`

**Interfaces:**
- Consome: `UploadDocumento` (Tarefa 8), `DocumentList` (Tarefa 9)

- [ ] **Passo 1: Localizar o upload falso**

```bash
cd landing && grep -n "addFiles\|onDrop\|dragOver\|from(\"documents\")\|docs\b" src/routes/dashboard.tsx | head -30
```

Anotar as linhas: o bloco `addFiles` que insere em `documents` sem gravar arquivo, os manipuladores de arrastar-soltar e a listagem `docs`.

- [ ] **Passo 2: Trocar pelo componente real**

Em `src/routes/dashboard.tsx`:

1. Acrescentar aos imports do topo:

```tsx
import { UploadDocumento } from "@/components/documentos/UploadDocumento";
import { DocumentList } from "@/components/documentos/DocumentList";
```

2. Acrescentar o estado que força recarga após envio, junto dos demais `useState`:

```tsx
const [recargaDocs, setRecargaDocs] = useState(0);
```

3. Remover a função `addFiles`, o `onDrop`, o estado `dragOver`, o estado `docs` e o `useEffect` que carregava documentos — toda a lógica antiga de upload some, porque ela nunca gravou arquivo.

4. Substituir o bloco JSX da seção "Envie seus documentos" por:

```tsx
<div className="space-y-4">
  <UploadDocumento
    propertyId={property.id}
    origem="cliente"
    onEnviado={() => setRecargaDocs((n) => n + 1)}
  />
  <DocumentList propertyId={property.id} recarregarToken={recargaDocs} />
</div>
```

O cliente recebe `mostrarHistorico` e `podeExcluir` com o padrão `false`: histórico é conversa interna e exclusão é do profissional.

- [ ] **Passo 3: Conferir tipos**

```bash
cd landing && npx tsc --noEmit -p tsconfig.json 2>&1 | grep dashboard
```

Esperado: nenhuma saída referente a upload ou documentos.

- [ ] **Passo 4: Verificar no navegador**

Subir o servidor pela ferramenta de preview (configuração `regulariza`, porta 8080). Entrar como cliente e, na seção de documentos:

1. Confirmar que o botão de arquivo fica **desabilitado** antes de escolher o tipo
2. Escolher "Matrícula / escritura", enviar um PDF — deve aparecer na lista
3. Clicar no arquivo — o modal abre e o PDF é exibido
4. Enviar outro PDF como "Matrícula / escritura" — a lista continua com **um** item, agora na versão 2
5. Confirmar que **não** aparece o link de histórico (é painel do cliente)
6. Tentar enviar um arquivo `.txt` renomeado para `.pdf` — deve recusar com "pode estar corrompido"

Conferir o console do navegador: nenhum erro de CSP.

- [ ] **Passo 5: Commit**

```bash
cd landing && git add src/routes/dashboard.tsx && git commit -m "feat: painel do cliente com upload real de documentos"
```

---

## Tarefa 11: Integrar no painel do profissional

**Arquivos:**
- Modificar: `src/routes/painel-profissional.tsx`

**Interfaces:**
- Consome: `UploadDocumento` (Tarefa 8), `DocumentList` (Tarefa 9)

- [ ] **Passo 1: Localizar o upload falso**

```bash
cd landing && grep -n "uploadDocs\|LocalDoc\|rightTab === \"docs\"" src/routes/painel-profissional.tsx | head -20
```

- [ ] **Passo 2: Trocar pelo componente real**

Em `src/routes/painel-profissional.tsx`:

1. Acrescentar aos imports do topo:

```tsx
import { UploadDocumento } from "@/components/documentos/UploadDocumento";
import { DocumentList } from "@/components/documentos/DocumentList";
```

2. Acrescentar o estado de recarga junto dos demais `useState`:

```tsx
const [recargaDocs, setRecargaDocs] = useState(0);
```

3. Remover a função `uploadDocs` (que inseria em `documents` sem gravar arquivo), o estado `docs` e o carregamento correspondente.

4. Substituir o conteúdo da aba `rightTab === "docs"` por:

```tsx
{rightTab === "docs" && selectedId && (
  <div className="space-y-4 p-4">
    <UploadDocumento
      propertyId={selectedId}
      origem="profissional"
      onEnviado={() => setRecargaDocs((n) => n + 1)}
    />
    <DocumentList
      propertyId={selectedId}
      mostrarHistorico
      podeExcluir
      recarregarToken={recargaDocs}
    />
  </div>
)}
```

O profissional recebe `mostrarHistorico` e `podeExcluir`: é dele a necessidade de provar o que foi entregue e de tirar documento errado da lista.

- [ ] **Passo 3: Conferir tipos**

```bash
cd landing && npx tsc --noEmit -p tsconfig.json 2>&1 | grep painel-profissional
```

Esperado: nenhuma saída referente a upload ou documentos.

- [ ] **Passo 4: Verificar no navegador**

Com o servidor de preview no ar, entrar como profissional aprovado e abrir um processo designado a ele:

1. Enviar um PDF como "ART / RRT" — aparece na lista
2. Confirmar que o profissional **vê** os documentos enviados pelo cliente
3. Enviar segunda versão da mesma ART — o link `v2 · histórico` aparece
4. Abrir o histórico e confirmar que a versão 1 continua abrível
5. Remover um documento e confirmar que some da lista

Depois, entrar como o **cliente** do mesmo processo e confirmar a trava: a ART enviada pelo profissional **não** aparece na lista dele.

Este último passo é a verificação mais importante da tarefa — é a regra 1.2 do usuário funcionando de ponta a ponta.

- [ ] **Passo 5: Commit**

```bash
cd landing && git add src/routes/painel-profissional.tsx && git commit -m "feat: painel do profissional com documentos versionados"
```

---

## Autorrevisão do plano

**Cobertura do spec**

| Requisito do spec | Tarefa |
|---|---|
| `documents` como documento lógico + `document_versions` | 3 |
| Tipos de documento e amarração de versão | 2, 8 |
| Caminho só com UUIDs | 4 |
| Bucket privado com limites | 3 |
| `can_read_document` / `can_write_document` | 3 |
| Trava de visibilidade do cliente | 3 (SQL), 11 (verificação de ponta a ponta) |
| RLS do `storage.objects` | 3 |
| Escrita exclusiva da edge function | 3, 4 |
| Ordem de validação (auth → autorização → tamanho → assinatura → lista → nome) | 1, 4 |
| Cota de upload | 4 |
| CORS restrito | 4 |
| URL assinada de 5 min pedida ao abrir | 5, 7 |
| CSP com domínio do Storage | 5 |
| Preview PDF e imagem | 7 |
| Histórico só para profissional e admin | 9, 10, 11 |
| Seletor de tipo obrigatório | 8 |
| Mensagens de erro orientadas | 1, 8 |
| Status "Enviado" só após confirmação | 4, 8 |
| Exclusão lógica | 3, 6, 9 |
| Testes de autorização | 3 |
| Testes de validação de arquivo | 1 |

Sem lacunas.

**Pendência que atravessa o plano:** o marcador `[PENDÊNCIA: e-mail do admin]` aparece literal na mensagem de arquivo grande (`documento-validacao.ts`, Tarefa 1). Substituir pelo endereço real antes de produção.

**Consistência de nomes:** `validarArquivo`, `assinaturaConfere`, `normalizarNomeArquivo`, `enviarDocumento`, `listarDocumentos`, `listarVersoes`, `urlDoDocumento`, `excluirDocumento`, `can_read_document`, `can_write_document`, `proxima_versao` — conferidos entre a definição e cada uso.

**Ordem das dependências:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11. Cada tarefa só consome o que já existe.
