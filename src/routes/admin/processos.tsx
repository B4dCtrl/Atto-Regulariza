import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Building2, Check, Loader2, Search, Download,
  ArrowUpRight, Filter, ChevronDown,
} from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/admin/processos")({
  head: () => ({ meta: [{ title: "Processos — Gestão Regulariza" }] }),
  component: ProcessosPage,
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
const STATUS_BG: Record<string, string> = {
  entrada:      "bg-surface text-ink-soft",
  analise:      "bg-yellow-50 text-yellow-700",
  profissional: "bg-blue-50 text-blue-700",
  prefeitura:   "bg-accent/10 text-accent",
  entregue:     "bg-green-50 text-green-700",
};

function ProcessosPage() {
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [filter,     setFilter]     = useState("all");
  const [sortBy,     setSortBy]     = useState<"created_at" | "progress" | "name">("created_at");
  const navigate = useNavigate();

  function exportCsv() {
    const headers = ["Imóvel", "Cidade", "Estado", "Status", "Progresso", "Etapa", "Criado em"];
    const rows = filtered.map((p) => [
      p.name, p.city ?? "", p.state ?? "",
      STATUS_LABEL[p.status] ?? p.status, `${p.progress}%`, `${p.current_stage}/5`,
      new Date(p.created_at).toLocaleDateString("pt-BR"),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `processos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    supabase
      .from("properties")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setProperties(data);
        setLoading(false);
      });

    const ch = supabase
      .channel("processos-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "properties" }, ({ eventType, new: next, old: prev }) => {
        setProperties((cur) => {
          if (eventType === "DELETE") return cur.filter((p) => p.id !== (prev as PropertyRow).id);
          const row = next as PropertyRow;
          if (eventType === "INSERT") return [row, ...cur];
          return cur.map((p) => p.id === row.id ? row : p);
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = properties
    .filter((p) => {
      const ok = filter === "all" || p.status === filter;
      const q  = search.toLowerCase();
      const match = !q || p.name.toLowerCase().includes(q) || (p.city ?? "").toLowerCase().includes(q) || (p.address ?? "").toLowerCase().includes(q);
      return ok && match;
    })
    .sort((a, b) => {
      if (sortBy === "progress") return b.progress - a.progress;
      if (sortBy === "name")     return a.name.localeCompare(b.name);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-widest text-ink-soft">Gestão</div>
        <h1 className="font-serif text-3xl tracking-tight">Todos os processos</h1>
        <p className="mt-1 text-sm text-ink-soft">{properties.length} processos cadastrados · sincronizado em tempo real</p>
      </div>

      {/* Barra de ações */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm">
          <Search className="h-3.5 w-3.5 text-ink-soft" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar imóvel, cidade…"
            className="w-48 bg-transparent outline-none placeholder:text-ink-soft/60 text-sm"
          />
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-2 text-sm">
          <Filter className="h-3.5 w-3.5 text-ink-soft" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-transparent text-sm outline-none cursor-pointer text-ink-soft"
          >
            <option value="all">Todos os status</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-2 text-sm">
          <ChevronDown className="h-3.5 w-3.5 text-ink-soft" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-transparent text-sm outline-none cursor-pointer text-ink-soft"
          >
            <option value="created_at">Mais recentes</option>
            <option value="progress">Progresso</option>
            <option value="name">Nome</option>
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2 text-xs text-ink-soft">
          <span>{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
          <button onClick={exportCsv} disabled={filtered.length === 0} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 hover:border-foreground/30 disabled:opacity-40 transition-colors">
            <Download className="h-3 w-3" /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-3xl bg-background ring-1 ring-border overflow-hidden">
        <div className="hidden sm:grid sm:grid-cols-[2fr_1fr_120px_160px_120px_80px] gap-4 border-b border-border px-6 py-3 text-[11px] uppercase tracking-wider text-ink-soft">
          <span>Imóvel</span>
          <span>Localidade</span>
          <span>Status</span>
          <span>Progresso</span>
          <span>Etapa</span>
          <span></span>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-ink-soft" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center text-sm text-ink-soft">
            {search ? "Nenhum processo encontrado para essa busca." : "Nenhum processo cadastrado ainda."}
          </div>
        ) : (
          <ul>
            {filtered.map((p, i) => (
              <motion.li
                key={p.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.18, delay: Math.min(i * 0.02, 0.3) }}
                onClick={() => navigate({ to: "/admin/projeto/$id", params: { id: p.id } })}
                className="grid cursor-pointer grid-cols-1 sm:grid-cols-[2fr_1fr_120px_160px_120px_80px] gap-4 items-center border-b border-border/50 px-6 py-4 last:border-0 hover:bg-surface/40 transition-colors"
              >
                {/* Imóvel */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface ring-1 ring-border">
                    <Building2 className="h-4 w-4 text-ink-soft" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-xs text-ink-soft truncate">{p.address}</div>
                  </div>
                </div>

                {/* Localidade */}
                <div className="text-sm text-ink-soft">
                  <span>{p.city}</span>
                  {p.state && <span className="ml-1 text-[11px]">· {p.state}</span>}
                </div>

                {/* Status badge */}
                <div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${STATUS_BG[p.status] ?? "bg-surface text-ink-soft"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[p.status] ?? "bg-ink-soft"}`} />
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                </div>

                {/* Progresso */}
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
                    <motion.div
                      className="h-full rounded-full bg-accent"
                      initial={{ width: 0 }}
                      animate={{ width: `${p.progress}%` }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: i * 0.02 }}
                    />
                  </div>
                  <span className="w-9 text-right text-xs text-ink-soft">{p.progress}%</span>
                </div>

                {/* Etapa */}
                <div className="text-sm">
                  <span className="font-medium">{p.current_stage}</span>
                  <span className="text-ink-soft"> / 5</span>
                </div>

                {/* Ação */}
                <div>
                  <Link
                    to="/admin/projeto/$id"
                    params={{ id: p.id }}
                    onClick={(e) => e.stopPropagation()}
                    className="grid h-8 w-8 place-items-center rounded-full bg-foreground text-background hover:bg-foreground/80 transition-colors"
                    title="Abrir processo"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      {/* Status summary */}
      {!loading && properties.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-3">
          {Object.entries(STATUS_LABEL).map(([k, v]) => {
            const count = properties.filter((p) => p.status === k).length;
            return (
              <button
                key={k}
                onClick={() => setFilter(k === filter ? "all" : k)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition-colors ${
                  filter === k ? "bg-foreground text-background" : "border border-border text-ink-soft hover:border-foreground/30"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[k]}`} />
                {v} <span className="font-medium">{count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
