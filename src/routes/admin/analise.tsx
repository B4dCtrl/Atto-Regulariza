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
    const pendencias = aberto.pendencias.map((p, n) => (n === i ? { ...p, [campo]: valor } : p));
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
