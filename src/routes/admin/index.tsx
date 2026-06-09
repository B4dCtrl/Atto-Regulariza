import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Kanban } from "@/components/admin/Kanban";
import { ChatbotPanel } from "@/components/admin/ChatbotPanel";
import { UploadZone } from "@/components/admin/UploadZone";
import { Search, Bell, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Back office — Regulariza" }] }),
  component: AdminHome,
});

type KPI = { l: string; v: string };

function AdminHome() {
  const [kpis,    setKpis]    = useState<KPI[]>([
    { l: "Ativos",              v: "…" },
    { l: "Em prefeitura",       v: "…" },
    { l: "Aguardando cliente",  v: "…" },
    { l: "Entregues no mês",    v: "…" },
  ]);
  const [loading, setLoading] = useState(true);

  async function loadKpis() {
    const { data } = await supabase.from("properties").select("status, updated_at");
    if (!data) return;

    const now        = new Date();
    const thisMonth  = now.getMonth();
    const thisYear   = now.getFullYear();

    const ativos     = data.filter((p) => p.status !== "entregue").length;
    const prefeitura = data.filter((p) => p.status === "prefeitura").length;
    const aguardando = data.filter((p) => p.status === "entrada").length;
    const entregues  = data.filter((p) => {
      if (p.status !== "entregue") return false;
      const d = new Date(p.updated_at);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }).length;

    setKpis([
      { l: "Ativos",             v: String(ativos)     },
      { l: "Em prefeitura",      v: String(prefeitura) },
      { l: "Aguardando cliente", v: String(aguardando) },
      { l: "Entregues no mês",   v: String(entregues)  },
    ]);
    setLoading(false);
  }

  useEffect(() => {
    loadKpis();

    const channel = supabase
      .channel("admin-kpis")
      .on("postgres_changes", { event: "*", schema: "public", table: "properties" }, loadKpis)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
      <div className="mb-6 flex items-center gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-ink-soft">Visão geral</div>
          <h1 className="font-serif text-3xl tracking-tight">Processos em andamento</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="hidden items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-ink-soft md:flex"
          >
            <Search className="h-3.5 w-3.5" /> Buscar processo
          </button>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background"
          >
            <Bell className="h-4 w-4 text-ink-soft" />
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-3 py-2 text-sm text-background"
          >
            <Plus className="h-3.5 w-3.5" /> Novo processo
          </button>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-xs text-background">
            AD
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((m) => (
          <div key={m.l} className="rounded-2xl bg-background p-4 ring-1 ring-border">
            <div className="text-[11px] text-ink-soft">{m.l}</div>
            <div className="mt-1 font-serif text-3xl tracking-tight">
              {loading
                ? <Loader2 className="inline h-5 w-5 animate-spin text-ink-soft" />
                : m.v
              }
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Kanban />
          <ChatbotPanel />
        </div>
        <div className="space-y-6">
          <UploadZone />
          <div className="rounded-2xl bg-foreground p-5 text-background">
            <div className="text-[10px] uppercase tracking-widest text-background/60">Próximas ações</div>
            <div className="mt-2 font-serif text-xl leading-snug">3 protocolos vencem nesta semana</div>
            <ul className="mt-3 space-y-2 text-xs text-background/80">
              <li className="flex justify-between"><span>Apto 142 · Vila Madalena</span><span>2d</span></li>
              <li className="flex justify-between"><span>Lote 88 · Campo Grande</span><span>4d</span></li>
              <li className="flex justify-between"><span>Sala 305 · Pinheiros</span><span>5d</span></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
