import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  BarChart2, Bell, Building2, Check, Clock, Download,
  Layers, Loader2, Search, Settings, TrendingUp, Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/gestao")({
  beforeLoad: () => {
    throw redirect({ to: "/admin" });
  },
  head: () => ({
    meta: [
      { title: "Gestão Geral — Ato Regulariza" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GestaoPage,
});

type PropertyRow = Tables<"properties">;

const STATUS_LABEL: Record<string, string> = {
  entrada:      "Entrada",
  analise:      "Em análise",
  profissional: "Com profissional",
  prefeitura:   "Em prefeitura",
  entregue:     "Entregue",
};

const STATUS_DOT: Record<string, string> = {
  entrada:      "bg-ink-soft",
  analise:      "bg-yellow-400",
  profissional: "bg-blue-400",
  prefeitura:   "bg-accent animate-pulse",
  entregue:     "bg-green-400",
};

function GestaoPage() {
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [filter,     setFilter]     = useState<string>("all");

  /* ── Load + Realtime ── */
  useEffect(() => {
    supabase.from("properties").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setProperties(data);
      setLoading(false);
    });

    const channel = supabase
      .channel("gestao-properties")
      .on("postgres_changes", { event: "*", schema: "public", table: "properties" }, ({ eventType, new: next, old: prev }) => {
        setProperties((cur) => {
          if (eventType === "DELETE") return cur.filter((p) => p.id !== (prev as PropertyRow).id);
          const row = next as PropertyRow;
          if (eventType === "INSERT") return [row, ...cur];
          return cur.map((p) => p.id === row.id ? row : p);
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  /* ── KPIs ── */
  const now          = new Date();
  const total        = properties.length;
  const ativos       = properties.filter((p) => p.status !== "entregue").length;
  const entregues    = properties.filter((p) => p.status === "entregue").length;
  const emPrefeitura = properties.filter((p) => p.status === "prefeitura").length;
  const avgProgress  = total ? Math.round(properties.reduce((a, p) => a + p.progress, 0) / total) : 0;

  const entreguesMes = properties.filter((p) => {
    if (p.status !== "entregue") return false;
    const d = new Date(p.updated_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const kpis = [
    { icon: Layers,    label: "Total de processos", value: String(total),        tone: "bg-background" },
    { icon: TrendingUp,label: "Ativos",              value: String(ativos),       tone: "bg-background" },
    { icon: BarChart2, label: "Em prefeitura",       value: String(emPrefeitura), tone: "bg-background" },
    { icon: Check,     label: "Entregues no mês",    value: String(entreguesMes), tone: "bg-foreground text-background" },
  ];

  /* ── Filtered list ── */
  const filtered = properties.filter((p) => {
    const matchFilter = filter === "all" || p.status === filter;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
      || (p.city ?? "").toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div className="min-h-screen bg-surface/40 text-foreground">
      {/* Topbar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-ato.png" alt="Ato Regulariza" className="h-7 w-7 rounded-md object-contain" />
            <span className="font-serif text-xl tracking-tight hidden sm:inline">Ato Regulariza</span>
          </Link>
          <div className="h-5 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-2 text-sm">
            <BarChart2 className="h-4 w-4 text-ink-soft" />
            <span className="font-medium">Gestão Geral</span>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-4 py-1.5 text-xs text-ink-soft">
              <Search className="h-3.5 w-3.5" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar imóvel, cidade…"
                className="bg-transparent outline-none w-40 placeholder:text-ink-soft/60"
              />
            </div>
            <button className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface-elevated">
              <Bell className="h-4 w-4 text-ink-soft" />
            </button>
            <button className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface-elevated">
              <Settings className="h-4 w-4 text-ink-soft" />
            </button>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-background text-xs font-medium">
              GZ
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="text-[10px] uppercase tracking-widest text-ink-soft">Painel do proprietário</div>
          <h1 className="font-serif text-4xl tracking-tight">Torre de controle</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Visão completa de todos os processos · sincronizado em tempo real
          </p>
        </div>

        {/* KPIs */}
        {loading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-ink-soft" />
          </div>
        ) : (
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {kpis.map((k, i) => (
              <motion.div
                key={k.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
                className={`rounded-2xl p-5 ${k.tone} ring-1 ring-border`}
              >
                <k.icon className={`h-4 w-4 ${k.tone.includes("foreground") ? "text-background/60" : "text-ink-soft"}`} />
                <div className={`mt-3 font-serif text-4xl tracking-tight ${k.tone.includes("foreground") ? "text-background" : ""}`}>
                  {k.value}
                </div>
                <div className={`mt-1 text-xs ${k.tone.includes("foreground") ? "text-background/60" : "text-ink-soft"}`}>
                  {k.label}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Progress overview */}
        <div className="mb-8 rounded-3xl bg-background ring-1 ring-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs text-ink-soft">Performance geral</div>
              <h2 className="font-serif text-2xl tracking-tight">Distribuição por etapa</h2>
            </div>
            <div className="text-xs text-ink-soft">Progresso médio: {avgProgress}%</div>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {["entrada", "analise", "profissional", "prefeitura", "entregue"].map((s) => {
              const count = properties.filter((p) => p.status === s).length;
              const pct   = total ? Math.round((count / total) * 100) : 0;
              return (
                <div key={s} className="text-center">
                  <div className="relative h-24 bg-surface rounded-xl overflow-hidden">
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 bg-foreground rounded-xl"
                      initial={{ height: 0 }}
                      animate={{ height: `${pct}%` }}
                      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                    />
                    <div className="relative z-10 flex h-full items-center justify-center font-serif text-2xl">
                      {count}
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-ink-soft">{STATUS_LABEL[s]}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {["all", "entrada", "analise", "profissional", "prefeitura", "entregue"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                filter === f
                  ? "bg-foreground text-background"
                  : "border border-border text-ink-soft hover:border-foreground/30"
              }`}
            >
              {f === "all" ? "Todos" : STATUS_LABEL[f]}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-ink-soft">{filtered.length} processo{filtered.length !== 1 ? "s" : ""}</span>
            <button className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-ink-soft hover:border-foreground/30">
              <Download className="h-3 w-3" /> Exportar
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-3xl bg-background ring-1 ring-border overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 border-b border-border px-6 py-3 text-[11px] uppercase tracking-wider text-ink-soft">
            <span>Imóvel</span>
            <span>Localidade</span>
            <span>Etapa</span>
            <span>Progresso</span>
            <span>Status</span>
          </div>
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-ink-soft" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-ink-soft">Nenhum processo encontrado.</div>
          ) : (
            <ul>
              {filtered.map((p, i) => (
                <motion.li
                  key={p.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: i * 0.02 }}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 items-center border-b border-border/50 px-6 py-4 last:border-0 hover:bg-surface/40 transition-colors"
                >
                  {/* Imóvel */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface ring-1 ring-border">
                      <Building2 className="h-4 w-4 text-ink-soft" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-xs text-ink-soft truncate">{p.address}</div>
                    </div>
                  </div>

                  {/* Localidade */}
                  <div className="text-sm text-ink-soft">
                    {p.city}<br /><span className="text-[11px]">{p.state}</span>
                  </div>

                  {/* Etapa */}
                  <div className="text-sm">
                    <span className="font-medium">{p.current_stage}</span>
                    <span className="text-ink-soft"> / 5</span>
                  </div>

                  {/* Progresso */}
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
                        <div
                          className="h-full rounded-full bg-accent transition-all duration-700"
                          style={{ width: `${p.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-ink-soft w-8 text-right">{p.progress}%</span>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${STATUS_DOT[p.status] ?? "bg-ink-soft"}`} />
                    <span className="text-xs">{STATUS_LABEL[p.status] ?? p.status}</span>
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 text-xs text-ink-soft">
          <div className="flex items-center gap-4">
            <span>Sincronizado em tempo real · Supabase Realtime</span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" /> online
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/admin" className="hover:text-foreground">Back office</Link>
            <Link to="/painel-profissional" className="hover:text-foreground">Painel profissional</Link>
            <Link to="/" className="hover:text-foreground">Voltar ao site</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
