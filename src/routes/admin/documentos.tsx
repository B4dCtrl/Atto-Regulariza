import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  FileText, Loader2, Search, Upload, Check,
  Clock, AlertCircle, Download, Trash2,
} from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/admin/documentos")({
  head: () => ({ meta: [{ title: "Documentos — Gestão Regulariza" }] }),
  component: DocumentosPage,
});

type DocRow  = Tables<"documents">;
type PropRow = Tables<"properties">;

const STATUS_STYLE: Record<string, string> = {
  Aprovado:     "bg-green-50 text-green-700",
  "Em análise": "bg-foreground text-background",
  Enviado:      "bg-surface text-ink-soft ring-1 ring-border",
  Pendente:     "bg-yellow-50 text-yellow-700",
};
const STATUS_ICON: Record<string, React.ElementType> = {
  Aprovado:     Check,
  "Em análise": Clock,
  Enviado:      FileText,
  Pendente:     AlertCircle,
};

function DocumentosPage() {
  const [docs,       setDocs]       = useState<DocRow[]>([]);
  const [props,      setProps]      = useState<PropRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [filterProp, setFilterProp] = useState("all");
  const [filterStat, setFilterStat] = useState("all");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading]   = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("documents").select("*").order("created_at", { ascending: false }),
      supabase.from("properties").select("id,name").order("name"),
    ]).then(([{ data: d }, { data: p }]) => {
      if (d) setDocs(d);
      if (p) setProps(p as PropRow[]);
      setLoading(false);
    });

    const ch = supabase
      .channel("docs-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, ({ eventType, new: next, old: prev }) => {
        setDocs((cur) => {
          if (eventType === "DELETE") return cur.filter((d) => d.id !== (prev as DocRow).id);
          const row = next as DocRow;
          if (eventType === "INSERT") return [row, ...cur];
          return cur.map((d) => d.id === row.id ? row : d);
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = docs.filter((d) => {
    const okProp = filterProp === "all" || d.property_id === filterProp;
    const okStat = filterStat === "all" || d.status === filterStat;
    const q = search.toLowerCase();
    const okSearch = !q || d.name.toLowerCase().includes(q);
    return okProp && okStat && okSearch;
  });

  const approve = (id: string) =>
    supabase.from("documents").update({ status: "Aprovado", updated_at: new Date().toISOString() }).eq("id", id);

  const analyze = (id: string) =>
    supabase.from("documents").update({ status: "Em análise", updated_at: new Date().toISOString() }).eq("id", id);

  const remove = async (id: string) => {
    if (!confirm("Remover este documento?")) return;
    await supabase.from("documents").delete().eq("id", id);
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files || !props.length) return;
    const propId = filterProp !== "all" ? filterProp : props[0].id;
    setUploading(true);
    await supabase.from("documents").insert(
      Array.from(files).map((f) => ({
        property_id: propId,
        name: f.name,
        size_text: `${Math.max(1, Math.round(f.size / 1024))} KB`,
        status: "Enviado",
      }))
    );
    setUploading(false);
  };

  const propName = (id: string) => props.find((p) => p.id === id)?.name ?? "—";

  const statuses = ["Enviado", "Em análise", "Aprovado", "Pendente"];

  return (
    <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-ink-soft">Gestão</div>
          <h1 className="font-serif text-3xl tracking-tight">Central de documentos</h1>
          <p className="mt-1 text-sm text-ink-soft">{docs.length} documentos · todos os processos</p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading || !props.length}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm text-background hover:bg-foreground/90 disabled:opacity-50 transition-colors"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Enviar documento
        </button>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => uploadFiles(e.target.files)} />
      </div>

      {/* Filtros */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2">
          <Search className="h-3.5 w-3.5 text-ink-soft" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar documento…"
            className="w-40 bg-transparent text-sm outline-none placeholder:text-ink-soft/60"
          />
        </div>

        <select
          value={filterProp}
          onChange={(e) => setFilterProp(e.target.value)}
          className="rounded-full border border-border bg-background px-4 py-2 text-sm text-ink-soft outline-none cursor-pointer"
        >
          <option value="all">Todos os imóveis</option>
          {props.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <select
          value={filterStat}
          onChange={(e) => setFilterStat(e.target.value)}
          className="rounded-full border border-border bg-background px-4 py-2 text-sm text-ink-soft outline-none cursor-pointer"
        >
          <option value="all">Todos os status</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <span className="ml-auto text-xs text-ink-soft">{filtered.length} documento{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Status tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {["all", ...statuses].map((s) => {
          const count = s === "all" ? docs.length : docs.filter((d) => d.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilterStat(s)}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                filterStat === s ? "bg-foreground text-background" : "border border-border text-ink-soft hover:border-foreground/30"
              }`}
            >
              {s === "all" ? "Todos" : s} <span className="ml-1 opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Lista */}
      <div className="rounded-3xl bg-background ring-1 ring-border overflow-hidden">
        <div className="hidden sm:grid sm:grid-cols-[2fr_1fr_120px_200px] gap-4 border-b border-border px-6 py-3 text-[11px] uppercase tracking-wider text-ink-soft">
          <span>Documento</span>
          <span>Imóvel</span>
          <span>Status</span>
          <span>Ações</span>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-ink-soft" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center text-sm text-ink-soft">
            Nenhum documento encontrado.
          </div>
        ) : (
          <ul>
            {filtered.map((d, i) => {
              const Icon = STATUS_ICON[d.status] ?? FileText;
              return (
                <motion.li
                  key={d.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, delay: Math.min(i * 0.015, 0.25) }}
                  className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_120px_200px] gap-4 items-center border-b border-border/50 px-6 py-4 last:border-0 hover:bg-surface/40 transition-colors"
                >
                  {/* Doc */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface ring-1 ring-border">
                      <FileText className="h-4 w-4 text-ink-soft" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{d.name}</div>
                      <div className="text-xs text-ink-soft">{d.size_text ?? "—"} · {new Date(d.created_at).toLocaleDateString("pt-BR")}</div>
                    </div>
                  </div>

                  {/* Imóvel */}
                  <div className="text-sm text-ink-soft truncate">{propName(d.property_id)}</div>

                  {/* Status */}
                  <div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ${STATUS_STYLE[d.status] ?? "bg-surface text-ink-soft"}`}>
                      <Icon className="h-3 w-3" />
                      {d.status}
                    </span>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2">
                    {d.status === "Enviado" && (
                      <button onClick={() => analyze(d.id)}
                        className="rounded-full border border-border px-3 py-1 text-[11px] text-ink-soft hover:bg-surface transition-colors">
                        Analisar
                      </button>
                    )}
                    {(d.status === "Enviado" || d.status === "Em análise") && (
                      <button onClick={() => approve(d.id)}
                        className="rounded-full bg-accent/10 px-3 py-1 text-[11px] text-accent hover:bg-accent hover:text-accent-foreground transition-colors">
                        Aprovar
                      </button>
                    )}
                    <button onClick={() => remove(d.id)}
                      className="grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:bg-surface hover:text-foreground transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    {d.file_path && (
                      <a href={d.file_path} target="_blank" rel="noreferrer"
                        className="grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:bg-surface transition-colors">
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
