# Frente 2 · Plano 2 — Painel do profissional sem `localStorage`

> **Para trabalhadores agênticos:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar tarefa a tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** Tirar do navegador os cinco conjuntos de dados que hoje guardam o trabalho do profissional, e ligar a conferência de documentos aos arquivos que existem de verdade.

**Arquitetura:** A camada de API criada no plano 1 já cobre pendências, anotações, campos de etapa e notificações. Este plano estende `etapas.ts` com o estado das etapas, cria o componente de conferência e faz a cirurgia no `painel-profissional.tsx` de uma vez só — o arquivo tem 1400 linhas e dividir a cirurgia entre tarefas faria cada uma trabalhar sobre um arquivo que a anterior já mudou.

**Stack:** React 19, TanStack Router, Supabase, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-16-trabalho-do-profissional-design.md`
**Plano anterior:** `docs/superpowers/plans/2026-08-16-frente2-p1-fundacao.md` — já concluído

## Restrições globais

- Comentários e textos em **português (PT-BR)**
- **Nenhum SQL.** O banco já tem tudo o que este plano precisa
- **Proibido** apagar ou limpar dados reais; o usuário mantém contas de teste
- `npm test` precisa continuar passando (27 testes hoje)
- **Não** rodar `npx eslint --fix` em `painel-profissional.tsx`: o repositório não aplica Prettier, o arquivo tem ~790 avisos pré-existentes e reformatar enterraria o diff. Rodar `--fix` apenas em arquivos **novos**
- Erro de banco nunca chega cru ao usuário — a camada de API já traduz
- Verificar ausência de bytes de controle nos arquivos novos:
  `grep -cP '[\x00-\x08\x0b\x0c\x0e-\x1f]' <arquivo>` deve dar 0

## O que já existe

`src/lib/api/etapas.ts` — `carregarCampos`, `salvarCampos`
`src/lib/api/pendencias.ts` — `listarPendencias`, `criarPendencia`, `resolverPendencia`, `reabrirPendencia`, `textoDaPendencia`
`src/lib/api/notas.ts` — `carregarNota`, `salvarNota`
`src/lib/api/notificacoes.ts` — `listarNotificacoes`, `contarNaoLidas`, `marcarComoLida`, `marcarTodasComoLidas`
`src/lib/api/aprovacoes.ts` — `pedirAprovacao`, `listarAprovacoesPendentes`, `decidirAprovacao`
`src/lib/api/documentos.ts` — `listarDocumentos`, `listarVersoes`, `urlDoDocumento`, `enviarDocumento`, `excluirDocumento`
`src/lib/document-kinds.ts` — `DOCUMENT_KINDS`, `kindsPara`, `rotuloDoKind`

## O que sai do `localStorage`

| Chave | Novo lar |
|---|---|
| `rz-done-stages` | `process_stages.state` — **já existia no banco**, o navegador guardava uma segunda verdade |
| `rz-stage-fields` | `process_stages.fields` |
| `rz-pendencies` | tabela `pendencies` |
| `rz-private-notes` | tabela `process_notes` |
| `rz-last-chat-view` | tabela `chat_reads` |

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/api/etapas.ts` | **estender**: estado da etapa e leitura do chat |
| `src/components/documentos/ChecklistDocumentos.tsx` | **novo**: conferência sobre os documentos reais |
| `src/routes/painel-profissional.tsx` | **modificar**: cirurgia que remove o `localStorage` |

---

## Tarefa 1: Estender `etapas.ts`

**Arquivos:**
- Modificar: `src/lib/api/etapas.ts`
- Criar: `src/lib/api/etapas.test.ts`

**Interfaces:**
- Consome: `supabase`
- Produz, além do que já existe:
  - `type EstadoEtapa = "pending" | "active" | "done"`
  - `carregarEtapas(propertyId: string): Promise<EtapaResumo[]>`
  - `type EtapaResumo = { stage_number: number; state: string; fields: Record<string, unknown> }`
  - `marcarEtapa(propertyId: string, stageNumber: number, estado: EstadoEtapa): Promise<void>`
  - `etapasConcluidas(etapas: EtapaResumo[]): number[]`
  - `progressoDasEtapas(etapas: EtapaResumo[], total?: number): number`
  - `carregarLeituraChat(propertyId: string): Promise<string | null>`
  - `marcarChatLido(propertyId: string): Promise<void>`

- [ ] **Passo 1: Escrever o teste que falha**

Criar `src/lib/api/etapas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { etapasConcluidas, progressoDasEtapas, type EtapaResumo } from "./etapas";

function etapa(n: number, state: string): EtapaResumo {
  return { stage_number: n, state, fields: {} };
}

describe("etapasConcluidas", () => {
  it("devolve só os números das etapas concluídas", () => {
    const etapas = [etapa(1, "done"), etapa(2, "active"), etapa(3, "pending"), etapa(4, "done")];
    expect(etapasConcluidas(etapas)).toEqual([1, 4]);
  });

  it("devolve lista vazia quando nada foi concluído", () => {
    expect(etapasConcluidas([etapa(1, "pending")])).toEqual([]);
  });

  it("ordena, mesmo se o banco devolver fora de ordem", () => {
    expect(etapasConcluidas([etapa(3, "done"), etapa(1, "done")])).toEqual([1, 3]);
  });
});

describe("progressoDasEtapas", () => {
  it("calcula a porcentagem sobre 5 etapas por padrão", () => {
    expect(progressoDasEtapas([etapa(1, "done"), etapa(2, "done")])).toBe(40);
  });

  it("devolve 0 sem nenhuma concluída", () => {
    expect(progressoDasEtapas([etapa(1, "pending")])).toBe(0);
  });

  it("devolve 100 com todas concluídas", () => {
    const todas = [1, 2, 3, 4, 5].map((n) => etapa(n, "done"));
    expect(progressoDasEtapas(todas)).toBe(100);
  });

  it("aceita um total diferente de 5", () => {
    expect(progressoDasEtapas([etapa(1, "done")], 4)).toBe(25);
  });

  it("não estoura 100 se vierem mais concluídas que o total", () => {
    const seis = [1, 2, 3, 4, 5, 6].map((n) => etapa(n, "done"));
    expect(progressoDasEtapas(seis)).toBe(100);
  });
});
```

- [ ] **Passo 2: Rodar e confirmar que falha**

```bash
cd landing && npm test -- etapas
```

Esperado: FALHA com `does not provide an export named 'etapasConcluidas'`.

- [ ] **Passo 3: Estender a implementação**

Acrescentar ao final de `src/lib/api/etapas.ts`:

```ts
export type EstadoEtapa = "pending" | "active" | "done";

export interface EtapaResumo {
  stage_number: number;
  state: string;
  fields: Record<string, unknown>;
}

export async function carregarEtapas(propertyId: string): Promise<EtapaResumo[]> {
  const { data, error } = await supabase
    .from("process_stages")
    .select("stage_number, state, fields")
    .eq("property_id", propertyId)
    .order("stage_number");

  if (error) throw new Error("Não foi possível carregar as etapas.");
  return (data ?? []).map((e) => ({
    stage_number: e.stage_number,
    state: e.state,
    fields: (e.fields as Record<string, unknown>) ?? {},
  }));
}

export async function marcarEtapa(
  propertyId: string,
  stageNumber: number,
  estado: EstadoEtapa,
): Promise<void> {
  const { error } = await supabase
    .from("process_stages")
    .update({
      state: estado,
      completed_at: estado === "done" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("property_id", propertyId)
    .eq("stage_number", stageNumber);

  if (error) throw new Error("Não foi possível atualizar a etapa.");
}

/**
 * Números das etapas concluídas, em ordem.
 *
 * Função pura, separada da consulta, para o cálculo de progresso ser testável
 * sem banco — e porque o painel precisa dela em três lugares.
 */
export function etapasConcluidas(etapas: EtapaResumo[]): number[] {
  return etapas
    .filter((e) => e.state === "done")
    .map((e) => e.stage_number)
    .sort((a, b) => a - b);
}

export function progressoDasEtapas(etapas: EtapaResumo[], total = 5): number {
  if (total <= 0) return 0;
  const feitas = etapasConcluidas(etapas).length;
  return Math.min(100, Math.round((feitas / total) * 100));
}

/** Momento da última leitura do chat, ou null se nunca leu. */
export async function carregarLeituraChat(propertyId: string): Promise<string | null> {
  const { data } = await supabase
    .from("chat_reads")
    .select("lido_ate")
    .eq("property_id", propertyId)
    .maybeSingle();
  // Sem leitura registrada é estado normal, não erro: tudo conta como não lido.
  return data?.lido_ate ?? null;
}

export async function marcarChatLido(propertyId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("chat_reads")
    .upsert(
      { user_id: user.id, property_id: propertyId, lido_ate: new Date().toISOString() },
      { onConflict: "user_id,property_id" },
    );

  // Falhar aqui só desalinha o contador de não lidas; não vale quebrar a tela.
  if (error) console.warn("[chat] não foi possível marcar como lido:", error.message);
}
```

- [ ] **Passo 4: Rodar e confirmar que passa**

```bash
cd landing && npm test -- etapas
```

Esperado: PASSA, 8 testes.

- [ ] **Passo 5: Commit**

```bash
cd landing && git add src/lib/api/etapas.ts src/lib/api/etapas.test.ts && git commit -m "feat(api): estado das etapas e leitura do chat"
```

---

## Tarefa 2: Componente de conferência de documentos

**Arquivos:**
- Criar: `src/components/documentos/ChecklistDocumentos.tsx`

**Interfaces:**
- Consome: `listarDocumentos`, `urlDoDocumento`, `DocumentoComVersao` de `@/lib/api/documentos`;
  `criarPendencia` de `@/lib/api/pendencias`; `kindsPara`, `rotuloDoKind` de `@/lib/document-kinds`;
  `DocumentPreview` de `./DocumentPreview`
- Produz: `<ChecklistDocumentos propertyId={string} recarregarToken={number} onMudou={() => void} />`

- [ ] **Passo 1: Escrever o componente**

Criar `src/components/documentos/ChecklistDocumentos.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import { Check, FileText, Loader2, Send, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listarDocumentos,
  type DocumentoComVersao,
  type VersaoResumo,
} from "@/lib/api/documentos";
import { criarPendencia } from "@/lib/api/pendencias";
import { kindsPara, rotuloDoKind, type DocumentKind } from "@/lib/document-kinds";
import { DocumentPreview } from "./DocumentPreview";

/**
 * Conferência dos documentos do cliente.
 *
 * Antes isto era uma lista fixa de seis itens no `localStorage`, sem qualquer
 * relação com os arquivos: marcar "IPTU atualizado" não significava que o IPTU
 * tinha chegado. Agora a lista É a dos documentos do processo, em três estados:
 *
 *   não enviado  → opaco, com botão de pedir ao cliente
 *   enviado      → abre o arquivo, e a caixa marca como conferido
 *   conferido    → `documents.status = 'Aprovado'`
 *
 * A marcação usa a coluna `status`, que já existia — nenhuma estrutura nova, e
 * impossível a conferência divergir da realidade.
 */
export function ChecklistDocumentos({
  propertyId,
  recarregarToken = 0,
  onMudou,
}: {
  propertyId: string;
  recarregarToken?: number;
  onMudou?: () => void;
}) {
  const [docs, setDocs] = useState<DocumentoComVersao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [preview, setPreview] = useState<VersaoResumo | null>(null);
  const [pedidos, setPedidos] = useState<string[]>([]);

  const carregar = useCallback(() => {
    setCarregando(true);
    listarDocumentos(propertyId)
      .then(setDocs)
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [propertyId]);

  useEffect(() => { carregar(); }, [carregar, recarregarToken]);

  // Só os tipos que o cliente envia: a conferência é do que ELE entregou.
  const tipos = kindsPara("cliente").filter((t) => t.kind !== "outro");

  async function alternarConferido(doc: DocumentoComVersao) {
    const novo = doc.status === "Aprovado" ? "Enviado" : "Aprovado";
    setOcupado(doc.id);
    setErro(null);
    const { error } = await supabase
      .from("documents")
      .update({ status: novo })
      .eq("id", doc.id);
    setOcupado(null);

    if (error) {
      setErro("Não foi possível registrar a conferência.");
      return;
    }
    setDocs((ds) => ds.map((d) => (d.id === doc.id ? { ...d, status: novo } : d)));
    onMudou?.();
  }

  async function solicitar(kind: DocumentKind) {
    setOcupado(kind);
    setErro(null);
    try {
      await criarPendencia({
        propertyId,
        descricao: `Envie: ${rotuloDoKind(kind)}`,
        kind,
      });
      setPedidos((p) => [...p, kind]);
      onMudou?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível pedir o documento.");
    } finally {
      setOcupado(null);
    }
  }

  if (carregando) {
    return (
      <div className="flex h-20 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-ink-soft" />
      </div>
    );
  }

  return (
    <>
      {erro && (
        <div role="alert" className="mb-3 flex gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      <div className="space-y-1.5">
        {tipos.map((t) => {
          const doc = docs.find((d) => d.kind === t.kind && d.origem === "cliente");
          const enviado = !!doc?.versao;
          const conferido = doc?.status === "Aprovado";
          const jaPedido = pedidos.includes(t.kind);
          const processando = ocupado === (doc?.id ?? t.kind);

          return (
            <div
              key={t.kind}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                enviado ? "bg-background ring-1 ring-border" : "bg-surface/40"
              }`}
            >
              <button
                type="button"
                onClick={() => doc && alternarConferido(doc)}
                disabled={!enviado || processando}
                aria-label={conferido ? "Desmarcar conferência" : "Marcar como conferido"}
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-md ring-1 transition-colors ${
                  conferido
                    ? "bg-foreground text-background ring-foreground"
                    : "ring-border"
                } ${enviado ? "" : "cursor-not-allowed opacity-40"}`}
              >
                {processando ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : conferido ? (
                  <Check className="h-3 w-3" />
                ) : null}
              </button>

              <button
                type="button"
                onClick={() => doc?.versao && setPreview(doc.versao)}
                disabled={!enviado}
                className={`min-w-0 flex-1 text-left ${enviado ? "" : "cursor-default"}`}
              >
                <div className={`truncate text-sm ${enviado ? "" : "text-ink-soft"}`}>
                  {t.label}
                </div>
                <div className="truncate text-xs text-ink-soft">
                  {enviado ? (
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {doc?.versao?.original_name}
                      {conferido && " · conferido"}
                    </span>
                  ) : (
                    "ainda não enviado"
                  )}
                </div>
              </button>

              {!enviado && (
                <button
                  type="button"
                  onClick={() => solicitar(t.kind)}
                  disabled={jaPedido || processando}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-ink-soft transition-colors hover:border-foreground/30 disabled:opacity-50"
                >
                  {processando ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                  {jaPedido ? "Pedido" : "Solicitar"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <DocumentPreview versao={preview} onFechar={() => setPreview(null)} />
    </>
  );
}
```

- [ ] **Passo 2: Conferir tipos, lint e bytes de controle**

```bash
cd landing && npx tsc --noEmit -p tsconfig.json 2>&1 | grep ChecklistDocumentos; grep -cP '[\x00-\x08\x0b\x0c\x0e-\x1f]' src/components/documentos/ChecklistDocumentos.tsx; npx eslint --fix src/components/documentos/ChecklistDocumentos.tsx && npx eslint src/components/documentos/ChecklistDocumentos.tsx && echo "lint ok"
```

Esperado: nenhum erro de tipo, `0` bytes de controle, `lint ok`.

- [ ] **Passo 3: Commit**

```bash
cd landing && git add src/components/documentos/ChecklistDocumentos.tsx && git commit -m "feat: conferencia sobre os documentos reais"
```

---

## Tarefa 3: Cirurgia no painel do profissional

**Arquivos:**
- Modificar: `src/routes/painel-profissional.tsx`

**Interfaces:**
- Consome: tudo das tarefas 1 e 2, mais `pendencias.ts` e `notas.ts` do plano 1

Esta é a tarefa grande. O arquivo tem ~1400 linhas e cinco conjuntos de estado a substituir.
Faça tudo numa passada: dividir entre tarefas faria cada uma trabalhar sobre um arquivo que a
anterior já mudou.

- [ ] **Passo 1: Remover os helpers de `localStorage`**

Apagar as funções `storeGet` e `storeSet` (por volta da linha 160) e a interface `Pendency`
(por volta da linha 51), que passa a vir da API.

- [ ] **Passo 2: Trocar os cinco estados**

Substituir as cinco declarações que hoje inicializam de `storeGet` por estado carregado do
banco. O padrão é o mesmo em todos: estado local espelhando o banco, carregado quando o
processo é selecionado.

```tsx
// Etapas do processo aberto: estado e campos técnicos vêm do banco.
const [etapas, setEtapas] = useState<EtapaResumo[]>([]);
const [camposEtapa, setCamposEtapa] = useState<Record<string, unknown>>({});
const [pendencias, setPendencias] = useState<Pendencia[]>([]);
const [nota, setNota] = useState("");
const [salvandoCampos, setSalvandoCampos] = useState(false);
```

Remover: `doneStages`, `stageFields`, `allPendencies`, `privateNotes`, `lastChatView`.

- [ ] **Passo 3: Carregar do banco ao selecionar o processo**

Acrescentar um efeito junto dos que já existem, com a mesma guarda de `selectedId`:

```tsx
/* ── Trabalho do profissional: etapas, pendências e anotação ── */
useEffect(() => {
  const pid = selectedId;
  if (!pid) return;
  let cancelado = false;

  Promise.all([carregarEtapas(pid), listarPendencias(pid), carregarNota(pid)])
    .then(([es, ps, n]) => {
      if (cancelado) return;
      setEtapas(es);
      setPendencias(ps);
      setNota(n);
    })
    .catch(() => {
      // A tela continua utilizável sem esses dados; o erro aparece ao tentar salvar.
    });

  // Abrir o processo marca o chat como lido.
  marcarChatLido(pid);

  return () => { cancelado = true; };
}, [selectedId]);
```

- [ ] **Passo 4: Trocar as funções que liam e gravavam no `localStorage`**

`isDone(pid, n)` passa a ler de `etapas`:

```tsx
const isDone = (n: number) => etapas.some((e) => e.stage_number === n && e.state === "done");
```

Salvar campo da etapa (era `storeSet("rz-stage-fields", ...)`):

```tsx
/** Salva o campo no banco. O estado local muda na hora para o campo não "pular". */
const setField = async (stageNum: number, fieldId: string, valor: FieldVal) => {
  if (!selectedId) return;
  const novos = { ...camposEtapa, [fieldId]: valor };
  setCamposEtapa(novos);
  setSalvandoCampos(true);
  try {
    await salvarCampos(selectedId, stageNum, novos);
  } finally {
    setSalvandoCampos(false);
  }
};
```

Concluir etapa (era `storeSet("rz-done-stages", ...)`):

```tsx
const concluirEtapa = async (n: number) => {
  if (!selectedId) return;
  await marcarEtapa(selectedId, n, "done");
  if (n < 5) await marcarEtapa(selectedId, n + 1, "active");
  setEtapas(await carregarEtapas(selectedId));
};
```

Criar e resolver pendência:

```tsx
const criarPend = async (stageNum: number, descricao: string) => {
  if (!selectedId || !descricao.trim()) return;
  await criarPendencia({ propertyId: selectedId, descricao, stageNumber: stageNum });
  setPendencias(await listarPendencias(selectedId));
  setPendencyInput("");
  setShowPendencyForm(false);
};

const resolverPend = async (id: string) => {
  if (!selectedId) return;
  await resolverPendencia(id);
  setPendencias(await listarPendencias(selectedId));
};
```

Anotação interna (era `storeSet("rz-private-notes", ...)`):

```tsx
const salvarAnotacao = async (texto: string) => {
  if (!selectedId) return;
  setNota(texto);
  await salvarNota(selectedId, texto);
};
```

- [ ] **Passo 5: Trocar o checklist da etapa 1 pelo componente**

Na definição de `STAGE_DEFS`, remover o campo `docs_recebidos` da etapa 1 — ele vira o
componente. No JSX da etapa 1, antes dos demais campos:

```tsx
{activeStage === 1 && selectedId && (
  <div className="mb-6">
    <div className="mb-2 text-sm font-medium">Documentos recebidos</div>
    <ChecklistDocumentos
      propertyId={selectedId}
      recarregarToken={recargaDocs}
      onMudou={() => setRecargaDocs((n) => n + 1)}
    />
  </div>
)}
```

- [ ] **Passo 6: Corrigir os usos de `doneStages` nas estatísticas**

As três métricas da seção Estatísticas (linhas ~839–841) usam `doneStages[p.id]`, que não
existe mais. Como elas precisam do estado de **todos** os processos, e não só do aberto,
carregue um resumo à parte:

```tsx
/* ── Resumo das etapas de todos os processos, para as estatísticas ── */
const [resumoEtapas, setResumoEtapas] = useState<Record<string, number>>({});

useEffect(() => {
  if (myProcs.length === 0) return;
  let cancelado = false;
  Promise.all(
    myProcs.map((p) => carregarEtapas(p.id).then((es) => [p.id, etapasConcluidas(es).length] as const)),
  ).then((pares) => {
    if (!cancelado) setResumoEtapas(Object.fromEntries(pares));
  }).catch(() => { /* estatística é enfeite; não vale quebrar a tela */ });
  return () => { cancelado = true; };
}, [myProcs]);
```

E as métricas passam a usar `resumoEtapas[p.id] ?? 0` no lugar de `(doneStages[p.id] ?? []).length`.

- [ ] **Passo 7: Conferir tipos e testes**

```bash
cd landing && npx tsc --noEmit -p tsconfig.json 2>&1 | grep painel-profissional; npm test 2>&1 | grep -E "Tests.*passed"; grep -n "storeGet\|storeSet\|rz-" src/routes/painel-profissional.tsx
```

Esperado: nenhum erro de tipo; 35 testes passando; **nenhuma** ocorrência de `storeGet`,
`storeSet` ou `rz-`.

- [ ] **Passo 8: Conferir que não aumentou aviso de lint**

```bash
cd landing && npx eslint src/routes/painel-profissional.tsx -f json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s);console.log('avisos:',r[0].messages.length)})"
```

Esperado: número **menor ou igual** ao anterior (~790). Não rodar `--fix`.

- [ ] **Passo 9: Commit**

```bash
cd landing && git add src/routes/painel-profissional.tsx && git commit -m "feat: painel do profissional sem localStorage"
```

---

## Autorrevisão do plano

**Cobertura**

| Item do spec | Tarefa |
|---|---|
| `rz-done-stages` → `process_stages.state` | 1, 3 |
| `rz-stage-fields` → `process_stages.fields` | 3 |
| `rz-pendencies` → tabela | 3 |
| `rz-private-notes` → tabela | 3 |
| `rz-last-chat-view` → `chat_reads` | 1, 3 |
| Conferência sobre documentos reais, três estados | 2, 3 |
| Botão de solicitar cria pendência | 2 |
| Anotação com rótulo "só a equipe vê" | 3 (passo 4) |

Fora deste plano, previsto para o plano 3: pendências na caixa do cliente, sino de
notificações, tela de aprovações do admin, e o pedido de aprovação ao concluir o processo.

**Consistência:** `carregarEtapas`, `marcarEtapa`, `etapasConcluidas`, `progressoDasEtapas`,
`carregarLeituraChat`, `marcarChatLido`, `carregarCampos`, `salvarCampos`, `listarPendencias`,
`criarPendencia`, `resolverPendencia`, `carregarNota`, `salvarNota` — conferidos entre
definição e uso.
