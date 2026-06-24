import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import {
  Upload, FileText, Trash2, Search, FolderOpen,
} from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/documentos-padrao")({
  head: () => ({ meta: [{ title: "Documentos Padrão — Ato Regulariza" }] }),
  component: DocumentosPadraoPage,
});

/* ──────── Types */
type DocCategory = "Contrato" | "Formulário" | "Checklist" | "Modelo Técnico" | "Orientação";

interface PadraoDoc {
  id: string;
  name: string;
  category: DocCategory;
  description: string;
  size: string;
  uploadedAt: string;
}

/* ──────── Constants */
const CATEGORIES: DocCategory[] = [
  "Contrato", "Formulário", "Checklist", "Modelo Técnico", "Orientação",
];

const CAT_CLS: Record<DocCategory, string> = {
  "Contrato":       "bg-blue-50 text-blue-700",
  "Formulário":     "bg-purple-50 text-purple-700",
  "Checklist":      "bg-green-50 text-green-700",
  "Modelo Técnico": "bg-orange-50 text-orange-700",
  "Orientação":     "bg-yellow-50 text-yellow-700",
};

/* ──────── Component */
function DocumentosPadraoPage() {
  const [docs,      setDocs]      = useState<PadraoDoc[]>([]);
  const [search,    setSearch]    = useState("");
  const [filterCat, setFilterCat] = useState<DocCategory | "all">("all");
  const [uploading, setUploading] = useState(false);
  const [newCat,    setNewCat]    = useState<DocCategory>("Formulário");
  const [newDesc,   setNewDesc]   = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadDocs() {
    const { data } = await supabase
      .from("document_templates")
      .select("*")
      .order("created_at", { ascending: false });
    setDocs((data ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      category: (d.category as DocCategory) ?? "Orientação",
      description: d.description ?? "",
      size: d.size_text ?? "—",
      uploadedAt: d.created_at.slice(0, 10),
    })));
  }

  useEffect(() => { loadDocs(); }, []);

  async function addDoc(doc: { name: string; category: DocCategory; description: string; size: string }) {
    await supabase.from("document_templates").insert({
      name: doc.name,
      category: doc.category,
      description: doc.description,
      size_text: doc.size,
    });
    await loadDocs();
  }

  async function removeDoc(id: string) {
    await supabase.from("document_templates").delete().eq("id", id);
    await loadDocs();
  }

  const filtered = docs.filter((d) => {
    const okCat  = filterCat === "all" || d.category === filterCat;
    const q      = search.toLowerCase();
    const okSrch = !q || d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q);
    return okCat && okSrch;
  });

  const upload = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    for (const f of Array.from(files)) {
      await addDoc({
        name:        f.name,
        category:    newCat,
        description: newDesc.trim() || "Documento da biblioteca padrão.",
        size:        `${Math.max(1, Math.round(f.size / 1024))} KB`,
      });
    }
    setNewDesc("");
    setUploading(false);
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este documento da biblioteca?")) return;
    await removeDoc(id);
  };

  return (
    <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-widest text-ink-soft">Biblioteca</div>
        <h1 className="font-serif text-3xl tracking-tight">Documentos Padrão</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {docs.length} documento{docs.length !== 1 ? "s" : ""} · templates, contratos e guias operacionais
        </p>
      </div>

      {/* Upload card */}
      <div className="mb-6 rounded-3xl bg-background ring-1 ring-border p-5">
        <div className="mb-3 text-sm font-medium">Adicionar documento</div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-40">
            <label className="mb-1 block text-xs text-ink-soft">Categoria</label>
            <select
              value={newCat}
              onChange={(e) => setNewCat(e.target.value as DocCategory)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none cursor-pointer"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex-[2] min-w-52">
            <label className="mb-1 block text-xs text-ink-soft">Descrição (opcional)</label>
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Breve descrição do conteúdo do arquivo..."
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-foreground/30 placeholder:text-ink-soft/50"
            />
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm text-background hover:bg-foreground/90 disabled:opacity-50 transition-colors"
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Enviando…" : "Selecionar arquivo"}
          </button>
          <input
            ref={fileRef} type="file" multiple className="hidden"
            onChange={(e) => upload(e.target.files)}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2">
          <Search className="h-3.5 w-3.5 text-ink-soft" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar documento…"
            className="w-44 bg-transparent text-sm outline-none placeholder:text-ink-soft/60"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", ...CATEGORIES] as const).map((c) => {
            const count = c === "all" ? docs.length : docs.filter((d) => d.category === c).length;
            return (
              <button
                key={c}
                onClick={() => setFilterCat(c)}
                className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                  filterCat === c
                    ? "bg-foreground text-background"
                    : "border border-border text-ink-soft hover:border-foreground/30"
                }`}
              >
                {c === "all" ? "Todos" : c}{" "}
                <span className="ml-1 opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
        <span className="ml-auto text-xs text-ink-soft">
          {filtered.length} documento{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl bg-background ring-1 ring-border py-16 text-center">
          <FolderOpen className="mx-auto h-8 w-8 text-ink-soft/40" />
          <div className="mt-3 text-sm text-ink-soft">Nenhum documento encontrado.</div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((d, i) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, delay: Math.min(i * 0.03, 0.3) }}
              className="rounded-2xl bg-background ring-1 ring-border p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface ring-1 ring-border">
                  <FileText className="h-5 w-5 text-ink-soft" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium leading-tight line-clamp-2">{d.name}</div>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] ${CAT_CLS[d.category]}`}>
                    {d.category}
                  </span>
                </div>
              </div>
              <p className="text-xs text-ink-soft leading-relaxed line-clamp-2 mb-3">{d.description}</p>
              <div className="flex items-center justify-between text-xs text-ink-soft">
                <span>{d.size} · {d.uploadedAt}</span>
                <div className="flex items-center gap-1">
                  <button
                    title="Remover"
                    onClick={() => remove(d.id)}
                    className="grid h-7 w-7 place-items-center rounded-lg text-ink-soft hover:bg-surface hover:text-foreground transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
