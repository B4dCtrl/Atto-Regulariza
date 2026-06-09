import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, type FormEvent } from "react";
import {
  Briefcase, Building2, Check, CheckCircle2, Clock,
  FileText, Home, Loader2, MessageSquare, Send, Upload, User, Bell,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/painel-profissional")({
  head: () => ({
    meta: [
      { title: "Painel do Profissional — Regulariza" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfissionalPage,
});

type PropertyRow = Tables<"properties">;
type StageRow    = Tables<"process_stages">;
type DocRow      = Tables<"documents">;
type MessageRow  = Tables<"messages">;

const navItems = [
  { icon: Home,          label: "Meus projetos",  id: "projects"  },
  { icon: FileText,      label: "Documentos",     id: "docs"      },
  { icon: MessageSquare, label: "Mensagens",      id: "messages"  },
];

function stateStyle(state: string) {
  switch (state) {
    case "done":   return "bg-foreground text-background";
    case "active": return "bg-accent text-accent-foreground";
    default:       return "bg-surface text-ink-soft ring-1 ring-border";
  }
}

function ProfissionalPage() {
  const [section,           setSection]           = useState("projects");
  const [properties,        setProperties]        = useState<PropertyRow[]>([]);
  const [selectedId,        setSelectedId]        = useState<string | null>(null);
  const [stages,            setStages]            = useState<StageRow[]>([]);
  const [docs,              setDocs]              = useState<DocRow[]>([]);
  const [msgs,              setMsgs]              = useState<MessageRow[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [loadingDetail,     setLoadingDetail]     = useState(false);
  const [chatInput,         setChatInput]         = useState("");
  const [sendingMsg,        setSendingMsg]        = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const selectedProp = properties.find((p) => p.id === selectedId) ?? null;

  /* ── Load all properties ── */
  useEffect(() => {
    supabase.from("properties").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      if (data) {
        setProperties(data);
        if (data.length > 0 && !selectedId) setSelectedId(data[0].id);
      }
      setLoading(false);
    });

    const channel = supabase
      .channel("prof-properties")
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Load selected property detail ── */
  useEffect(() => {
    if (!selectedId) return;
    setLoadingDetail(true);

    Promise.all([
      supabase.from("process_stages").select("*").eq("property_id", selectedId).order("stage_number"),
      supabase.from("documents").select("*").eq("property_id", selectedId).order("created_at"),
      supabase.from("messages").select("*").eq("property_id", selectedId).order("created_at"),
    ]).then(([{ data: s }, { data: d }, { data: m }]) => {
      if (s) setStages(s);
      if (d) setDocs(d);
      if (m) setMsgs(m);
      setLoadingDetail(false);
    });

    const channel = supabase
      .channel(`prof-detail-${selectedId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "process_stages", filter: `property_id=eq.${selectedId!}` }, ({ eventType, new: next, old: prev }) => {
        setStages((cur) => {
          if (eventType === "DELETE") return cur.filter((s) => s.id !== (prev as StageRow).id);
          const row = next as StageRow;
          if (eventType === "INSERT") return [...cur, row].sort((a, b) => a.stage_number - b.stage_number);
          return cur.map((s) => s.id === row.id ? row : s);
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `property_id=eq.${selectedId!}` }, ({ new: next }) => {
        if (next) {
          setMsgs((m) => [...m, next as MessageRow]);
          setTimeout(() => chatRef.current?.scrollTo({ top: 9e9, behavior: "smooth" }), 50);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "documents", filter: `property_id=eq.${selectedId!}` }, ({ eventType, new: next, old: prev }) => {
        setDocs((cur) => {
          if (eventType === "DELETE") return cur.filter((d) => d.id !== (prev as DocRow).id);
          const row = next as DocRow;
          if (eventType === "INSERT") return [...cur, row];
          return cur.map((d) => d.id === row.id ? row : d);
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedId]);

  /* ── Recalculate property progress after any stage change ── */
  const recalcProgress = async (stageId: string, newState: string) => {
    const stageNow = stages.find((s) => s.id === stageId);
    if (!stageNow || !selectedProp) return;

    // Count done stages, treating the current stage with its new state
    const doneCount = stages.filter((s) => {
      if (s.id === stageId) return newState === "done";
      return s.state === "done";
    }).length;

    const progress     = Math.round((doneCount / 5) * 100);
    const currentStage = stages.find((s) => s.state !== "done" && s.id !== stageId || (s.id === stageId && newState !== "done"))?.stage_number ?? 5;
    const allDone      = stages.every((s) => s.id === stageId ? newState === "done" : s.state === "done");

    await supabase.from("properties").update({
      progress,
      current_stage: Math.max(1, currentStage),
      status: allDone ? "entregue" : selectedProp.status === "entregue" ? "profissional" : selectedProp.status,
      updated_at: new Date().toISOString(),
    }).eq("id", selectedId!);
  };

  /* ── Advance stage (pending → active → done) ── */
  const advanceStage = async (stage: StageRow) => {
    if (stage.state === "done") return;
    const newState = stage.state === "pending" ? "active" : "done";
    await supabase.from("process_stages").update({
      state: newState,
      completed_at: newState === "done" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", stage.id);
    await recalcProgress(stage.id, newState);
  };

  /* ── Revert stage (done → active → pending) — sempre disponível ── */
  const revertStage = async (stage: StageRow) => {
    if (stage.state === "pending") return;
    const newState = stage.state === "done" ? "active" : "pending";
    await supabase.from("process_stages").update({
      state: newState,
      completed_at: null,
      updated_at: new Date().toISOString(),
    }).eq("id", stage.id);
    await recalcProgress(stage.id, newState);
  };

  /* ── Approve document ── */
  const approveDoc = async (doc: DocRow) => {
    await supabase.from("documents").update({
      status: "Aprovado",
      updated_at: new Date().toISOString(),
    }).eq("id", doc.id);
  };

  /* ── Upload document ── */
  const addFiles = async (files: FileList | null) => {
    if (!files || !selectedId) return;
    const inserts = Array.from(files).map((f) => ({
      property_id: selectedId,
      name: f.name,
      size_text: `${Math.max(1, Math.round(f.size / 1024))} KB`,
      status: "Enviado",
    }));
    await supabase.from("documents").insert(inserts);
  };

  /* ── Send message ── */
  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || sendingMsg || !selectedId) return;
    setSendingMsg(true);
    setChatInput("");
    await supabase.from("messages").insert({
      property_id: selectedId,
      sender_name: "Carla Rocha",
      content: text,
      is_client: false,
    });
    setSendingMsg(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface/50">
        <Loader2 className="h-8 w-8 animate-spin text-ink-soft" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface/50 text-foreground">
      {/* Topbar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-foreground text-background">
              <span className="font-serif text-lg leading-none">R</span>
            </div>
            <span className="font-serif text-xl tracking-tight hidden sm:inline">Regulariza</span>
          </Link>
          <div className="h-5 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-2 text-sm">
            <Briefcase className="h-4 w-4 text-ink-soft" />
            <span className="font-medium">Painel do Profissional</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface-elevated">
              <Bell className="h-4 w-4 text-ink-soft" />
            </button>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-background text-xs font-medium">
              CR
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="group sticky top-14 hidden h-[calc(100vh-3.5rem)] w-16 shrink-0 md:block">
          <div className="absolute inset-y-0 left-0 z-20 flex w-16 flex-col overflow-hidden border-r border-border bg-background p-3 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:w-60 group-hover:shadow-[8px_0_32px_-12px_oklch(0.16_0.01_60_/_0.18)]">
            <nav className="space-y-1">
              {navItems.map((it) => (
                <button key={it.id} onClick={() => setSection(it.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${section === it.id ? "bg-foreground text-background" : "text-ink-soft hover:bg-surface"}`}
                >
                  <it.icon className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">{it.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            {/* Property list */}
            <aside className="space-y-2">
              <div className="mb-3 text-[10px] uppercase tracking-widest text-ink-soft">
                {properties.length} processos
              </div>
              {properties.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedId(p.id); setSection("projects"); }}
                  className={`w-full rounded-2xl p-3 text-left ring-1 transition-all ${
                    selectedId === p.id
                      ? "bg-foreground text-background ring-foreground"
                      : "bg-background ring-border hover:ring-foreground/30"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <Building2 className="h-4 w-4 shrink-0 mt-0.5 opacity-70" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className={`text-xs mt-0.5 ${selectedId === p.id ? "text-background/60" : "text-ink-soft"}`}>
                        {p.city} · {p.state}
                      </div>
                      <div className="mt-2 h-1 w-full rounded-full overflow-hidden bg-background/20">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${p.progress}%` }}
                        />
                      </div>
                      <div className={`mt-1 text-[11px] ${selectedId === p.id ? "text-background/60" : "text-ink-soft"}`}>
                        {p.progress}% · etapa {p.current_stage} de 5
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </aside>

            {/* Detail pane */}
            <div>
              {!selectedProp ? (
                <div className="flex h-60 items-center justify-center text-sm text-ink-soft">
                  Selecione um processo à esquerda.
                </div>
              ) : loadingDetail ? (
                <div className="flex h-60 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-ink-soft" />
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  {section === "projects" && (
                    <motion.div key={`proj-${selectedId}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="space-y-4">
                      {/* Property header */}
                      <div className="rounded-3xl bg-background ring-1 ring-border p-6">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-4">
                            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-foreground text-background">
                              <Building2 className="h-6 w-6" />
                            </div>
                            <div>
                              <div className="text-xs text-ink-soft">Processo em andamento</div>
                              <h2 className="font-serif text-2xl tracking-tight">{selectedProp.name}</h2>
                              <div className="text-sm text-ink-soft mt-0.5">
                                {selectedProp.address} · {selectedProp.city} · {selectedProp.state}
                              </div>
                            </div>
                          </div>
                          <span className="text-xs rounded-full bg-foreground text-background px-3 py-1.5 flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                            {selectedProp.progress}% concluído
                          </span>
                        </div>
                        <div className="mt-4">
                          <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
                            <motion.div
                              animate={{ width: `${selectedProp.progress}%` }}
                              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                              className="h-full rounded-full bg-accent"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Stages — professional can advance each stage */}
                      <div className="rounded-3xl bg-background ring-1 ring-border p-6">
                        <div className="mb-4 flex items-center justify-between">
                          <div>
                            <div className="text-xs text-ink-soft">Etapas do processo</div>
                            <h3 className="font-serif text-xl tracking-tight">Avance as etapas conforme o andamento</h3>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {stages.map((s) => (
                            <div key={s.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3">
                              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm ${stateStyle(s.state)}`}>
                                {s.state === "done" ? <Check className="h-4 w-4" /> : s.stage_number}
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-medium">{s.label}</div>
                                <div className="text-xs text-ink-soft">
                                  {s.state === "done" ? "Concluído" : s.state === "active" ? "Em andamento" : "Aguardando"}
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                {s.state !== "done" && (
                                  <button
                                    onClick={() => advanceStage(s)}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-ink-soft hover:bg-foreground hover:text-background hover:border-foreground transition-colors"
                                  >
                                    <CheckCircle2 className="h-3 w-3" />
                                    {s.state === "pending" ? "Iniciar" : "Concluir"}
                                  </button>
                                )}
                                {s.state !== "pending" && (
                                  <button
                                    onClick={() => revertStage(s)}
                                    title="Desfazer etapa"
                                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-ink-soft hover:bg-surface hover:border-foreground/30 transition-colors"
                                  >
                                    ↩ Desfazer
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Notes */}
                      {selectedProp.next_action && (
                        <div className="rounded-3xl bg-foreground text-background p-5">
                          <div className="text-[10px] uppercase tracking-widest text-background/60">Ação pendente do cliente</div>
                          <div className="mt-1 font-serif text-lg">{selectedProp.next_action}</div>
                          {selectedProp.next_action_deadline && (
                            <div className="mt-1 text-xs text-background/70">
                              Prazo: {new Date(selectedProp.next_action_deadline).toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {section === "docs" && (
                    <motion.div key={`docs-${selectedId}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                      <div className="rounded-3xl bg-background ring-1 ring-border p-6">
                        <div className="flex items-center justify-between mb-5">
                          <div>
                            <div className="text-xs text-ink-soft">Documentos</div>
                            <h3 className="font-serif text-xl tracking-tight">{selectedProp.name}</h3>
                          </div>
                          <button onClick={() => fileRef.current?.click()}
                            className="inline-flex items-center gap-2 rounded-full bg-foreground py-2 pl-4 pr-2 text-sm text-background">
                            Enviar <span className="grid h-7 w-7 place-items-center rounded-full bg-accent"><Upload className="h-3.5 w-3.5" /></span>
                          </button>
                          <input ref={fileRef} type="file" multiple className="hidden"
                            onChange={(e) => addFiles(e.target.files)} />
                        </div>
                        <ul className="space-y-2">
                          {docs.map((d) => (
                            <li key={d.id} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2.5">
                              <span className="grid h-8 w-8 place-items-center rounded-lg bg-background ring-1 ring-border">
                                <FileText className="h-4 w-4 text-ink-soft" />
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{d.name}</div>
                                <div className="text-xs text-ink-soft">{d.size_text ?? "—"}</div>
                              </div>
                              <span className={`rounded-full px-2.5 py-1 text-[11px] ${
                                d.status === "Aprovado" ? "bg-accent/15 text-accent"
                                : d.status === "Em análise" ? "bg-foreground text-background"
                                : "bg-surface text-ink-soft ring-1 ring-border"
                              }`}>{d.status}</span>
                              {d.status === "Enviado" && (
                                <button onClick={() => approveDoc(d)}
                                  className="text-xs rounded-full bg-accent/15 text-accent px-2.5 py-1 hover:bg-accent hover:text-accent-foreground transition-colors">
                                  Aprovar
                                </button>
                              )}
                            </li>
                          ))}
                          {docs.length === 0 && (
                            <li className="py-8 text-center text-sm text-ink-soft">Nenhum documento ainda.</li>
                          )}
                        </ul>
                      </div>
                    </motion.div>
                  )}

                  {section === "messages" && (
                    <motion.div key={`msgs-${selectedId}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                      <div className="rounded-3xl bg-background ring-1 ring-border overflow-hidden flex flex-col" style={{ height: "calc(100vh - 12rem)" }}>
                        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                          <div className="grid h-9 w-9 place-items-center rounded-full bg-surface ring-1 ring-border">
                            <User className="h-4 w-4 text-ink-soft" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">Cliente · {selectedProp.name}</div>
                            <div className="text-xs text-ink-soft">{selectedProp.city}</div>
                          </div>
                        </div>
                        <div ref={chatRef} className="flex-1 overflow-y-auto p-5 space-y-3">
                          {msgs.map((m) => (
                            <div key={m.id} className={`flex ${m.is_client ? "justify-start" : "justify-end"}`}>
                              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                m.is_client
                                  ? "rounded-bl-md bg-surface text-foreground"
                                  : "rounded-br-md bg-accent text-accent-foreground"
                              }`}>
                                {m.is_client && <div className="mb-0.5 text-[11px] font-medium opacity-60">{m.sender_name}</div>}
                                {m.content}
                              </div>
                            </div>
                          ))}
                          {msgs.length === 0 && (
                            <div className="flex h-32 items-center justify-center text-sm text-ink-soft">
                              Nenhuma mensagem ainda.
                            </div>
                          )}
                        </div>
                        <form onSubmit={sendMessage} className="flex items-center gap-3 border-t border-border p-4">
                          <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Escreva uma mensagem para o cliente…"
                            className="flex-1 rounded-full bg-surface px-5 py-2.5 text-sm outline-none placeholder:text-ink-soft/60"
                            disabled={sendingMsg} />
                          <button type="submit" disabled={sendingMsg || !chatInput.trim()}
                            className="grid h-10 w-10 place-items-center rounded-full bg-foreground text-background disabled:opacity-40">
                            {sendingMsg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          </button>
                        </form>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between text-xs text-ink-soft">
            <span>Sincronizado em tempo real · Supabase</span>
            <Link to="/" className="hover:text-foreground">Voltar para o site</Link>
          </div>
        </main>
      </div>
    </div>
  );
}
