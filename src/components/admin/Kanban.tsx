import { useState, useEffect, type DragEvent } from "react";
import { GripVertical, Building2, Clock, User, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Status = "entrada" | "analise" | "profissional" | "prefeitura" | "entregue";

type Card = {
  id: string;          // property UUID
  imovel: string;
  cliente: string;
  bairro: string;
  prazo: string;
  status: Status;
};

type PropertyRow = Tables<"properties">;

const STATUS_MAP: Record<Status, { stage: number; progress: number }> = {
  entrada:      { stage: 1, progress: 10  },
  analise:      { stage: 2, progress: 30  },
  profissional: { stage: 3, progress: 55  },
  prefeitura:   { stage: 4, progress: 75  },
  entregue:     { stage: 5, progress: 100 },
};

const STAGE_LABELS = ["Cadastro", "Análise", "Profissional", "Tramitação", "Entrega"];

const columns: { id: Status; label: string; tone: string }[] = [
  { id: "entrada",      label: "Entrada",         tone: "bg-surface"                       },
  { id: "analise",      label: "Em análise",       tone: "bg-surface"                       },
  { id: "profissional", label: "Com profissional", tone: "bg-surface"                       },
  { id: "prefeitura",   label: "Em prefeitura",    tone: "bg-foreground text-background"    },
  { id: "entregue",     label: "Entregue",         tone: "bg-accent/10"                     },
];

function rowToCard(p: PropertyRow): Card {
  return {
    id:     p.id,
    imovel: p.name,
    cliente: "—",
    bairro:  [p.city, p.state].filter(Boolean).join(" · ") || "—",
    prazo:   "—",
    status:  (p.status as Status) || "entrada",
  };
}

export function Kanban() {
  const [cards,   setCards]   = useState<Card[]>([]);
  const [dragId,  setDragId]  = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  /* ── Initial load ── */
  useEffect(() => {
    supabase.from("properties").select("*").then(({ data }) => {
      if (data) setCards(data.map(rowToCard));
      setLoading(false);
    });
  }, []);

  /* ── Realtime — keep Kanban in sync with other panels ── */
  useEffect(() => {
    const channel = supabase
      .channel("kanban-properties")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "properties" },
        ({ eventType, new: next, old: prev }) => {
          setCards((cur) => {
            if (eventType === "DELETE") return cur.filter((c) => c.id !== (prev as PropertyRow).id);
            const card = rowToCard(next as PropertyRow);
            if (eventType === "INSERT") return [...cur, card];
            return cur.map((c) => c.id === card.id ? card : c);
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const onDragStart = (id: string) => (e: DragEvent) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDrop = (col: Status) => async (e: DragEvent) => {
    e.preventDefault();
    if (!dragId) return;
    const card = cards.find((c) => c.id === dragId);
    if (!card || card.status === col) { setDragId(null); setOverCol(null); return; }

    // Optimistic UI update
    setCards((cs) => cs.map((c) => c.id === dragId ? { ...c, status: col } : c));
    setDragId(null);
    setOverCol(null);

    const { stage, progress } = STATUS_MAP[col];

    // Update property
    await supabase.from("properties").update({
      status: col,
      current_stage: stage,
      progress,
      updated_at: new Date().toISOString(),
    }).eq("id", card.id);

    // Update all stages for this property
    const stageUpdates = STAGE_LABELS.map((label, i) => ({
      property_id: card.id,
      stage_number: i + 1,
      label,
      state: i + 1 < stage ? "done" : i + 1 === stage ? "active" : "pending",
      ...(i + 1 < stage ? { completed_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    }));

    for (const s of stageUpdates) {
      await supabase
        .from("process_stages")
        .update({ state: s.state, completed_at: s.state === "done" ? s.completed_at : null, updated_at: s.updated_at })
        .eq("property_id", card.id)
        .eq("stage_number", s.stage_number);
    }
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-soft" />
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-5">
      {columns.map((col) => {
        const list    = cards.filter((c) => c.status === col.id);
        const isHead  = col.id === "prefeitura";
        const isOver  = overCol === col.id;
        return (
          <div
            key={col.id}
            onDragOver={(e) => { e.preventDefault(); setOverCol(col.id); }}
            onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
            onDrop={onDrop(col.id)}
            className={`rounded-2xl p-3 ring-1 ring-border transition-colors ${
              isOver ? "bg-accent/5 ring-accent/40" : "bg-background"
            }`}
          >
            <div className={`mb-3 flex items-center justify-between rounded-xl px-3 py-2 text-xs ${col.tone}`}>
              <span className="flex items-center gap-2">
                {isHead && <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />}
                {col.label}
              </span>
              <span className={isHead ? "text-background/70" : "text-ink-soft"}>{list.length}</span>
            </div>

            <div className="space-y-2 min-h-[120px]">
              {list.map((c) => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={onDragStart(c.id)}
                  className="group cursor-grab active:cursor-grabbing rounded-xl bg-background ring-1 ring-border p-3 hover:ring-foreground/30 transition-all hover:-translate-y-0.5"
                >
                  <div className="flex items-start gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-surface">
                      <Building2 className="h-4 w-4 text-ink-soft" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{c.imovel}</div>
                      <div className="text-[11px] text-ink-soft truncate">{c.bairro}</div>
                    </div>
                    <GripVertical className="h-3.5 w-3.5 text-ink-soft/50 opacity-0 group-hover:opacity-100" />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-ink-soft">
                    <span className="flex items-center gap-1 truncate">
                      <User className="h-3 w-3" /> {c.cliente}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {c.prazo}
                    </span>
                  </div>
                </div>
              ))}

              {list.length === 0 && (
                <div className="flex h-20 items-center justify-center rounded-xl border-2 border-dashed border-border text-xs text-ink-soft/50">
                  Solte aqui
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
