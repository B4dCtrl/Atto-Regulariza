# Frente 2 · Plano 3 — Cliente, notificações e aprovações

> **Para trabalhadores agênticos:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar tarefa a tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** Entregar o outro lado da frente 2 — pendência virando tarefa na tela do cliente, sino de notificações funcionando, e a tela onde o admin decide os pedidos de aprovação.

**Arquitetura:** O banco já faz tudo: gatilhos gravam em `notifications`, a pendência fecha sozinha quando o documento do tipo pedido chega, e a conclusão de processo já é recusada sem aval. Este plano é só interface — nenhuma migração.

**Stack:** React 19, TanStack Router, Supabase, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-16-trabalho-do-profissional-design.md`
**Planos anteriores:** `2026-08-16-frente2-p1-fundacao.md` e `2026-08-16-frente2-p2-painel-profissional.md` — concluídos

## Por que este plano é urgente

O plano 1 fez o banco **recusar** conclusão de processo sem aprovação do admin. A tela onde
essa aprovação é dada não existe. Hoje o profissional que tenta concluir um caso recebe um
erro e não tem como destravar — a regra está valendo sem a contraparte.

## Restrições globais

- Comentários e textos em **português (PT-BR)**
- **Nenhum SQL.** O banco já tem tudo
- **Proibido** apagar ou limpar dados reais; o usuário mantém contas de teste
- `npm test` precisa continuar passando (35 testes hoje)
- **Não** rodar `npx eslint --fix` em arquivo existente. Rodar apenas em arquivos **novos**
- Erro de banco nunca chega cru ao usuário — a camada de API já traduz
- Bytes de controle nos arquivos novos: `grep -cP '[\x00-\x08\x0b\x0c\x0e-\x1f]'` deve dar 0

## O que já existe

`src/lib/api/pendencias.ts` — `listarPendencias(propertyId, apenasAbertas?)`, `criarPendencia`,
`resolverPendencia`, `reabrirPendencia`, `textoDaPendencia(p): string`
`src/lib/api/notificacoes.ts` — `listarNotificacoes(limite?)`, `contarNaoLidas()`,
`marcarComoLida(id)`, `marcarTodasComoLidas()`
`src/lib/api/aprovacoes.ts` — `pedirAprovacao({ propertyId, tipo, documentId?, justificativa? })`,
`listarAprovacoesPendentes()`, `decidirAprovacao(id, aprovado, motivo?)`,
`type TipoAprovacao = "conclusao" | "exclusao_documento"`
`src/components/documentos/UploadDocumento.tsx` — `<UploadDocumento propertyId origem onEnviado />`
`src/lib/document-kinds.ts` — `rotuloDoKind(kind)`, `DocumentKind`

**Tipos:** `Pendencia`, `Notificacao`, `Aprovacao` — todos de `Tables<...>`.

**Comportamentos do banco que a interface aproveita:**
- Gatilho em `document_versions` **resolve sozinho** a pendência aberta do mesmo `kind`
- Gatilhos gravam `notifications` em mensagem, documento, pendência e aprovação
- Ninguém é notificado da própria ação
- Concluir processo sem aprovação levanta exceção
- A aprovação é **consumida**: serve uma vez só

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/components/cliente/TarefasDoCliente.tsx` | **novo**: pendências como tarefa, com envio direto |
| `src/components/notificacoes/SinoNotificacoes.tsx` | **novo**: sino com contador e lista |
| `src/routes/admin/aprovacoes-processo.tsx` | **novo**: fila de decisão do admin |
| `src/routes/dashboard.tsx` | **modificar**: tarefas na caixa "O que falta de você" |
| `src/routes/painel-profissional.tsx` | **modificar**: sino + pedir aprovação ao concluir |
| `src/components/admin/AdminSidebar.tsx` | **modificar**: item de aprovações de processo |

---

## Tarefa 1: Tarefas do cliente

**Arquivos:**
- Criar: `src/components/cliente/TarefasDoCliente.tsx`

**Interfaces:**
- Consome: `listarPendencias`, `textoDaPendencia`, `Pendencia`; `UploadDocumento`;
  `rotuloDoKind`, `DocumentKind`
- Produz: `<TarefasDoCliente propertyId={string} recarregarToken={number} onMudou={() => void} />`

- [ ] **Passo 1: Escrever o componente**

Criar `src/components/cliente/TarefasDoCliente.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Check, ChevronDown, Loader2, Upload } from "lucide-react";
import { listarPendencias, textoDaPendencia, type Pendencia } from "@/lib/api/pendencias";
import { UploadDocumento } from "@/components/documentos/UploadDocumento";
import type { DocumentKind } from "@/lib/document-kinds";

/**
 * O que a equipe está esperando do cliente.
 *
 * Antes, a pendência que o profissional registrava morria no navegador dele: o
 * cliente nunca sabia. Agora ela aparece aqui como tarefa, e quando traz um
 * tipo de documento vem com o envio embutido — o cliente não escolhe nada, só
 * manda o arquivo.
 *
 * Não há botão de "concluir tarefa": um gatilho no banco fecha a pendência
 * quando chega documento do tipo pedido. O cliente vê a tarefa sumir sozinha,
 * que é o retorno que o faz agir da próxima vez.
 */
export function TarefasDoCliente({
  propertyId,
  recarregarToken = 0,
  onMudou,
}: {
  propertyId: string;
  recarregarToken?: number;
  onMudou?: () => void;
}) {
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);

  const carregar = useCallback(() => {
    setCarregando(true);
    listarPendencias(propertyId, true)
      .then(setPendencias)
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [propertyId]);

  useEffect(() => {
    carregar();
  }, [carregar, recarregarToken]);

  if (carregando) {
    return (
      <div className="flex h-16 items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-background/50" />
      </div>
    );
  }

  if (erro) {
    return <p className="text-sm text-background/70">{erro}</p>;
  }

  if (pendencias.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-background/70">
        <Check className="h-4 w-4 shrink-0" />
        Nada pendente da sua parte no momento.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pendencias.map((p) => {
        const expandida = aberta === p.id;
        const temEnvio = !!p.kind;

        return (
          <div key={p.id} className="rounded-2xl bg-background/10 p-3">
            <button
              type="button"
              onClick={() => temEnvio && setAberta(expandida ? null : p.id)}
              disabled={!temEnvio}
              className="flex w-full items-start gap-2.5 text-left"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-background/70" />
              <span className="min-w-0 flex-1 text-sm leading-relaxed text-background">
                {textoDaPendencia(p)}
              </span>
              {temEnvio && (
                <ChevronDown
                  className={`mt-0.5 h-4 w-4 shrink-0 text-background/60 transition-transform ${
                    expandida ? "rotate-180" : ""
                  }`}
                />
              )}
            </button>

            {temEnvio && !expandida && (
              <button
                type="button"
                onClick={() => setAberta(p.id)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs text-accent-foreground"
              >
                <Upload className="h-3 w-3" /> Enviar agora
              </button>
            )}

            {temEnvio && expandida && (
              <div className="mt-3">
                {/* O tipo já vem definido pela pendência: o cliente não escolhe.
                    Assim que o arquivo chega, o gatilho no banco fecha a tarefa. */}
                <UploadDocumento
                  propertyId={propertyId}
                  origem="cliente"
                  tipoFixo={p.kind as DocumentKind}
                  onEnviado={() => {
                    setAberta(null);
                    carregar();
                    onMudou?.();
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Passo 2: Acrescentar `tipoFixo` ao `UploadDocumento`**

O componente hoje só decide entre "cliente escolhe o tipo" e "profissional não escolhe".
Falta o terceiro caso: tipo já definido pela tarefa.

Em `src/components/documentos/UploadDocumento.tsx`, na assinatura:

```tsx
export function UploadDocumento({
  propertyId,
  origem,
  tipoFixo,
  onEnviado,
}: {
  propertyId: string;
  origem: DocumentOrigem;
  /**
   * Tipo já decidido por quem pediu — usado quando o envio nasce de uma
   * pendência. O seletor some: perguntar o tipo de novo, depois de a equipe já
   * ter dito qual é, só cria chance de erro.
   */
  tipoFixo?: DocumentKind;
  onEnviado: () => void;
}) {
```

E logo abaixo, trocar a decisão de `exigeTipo`:

```tsx
  const exigeTipo = origem === "cliente" && !tipoFixo;

  const [kind, setKind] = useState<DocumentKind | "">(
    tipoFixo ?? (origem === "cliente" ? "" : "outro"),
  );
```

E no lugar do texto "Enviar documento" do ramo sem seletor:

```tsx
      ) : (
        <p className="text-sm font-medium">
          {tipoFixo ? `Enviar: ${rotuloDoKind(tipoFixo)}` : "Enviar documento"}
        </p>
      )}
```

Acrescentar `rotuloDoKind` ao import de `@/lib/document-kinds`.

- [ ] **Passo 3: Conferir tipos, lint e bytes de controle**

```bash
cd landing && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "TarefasDoCliente|UploadDocumento"; grep -cP '[\x00-\x08\x0b\x0c\x0e-\x1f]' src/components/cliente/TarefasDoCliente.tsx; npx eslint --fix src/components/cliente/TarefasDoCliente.tsx && npx eslint src/components/cliente/TarefasDoCliente.tsx && echo "lint ok"; npm test 2>&1 | grep -E "Tests.*passed"
```

Esperado: sem erro de tipo, `0`, `lint ok`, 35 testes.

- [ ] **Passo 4: Commit**

```bash
cd landing && git add src/components/cliente/TarefasDoCliente.tsx src/components/documentos/UploadDocumento.tsx && git commit -m "feat: pendencia vira tarefa com envio direto para o cliente"
```

---

## Tarefa 2: Tarefas na caixa "O que falta de você"

**Arquivos:**
- Modificar: `src/routes/dashboard.tsx`

**Interfaces:**
- Consome: `TarefasDoCliente` da Tarefa 1

- [ ] **Passo 1: Localizar a caixa**

```bash
cd landing && grep -n "O que falta de você" src/routes/dashboard.tsx
```

Ela é a seção preta com `bg-foreground text-background`, que hoje mostra
`property?.next_action` ou o texto fixo "Aguardando equipe".

- [ ] **Passo 2: Trocar o conteúdo**

Acrescentar o import no topo:

```tsx
import { TarefasDoCliente } from "@/components/cliente/TarefasDoCliente";
```

E dentro da seção, substituir o `<h3>` que mostra `next_action` por:

```tsx
{/* Pendências primeiro: são pedidos concretos da equipe, com o envio ali.
    O next_action do processo é genérico e só aparece quando não há tarefa. */}
{propertyId && (
  <div className="mt-3">
    <TarefasDoCliente
      propertyId={propertyId}
      recarregarToken={recargaDocs}
      onMudou={() => setRecargaDocs((n) => n + 1)}
    />
  </div>
)}
```

Manter o título "O que falta de você" e o ícone. Remover o botão "Enviar agora" que levava
para a seção de documentos: agora o envio está dentro da própria tarefa.

- [ ] **Passo 3: Recarregar quando a pendência mudar**

No efeito de realtime que já existe (o que assina `messages` e `documents`), acrescentar:

```tsx
      /* pendências → a lista de tarefas recarrega sozinha */
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pendencies", filter: `property_id=eq.${propertyId}` },
        // O canal só avisa; quem busca é o TarefasDoCliente, cuja consulta
        // passa pela RLS.
        () => setRecargaDocs((n) => n + 1),
      )
```

- [ ] **Passo 4: Conferir**

```bash
cd landing && npx tsc --noEmit -p tsconfig.json 2>&1 | grep dashboard; npm test 2>&1 | grep -E "Tests.*passed"
```

Esperado: sem erro de tipo; 35 testes.

- [ ] **Passo 5: Commit**

```bash
cd landing && git add src/routes/dashboard.tsx && git commit -m "feat(cliente): tarefas da equipe na caixa O que falta de voce"
```

---

## Tarefa 3: Sino de notificações

**Arquivos:**
- Criar: `src/components/notificacoes/SinoNotificacoes.tsx`

**Interfaces:**
- Consome: `listarNotificacoes`, `contarNaoLidas`, `marcarComoLida`, `marcarTodasComoLidas`,
  `Notificacao`
- Produz: `<SinoNotificacoes onAbrirProcesso={(propertyId: string) => void} />`

- [ ] **Passo 1: Escrever o componente**

Criar `src/components/notificacoes/SinoNotificacoes.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Check, FileText, MessageSquare, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listarNotificacoes,
  contarNaoLidas,
  marcarComoLida,
  marcarTodasComoLidas,
  type Notificacao,
} from "@/lib/api/notificacoes";

const ICONE: Record<string, React.ElementType> = {
  mensagem: MessageSquare,
  documento: FileText,
  pendencia: AlertCircle,
  aprovacao: ShieldCheck,
};

function quandoFoi(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

/**
 * Sino com contador e lista.
 *
 * Nada é criado aqui: as notificações nascem de gatilhos no banco quando chega
 * mensagem, documento, pendência ou pedido de aprovação. Este componente só lê
 * e marca como lida.
 */
export function SinoNotificacoes({
  onAbrirProcesso,
}: {
  onAbrirProcesso?: (propertyId: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const caixaRef = useRef<HTMLDivElement>(null);

  const atualizarContador = useCallback(() => {
    contarNaoLidas().then(setNaoLidas);
  }, []);

  useEffect(() => {
    atualizarContador();

    // O gatilho grava a notificação; o canal avisa que chegou.
    const ch = supabase
      .channel("notificacoes")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        atualizarContador();
        if (aberto) carregar();
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atualizarContador]);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!aberto) return;
    function aoClicar(e: MouseEvent) {
      if (caixaRef.current && !caixaRef.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, [aberto]);

  function carregar() {
    setCarregando(true);
    listarNotificacoes()
      .then(setItens)
      .catch(() => setItens([]))
      .finally(() => setCarregando(false));
  }

  function abrir() {
    const novoEstado = !aberto;
    setAberto(novoEstado);
    if (novoEstado) carregar();
  }

  async function aoClicarItem(n: Notificacao) {
    if (!n.lida) {
      await marcarComoLida(n.id);
      setItens((is) => is.map((i) => (i.id === n.id ? { ...i, lida: true } : i)));
      atualizarContador();
    }
    if (n.property_id && onAbrirProcesso) {
      onAbrirProcesso(n.property_id);
      setAberto(false);
    }
  }

  async function lerTodas() {
    await marcarTodasComoLidas();
    setItens((is) => is.map((i) => ({ ...i, lida: true })));
    setNaoLidas(0);
  }

  return (
    <div ref={caixaRef} className="relative">
      <button
        type="button"
        onClick={abrir}
        aria-label={naoLidas > 0 ? `${naoLidas} notificações não lidas` : "Notificações"}
        className="relative grid h-9 w-9 place-items-center rounded-full border border-border bg-background transition-colors hover:bg-surface"
      >
        <Bell className="h-4 w-4 text-ink-soft" />
        {naoLidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-medium text-accent-foreground">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-border bg-background shadow-xl">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="text-sm font-medium">Notificações</span>
            {naoLidas > 0 && (
              <button
                type="button"
                onClick={lerTodas}
                className="ml-auto text-xs text-ink-soft hover:text-foreground"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {carregando ? (
              <div className="flex h-20 items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-ink-soft" />
              </div>
            ) : itens.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Check className="mx-auto h-5 w-5 text-ink-soft" />
                <p className="mt-2 text-xs text-ink-soft">Nenhuma novidade.</p>
              </div>
            ) : (
              itens.map((n) => {
                const Icone = ICONE[n.tipo] ?? Bell;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => aoClicarItem(n)}
                    className={`flex w-full gap-2.5 border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-surface ${
                      n.lida ? "" : "bg-accent/5"
                    }`}
                  >
                    <Icone className={`mt-0.5 h-4 w-4 shrink-0 ${n.lida ? "text-ink-soft" : "text-accent"}`} />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${n.lida ? "text-ink-soft" : "font-medium"}`}>
                        {n.titulo}
                      </span>
                      {n.corpo && (
                        <span className="mt-0.5 block truncate text-xs text-ink-soft">{n.corpo}</span>
                      )}
                      <span className="mt-0.5 block text-[11px] text-ink-soft/70">
                        {quandoFoi(n.criada_em)}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Passo 2: Conferir**

```bash
cd landing && npx tsc --noEmit -p tsconfig.json 2>&1 | grep SinoNotificacoes; grep -cP '[\x00-\x08\x0b\x0c\x0e-\x1f]' src/components/notificacoes/SinoNotificacoes.tsx; npx eslint --fix src/components/notificacoes/SinoNotificacoes.tsx && npx eslint src/components/notificacoes/SinoNotificacoes.tsx && echo "lint ok"
```

Esperado: sem erro de tipo, `0`, `lint ok`.

- [ ] **Passo 3: Commit**

```bash
cd landing && git add src/components/notificacoes/SinoNotificacoes.tsx && git commit -m "feat: sino de notificacoes"
```

---

## Tarefa 4: Tela de aprovações do admin

**Arquivos:**
- Criar: `src/routes/admin/aprovacoes-processo.tsx`
- Modificar: `src/components/admin/AdminSidebar.tsx`

**Interfaces:**
- Consome: `listarAprovacoesPendentes`, `decidirAprovacao`, `Aprovacao`

- [ ] **Passo 1: Escrever a tela**

Criar `src/routes/admin/aprovacoes-processo.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, X, Loader2, Inbox, ShieldCheck, Trash2, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listarAprovacoesPendentes, decidirAprovacao, type Aprovacao } from "@/lib/api/aprovacoes";

export const Route = createFileRoute("/admin/aprovacoes-processo")({
  head: () => ({ meta: [{ title: "Aprovações de processo — Gestão Regulariza" }] }),
  component: AprovacoesProcessoPage,
});

/** Nome do processo e de quem pediu, para o admin decidir com contexto. */
interface Contexto {
  processo: string;
  solicitante: string;
}

function AprovacoesProcessoPage() {
  const [pedidos, setPedidos] = useState<Aprovacao[]>([]);
  const [ctx, setCtx] = useState<Record<string, Contexto>>({});
  const [carregando, setCarregando] = useState(true);
  const [decidindo, setDecidindo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const lista = await listarAprovacoesPendentes();
      setPedidos(lista);

      // Contexto numa consulta só, em vez de uma por pedido.
      const propIds = [...new Set(lista.map((p) => p.property_id))];
      const userIds = [...new Set(lista.map((p) => p.solicitado_por).filter(Boolean))] as string[];

      const [{ data: props }, { data: perfis }] = await Promise.all([
        supabase.from("properties").select("id, name").in("id", propIds.length ? propIds : [""]),
        supabase.from("profiles").select("id, name").in("id", userIds.length ? userIds : [""]),
      ]);

      const nomeProc = new Map((props ?? []).map((p) => [p.id, p.name]));
      const nomeUser = new Map((perfis ?? []).map((p) => [p.id, p.name ?? "—"]));

      setCtx(
        Object.fromEntries(
          lista.map((p) => [
            p.id,
            {
              processo: nomeProc.get(p.property_id) ?? "Processo",
              solicitante: p.solicitado_por ? (nomeUser.get(p.solicitado_por) ?? "—") : "—",
            },
          ]),
        ),
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os pedidos.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function decidir(p: Aprovacao, aprovado: boolean) {
    const motivo = aprovado
      ? undefined
      : window.prompt("Motivo da recusa (o profissional vê esta mensagem):")?.trim();
    if (!aprovado && motivo === undefined) return;

    setDecidindo(p.id);
    setErro(null);
    try {
      await decidirAprovacao(p.id, aprovado, motivo);
      setPedidos((ps) => ps.filter((x) => x.id !== p.id));
    } catch (e) {
      // A camada de API distingue "outro admin já decidiu" da falha genérica.
      setErro(e instanceof Error ? e.message : "Não foi possível registrar a decisão.");
      carregar();
    } finally {
      setDecidindo(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1000px] p-6 lg:p-8">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-widest text-ink-soft">Gestão · Processos</div>
        <h1 className="font-serif text-3xl tracking-tight">Aprovações de processo</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Concluir um processo e excluir documento dependem do seu aval. A regra é imposta pelo
          banco: sem aprovação aqui, o profissional não consegue fazer nem por fora do site.
        </p>
      </div>

      {erro && (
        <div role="alert" className="mb-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
          {erro}
        </div>
      )}

      {carregando ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-ink-soft" />
        </div>
      ) : pedidos.length === 0 ? (
        <div className="rounded-3xl bg-background p-16 text-center ring-1 ring-border">
          <Inbox className="mx-auto h-7 w-7 text-ink-soft" />
          <p className="mt-3 text-sm text-ink-soft">Nenhum pedido aguardando decisão.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pedidos.map((p) => {
            const c = ctx[p.id];
            const ehConclusao = p.tipo === "conclusao";
            const Icone = ehConclusao ? Flag : Trash2;

            return (
              <div key={p.id} className="rounded-2xl bg-background p-5 ring-1 ring-border">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 gap-3.5">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent/15 text-accent">
                      <Icone className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium">
                        {ehConclusao ? "Concluir o processo" : "Excluir um documento"}
                      </div>
                      <div className="mt-0.5 text-sm text-ink-soft">
                        {c?.processo} · pedido por {c?.solicitante}
                      </div>
                      {p.justificativa && (
                        <div className="mt-2 rounded-xl bg-surface/60 px-3 py-2 text-xs leading-relaxed text-ink-soft">
                          {p.justificativa}
                        </div>
                      )}
                      <div className="mt-1.5 text-[11px] text-ink-soft/70">
                        {new Date(p.solicitado_em).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => decidir(p, true)}
                      disabled={decidindo === p.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {decidindo === p.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Aprovar
                    </button>
                    <button
                      type="button"
                      onClick={() => decidir(p, false)}
                      disabled={decidindo === p.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm text-ink-soft transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" /> Recusar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Cada aprovação vale uma vez. Aprovar de novo o mesmo processo exige pedido novo.
      </p>
    </div>
  );
}
```

- [ ] **Passo 2: Acrescentar ao menu do admin**

Em `src/components/admin/AdminSidebar.tsx`, no array `cadastroItems`, logo após o item de
Aprovações que já existe:

```tsx
  { to: "/admin/aprovacoes-processo", label: "Aprov. processo", icon: Flag },
```

Acrescentar `Flag` ao import de `lucide-react`.

- [ ] **Passo 3: Regenerar a árvore de rotas e conferir**

O `routeTree.gen.ts` é gerado pelo servidor de desenvolvimento. Rode-o uma vez:

```bash
cd landing && timeout 20 npm run dev; grep -c "aprovacoes-processo" src/routeTree.gen.ts
```

Esperado: contagem maior que 0.

```bash
cd landing && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "aprovacoes-processo|AdminSidebar"; npm test 2>&1 | grep -E "Tests.*passed"
```

Esperado: sem erro de tipo; 35 testes.

- [ ] **Passo 4: Commit**

```bash
cd landing && git add src/routes/admin/aprovacoes-processo.tsx src/components/admin/AdminSidebar.tsx src/routeTree.gen.ts && git commit -m "feat(admin): tela de aprovacoes de processo"
```

---

## Tarefa 5: Sino e pedido de aprovação no painel do profissional

**Arquivos:**
- Modificar: `src/routes/painel-profissional.tsx`

**Interfaces:**
- Consome: `SinoNotificacoes` da Tarefa 3; `pedirAprovacao` de `@/lib/api/aprovacoes`

- [ ] **Passo 1: Trocar o sino existente**

O painel já tem um botão de sino que leva à seção de notificações. Substituir pelo componente:

```tsx
<SinoNotificacoes onAbrirProcesso={(pid) => { setMainSection("processos"); openProcess(pid); }} />
```

- [ ] **Passo 2: Concluir a última etapa passa a pedir aprovação**

Em `completeStage`, quando `n === 5`, em vez de marcar a etapa e mudar o status do processo,
abrir pedido:

```tsx
  // A etapa 5 é a entrega. O banco recusa mudar o processo para 'entregue' sem
  // aprovação, então pedimos aqui em vez de deixar o profissional bater no erro.
  if (n === 5) {
    try {
      await pedirAprovacao({
        propertyId: selectedId,
        tipo: "conclusao",
        justificativa: "Todas as etapas concluídas.",
      });
      setErroTrabalho(null);
      setAguardandoAprovacao(true);
    } catch (e) {
      setErroTrabalho(e instanceof Error ? e.message : "Não foi possível enviar o pedido.");
    }
    return;
  }
```

Acrescentar o estado:

```tsx
const [aguardandoAprovacao, setAguardandoAprovacao] = useState(false);
```

E na barra inferior, quando `aguardandoAprovacao` for verdadeiro, mostrar no lugar do botão:

```tsx
<div className="flex flex-1 items-center gap-2 text-xs text-ink-soft">
  <ShieldCheck className="h-4 w-4 shrink-0" />
  Pedido enviado. A entrega será concluída após a aprovação do administrador.
</div>
```

- [ ] **Passo 3: Conferir**

```bash
cd landing && npx tsc --noEmit -p tsconfig.json 2>&1 | grep painel-profissional; npm test 2>&1 | grep -E "Tests.*passed"; npm run build 2>&1 | tail -2
```

Esperado: sem erro de tipo; 35 testes; build passa.

- [ ] **Passo 4: Commit**

```bash
cd landing && git add src/routes/painel-profissional.tsx && git commit -m "feat(profissional): sino de notificacoes e pedido de aprovacao na entrega"
```

---

## Autorrevisão do plano

**Cobertura do spec**

| Requisito | Tarefa |
|---|---|
| Pendência como tarefa com envio direto | 1, 2 |
| Pendência fecha sozinha ao chegar o documento | banco (plano 1); a tela recarrega em 2 |
| Sino com contador e lista | 3, 5 |
| Notificação leva ao processo | 3, 5 |
| Tela de decisão do admin | 4 |
| Concluir processo pede aprovação | 5 |
| Aprovação vale uma vez | banco (plano 1); a tela avisa em 4 |

**Fora deste plano:** o resumo por e-mail, que o spec já previa como segunda etapa e exige um
`cron job` no Supabase. O interruptor "Notificações por email" no painel do profissional
continua salvando a preferência sem ninguém lê-la — vale marcá-lo como "em breve" até existir.

**Consistência:** `listarPendencias`, `textoDaPendencia`, `listarNotificacoes`, `contarNaoLidas`,
`marcarComoLida`, `marcarTodasComoLidas`, `listarAprovacoesPendentes`, `decidirAprovacao`,
`pedirAprovacao`, `tipoFixo` — conferidos entre definição e uso.
