import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect, type DragEvent, type ChangeEvent, type FormEvent } from "react";
import {
  Home, FileText, MessageSquare, User, History, Bell, Search,
  Check, Clock, Upload, AlertCircle, ArrowUpRight,
  Building2, Calendar, TrendingUp, Send, X, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { TourProvider, TourAlertDialog, useTour, TourHelpButton } from "@/components/ui/tour";
import { getTourSteps, TOUR_TOPICS } from "@/components/onboarding/TourTopics";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel — Regulariza" },
      { name: "description", content: "Acompanhe sua regularização em tempo real, envie documentos e converse com seu especialista." },
    ],
  }),
  component: DashboardPage,
});

// UUID fixo do imóvel demo — espelhado no SQL seed
const DEMO_PROPERTY_ID = "11111111-1111-1111-1111-111111111111";

type PropertyRow    = Tables<"properties">;
type StageRow       = Tables<"process_stages">;
type DocRow         = Tables<"documents">;
type MessageRow     = Tables<"messages">;

const navItems = [
  { icon: Home,          label: "Visão geral",  id: "overview"   },
  { icon: FileText,      label: "Documentos",   id: "docs"        },
  { icon: MessageSquare, label: "Mensagens",    id: "messages"    },
  { icon: User,          label: "Profissional", id: "professional"},
  { icon: History,       label: "Histórico",    id: "history"     },
];

function statusStyle(s: string) {
  switch (s) {
    case "Aprovado":   return "bg-accent/15 text-accent";
    case "Em análise": return "bg-foreground text-background";
    case "Pendente":   return "bg-surface text-ink-soft";
    case "Enviado":    return "bg-border text-foreground";
    default:           return "bg-surface text-ink-soft";
  }
}

function DashboardContent() {
  const [showTourDialog, setShowTourDialog] = useState(true);
  const [activeSection, setActiveSection] = useState<string>("overview");
  const [property, setProperty]           = useState<PropertyRow | null>(null);
  const [stages,   setStages]             = useState<StageRow[]>([]);
  const [docs,     setDocs]               = useState<DocRow[]>([]);
  const [msgs,     setMsgs]               = useState<MessageRow[]>([]);
  const [loading,  setLoading]            = useState(true);
  const [dragOver, setDragOver]           = useState(false);
  const [chatInput, setChatInput]         = useState("");
  const [sendingMsg, setSendingMsg]       = useState(false);
  const fileRef   = useRef<HTMLInputElement>(null);
  const chatRef   = useRef<HTMLDivElement>(null);

  /* ── Initial load ── */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [{ data: prop }, { data: stagesData }, { data: docsData }, { data: msgsData }] =
        await Promise.all([
          supabase.from("properties").select("*").eq("id", DEMO_PROPERTY_ID).single(),
          supabase.from("process_stages").select("*").eq("property_id", DEMO_PROPERTY_ID).order("stage_number"),
          supabase.from("documents").select("*").eq("property_id", DEMO_PROPERTY_ID).order("created_at"),
          supabase.from("messages").select("*").eq("property_id", DEMO_PROPERTY_ID).order("created_at"),
        ]);
      if (cancelled) return;
      if (prop)       setProperty(prop);
      if (stagesData) setStages(stagesData);
      if (docsData)   setDocs(docsData);
      if (msgsData)   setMsgs(msgsData);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  /* ── Realtime subscriptions ── */
  useEffect(() => {
    const channel = supabase
      .channel(`dashboard-${DEMO_PROPERTY_ID}`)
      /* property progress/status changes → barra de progresso atualiza */
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "properties", filter: `id=eq.${DEMO_PROPERTY_ID}` },
        ({ new: next }) => { if (next) setProperty(next as PropertyRow); }
      )
      /* stage changes → timeline atualiza */
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "process_stages", filter: `property_id=eq.${DEMO_PROPERTY_ID}` },
        ({ eventType, new: next, old: prev }) => {
          setStages((cur) => {
            if (eventType === "DELETE") return cur.filter((s) => s.id !== (prev as StageRow).id);
            const without = cur.filter((s) => s.id !== (next as StageRow).id);
            return [...without, next as StageRow].sort((a, b) => a.stage_number - b.stage_number);
          });
        }
      )
      /* new documents */
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "documents", filter: `property_id=eq.${DEMO_PROPERTY_ID}` },
        ({ new: next }) => { if (next) setDocs((d) => [...d, next as DocRow]); }
      )
      /* document status updates (admin approves) */
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "documents", filter: `property_id=eq.${DEMO_PROPERTY_ID}` },
        ({ new: next }) => {
          if (next) setDocs((d) => d.map((doc) => doc.id === (next as DocRow).id ? next as DocRow : doc));
        }
      )
      /* new messages */
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `property_id=eq.${DEMO_PROPERTY_ID}` },
        ({ new: next }) => {
          if (next) {
            setMsgs((m) => [...m, next as MessageRow]);
            setTimeout(() => chatRef.current?.scrollTo({ top: 9e9, behavior: "smooth" }), 50);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  /* ── Scroll chat on msgs change ── */
  useEffect(() => {
    chatRef.current?.scrollTo({ top: 9e9 });
  }, [msgs]);

  /* ── Document upload ── */
  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const inserts = Array.from(files).map((f) => ({
      property_id: DEMO_PROPERTY_ID,
      name: f.name,
      size_text: `${Math.max(1, Math.round(f.size / 1024))} KB`,
      status: "Enviado",
    }));
    const { data } = await supabase.from("documents").insert(inserts).select();
    if (data) setDocs((d) => [...d, ...data]);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  /* ── Send message ── */
  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || sendingMsg) return;
    setSendingMsg(true);
    setChatInput("");
    await supabase.from("messages").insert({
      property_id: DEMO_PROPERTY_ID,
      sender_name: "Marina Silveira",
      content: text,
      is_client: true,
    });
    setSendingMsg(false);
  };

  const progress     = property?.progress      ?? 10;
  const currentStage = property?.current_stage ?? 1;
  const propStatus   = property?.status        ?? "entrada";

  /* ─── Skeleton while loading ─── */
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
      <header id={TOUR_TOPICS.WELCOME} className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-1.5">
            <img src="/logo-ato.png" alt="Ato Regulariza" className="h-7 w-7 rounded-md object-contain" />
            <span className="font-arsenica text-xl leading-none text-accent hidden sm:inline">ato</span>
          </Link>
          <div className="h-5 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 text-ink-soft" />
            <span className="font-medium">{property?.name ?? "Meu Imóvel"}</span>
            <span className="text-ink-soft hidden md:inline">
              / {property?.city} · {property?.state}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button className="hidden md:flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-xs text-ink-soft">
              <Search className="h-3.5 w-3.5" /> Buscar
            </button>
            <button className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface-elevated">
              <Bell className="h-4 w-4 text-ink-soft" />
            </button>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-background text-xs font-medium">
              MS
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar retrátil */}
        <aside className="group sticky top-14 hidden h-[calc(100vh-3.5rem)] w-16 shrink-0 md:block">
          <div
            className="absolute inset-y-0 left-0 z-20 flex w-16 flex-col overflow-hidden border-r border-border
                       bg-background p-3 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
                       group-hover:w-60 group-hover:shadow-[8px_0_32px_-12px_oklch(0.16_0.01_60_/_0.18)]"
          >
            <nav className="space-y-1">
              {navItems.map((it) => (
                <button
                  key={it.id}
                  onClick={() => setActiveSection(it.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    activeSection === it.id ? "bg-foreground text-background" : "text-ink-soft hover:bg-surface"
                  }`}
                >
                  <it.icon className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    {it.label}
                  </span>
                </button>
              ))}
            </nav>

            <div className="mt-6 rounded-2xl border border-border bg-surface-elevated p-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <div className="text-xs text-ink-soft">Próxima ação</div>
              <div className="mt-1 text-sm font-medium leading-snug">
                {property?.next_action ?? "Nenhuma ação pendente"}
              </div>
              {property?.next_action_deadline && (
                <div className="mt-1 text-xs text-ink-soft">
                  até {new Date(property.next_action_deadline).toLocaleDateString("pt-BR")}
                </div>
              )}
              <button
                onClick={() => setActiveSection("docs")}
                className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:underline"
              >
                Enviar agora <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-4 sm:p-8 max-w-6xl mx-auto w-full">

          {/* ── VISÃO GERAL ── */}
          <AnimatePresence mode="wait">
          {activeSection === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              {/* Property header */}
              <section id={TOUR_TOPICS.PROPERTY_FORM} className="rounded-3xl bg-background ring-1 ring-border p-6 sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="grid h-16 w-16 place-items-center rounded-2xl bg-foreground text-background">
                      <Building2 className="h-7 w-7" />
                    </div>
                    <div>
                      <div className="text-xs text-ink-soft">Imóvel em regularização</div>
                      <h1 className="font-serif text-3xl tracking-tight">{property?.name}</h1>
                      <div className="mt-1 text-sm text-ink-soft">
                        {property?.address} · {property?.city} · {property?.state}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-foreground text-background px-3 py-1.5 text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                    {propStatus === "prefeitura" ? "Em tramitação na Prefeitura"
                      : propStatus === "analise"      ? "Em análise"
                      : propStatus === "profissional" ? "Com o profissional"
                      : propStatus === "entregue"     ? "Entregue ✓"
                      : "Entrada recebida"}
                  </div>
                </div>

                <div className="mt-6" id={TOUR_TOPICS.PROGRESS_BAR}>
                  <div className="flex items-center justify-between text-xs text-ink-soft mb-2">
                    <span>Progresso geral</span>
                    <span>{progress}% concluído</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
                    <motion.div
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full rounded-full bg-accent"
                    />
                  </div>
                </div>
              </section>

              {/* Timeline */}
              <section id={TOUR_TOPICS.TIMELINE} className="mt-6 rounded-3xl bg-background ring-1 ring-border p-6 sm:p-8">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-ink-soft">Etapas</div>
                    <h2 className="font-serif text-2xl tracking-tight">Onde sua regularização está</h2>
                  </div>
                  <div className="hidden sm:flex items-center gap-1 text-xs text-ink-soft">
                    <Clock className="h-3.5 w-3.5" />
                    {currentStage < 5 ? `~${(5 - currentStage) * 7} dias para conclusão` : "Concluído!"}
                  </div>
                </div>

                <div className="relative grid gap-6 md:grid-cols-5">
                  <div className="pointer-events-none absolute left-0 right-0 top-5 hidden h-px bg-border md:block" />
                  {stages.map((s, i) => {
                    const isDone   = s.state === "done";
                    const isActive = s.state === "active";
                    return (
                      <motion.div
                        key={s.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: i * 0.06 }}
                        className="relative"
                      >
                        <div
                          className={`grid h-10 w-10 place-items-center rounded-full ring-1 ring-border ${
                            isDone   ? "bg-foreground text-background"
                            : isActive ? "bg-accent text-accent-foreground shadow-[0_0_0_6px_oklch(0.66_0.18_38_/_0.15)]"
                            : "bg-background text-ink-soft"
                          }`}
                        >
                          {isDone ? <Check className="h-4 w-4" /> : <span className="font-serif text-sm">{s.stage_number}</span>}
                        </div>
                        <div className="mt-3 text-sm font-medium">{s.label}</div>
                        <div className="text-xs text-ink-soft mt-0.5">
                          {isDone ? "Concluído" : isActive ? "Em andamento" : "Aguardando"}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </section>

              {/* Grid: Upload + Next action + Metrics + Chat */}
              <div className="mt-6 grid gap-6 lg:grid-cols-3">
                {/* Upload card */}
                <section id={TOUR_TOPICS.DOCUMENTS} className="lg:col-span-2 rounded-3xl bg-background ring-1 ring-border p-6 sm:p-8">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-ink-soft">Documentos</div>
                      <h2 className="font-serif text-2xl tracking-tight">Envie seus documentos</h2>
                    </div>
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="group inline-flex items-center gap-2 rounded-full bg-foreground py-2 pl-4 pr-2 text-sm text-background"
                    >
                      Enviar
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-accent">
                        <Upload className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  </div>

                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                    onClick={() => fileRef.current?.click()}
                    className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-10 text-center transition-colors ${
                      dragOver ? "border-accent bg-accent/5" : "border-border bg-surface/40"
                    }`}
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-accent/15 text-accent">
                      <Upload className="h-5 w-5" />
                    </div>
                    <p className="text-sm">
                      Arraste arquivos aqui ou{" "}
                      <span className="text-accent underline-offset-4 hover:underline">clique para enviar</span>
                    </p>
                    <p className="text-xs text-ink-soft">PDF, JPG ou PNG · até 20 MB</p>
                    <input
                      ref={fileRef} type="file" multiple className="hidden"
                      onChange={(e: ChangeEvent<HTMLInputElement>) => addFiles(e.target.files)}
                    />
                  </div>

                  <ul className="mt-6 space-y-2">
                    {docs.map((d) => (
                      <li key={d.id} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2.5">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-background ring-1 ring-border">
                          <FileText className="h-4 w-4 text-ink-soft" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{d.name}</div>
                          <div className="text-xs text-ink-soft">{d.size_text ?? "—"}</div>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] ${statusStyle(d.status)}`}>
                          {d.status}
                        </span>
                      </li>
                    ))}
                    {docs.length === 0 && (
                      <li className="py-4 text-center text-sm text-ink-soft">
                        Nenhum documento enviado ainda.
                      </li>
                    )}
                  </ul>
                </section>

                {/* Side column */}
                <div className="space-y-6">
                  {/* Next action */}
                  <section className="rounded-3xl bg-foreground text-background p-6">
                    <div className="flex items-center gap-2 text-xs text-background/60">
                      <AlertCircle className="h-3.5 w-3.5" /> O que falta de você
                    </div>
                    <h3 className="mt-2 font-serif text-2xl leading-tight">
                      {property?.next_action
                        ? `${property.next_action} até ${property.next_action_deadline ? new Date(property.next_action_deadline).toLocaleDateString("pt-BR", { day: "numeric", month: "long" }) : ""}`
                        : "Aguardando equipe"}
                    </h3>
                    {property?.next_action && (
                      <button
                        onClick={() => setActiveSection("docs")}
                        className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent text-accent-foreground py-2 pl-4 pr-2 text-sm"
                      >
                        Enviar agora
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-background text-foreground">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    )}
                  </section>

                  {/* Metrics */}
                  <section className="rounded-3xl bg-background ring-1 ring-border p-6">
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { icon: Calendar,    l: "Dias",      v: String(Math.floor((Date.now() - new Date(property?.created_at ?? Date.now()).getTime()) / 86400000)) },
                        { icon: TrendingUp,  l: "Concluído", v: `${progress}%` },
                        { icon: Clock,       l: "Próx. etapa", v: currentStage < 5 ? `~${(5 - currentStage) * 7}d` : "—" },
                      ].map((m) => (
                        <div key={m.l} className="rounded-2xl bg-surface p-3">
                          <m.icon className="h-3.5 w-3.5 text-ink-soft" />
                          <div className="mt-2 font-serif text-2xl leading-none">{m.v}</div>
                          <div className="text-[11px] text-ink-soft mt-1">{m.l}</div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Chat preview */}
                  <section id={TOUR_TOPICS.CHAT} className="rounded-3xl bg-background ring-1 ring-border p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-background text-xs">
                          CR
                        </div>
                        <div>
                          <div className="text-sm font-medium">Carla Rocha</div>
                          <div className="text-xs text-ink-soft">Arquiteta · sua especialista</div>
                        </div>
                      </div>
                      <span className="h-2 w-2 rounded-full bg-accent" />
                    </div>
                    <div className="space-y-2 max-h-32 overflow-hidden">
                      {msgs.slice(-2).map((m) => (
                        <div
                          key={m.id}
                          className={`rounded-2xl px-3 py-2 text-sm ${
                            m.is_client
                              ? "rounded-br-md bg-accent text-accent-foreground ml-auto max-w-[85%]"
                              : "rounded-bl-md bg-surface text-foreground"
                          }`}
                        >
                          {m.content}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setActiveSection("messages")}
                      className="mt-4 w-full rounded-full border border-border bg-surface-elevated py-2 text-xs text-ink-soft hover:border-foreground/30"
                    >
                      Abrir conversa
                    </button>
                  </section>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── DOCUMENTOS (full view) ── */}
          {activeSection === "docs" && (
            <motion.div key="docs" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <section className="rounded-3xl bg-background ring-1 ring-border p-6 sm:p-8">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-ink-soft">Central de documentos</div>
                    <h2 className="font-serif text-2xl tracking-tight">Todos os documentos</h2>
                  </div>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-full bg-foreground py-2 pl-4 pr-2 text-sm text-background"
                  >
                    Enviar
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-accent">
                      <Upload className="h-3.5 w-3.5" />
                    </span>
                  </button>
                </div>

                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-10 mb-6 text-center transition-colors ${
                    dragOver ? "border-accent bg-accent/5" : "border-border bg-surface/40"
                  }`}
                >
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-accent/15 text-accent">
                    <Upload className="h-5 w-5" />
                  </div>
                  <p className="text-sm">
                    Arraste ou <span className="text-accent">clique para enviar</span>
                  </p>
                  <p className="text-xs text-ink-soft">PDF, JPG, PNG · até 20 MB</p>
                  <input ref={fileRef} type="file" multiple className="hidden"
                    onChange={(e: ChangeEvent<HTMLInputElement>) => addFiles(e.target.files)} />
                </div>

                <div className="grid grid-cols-4 gap-3 mb-3 px-3 text-[11px] text-ink-soft uppercase tracking-wider">
                  <span className="col-span-2">Arquivo</span>
                  <span>Tamanho</span>
                  <span>Status</span>
                </div>
                <ul className="space-y-2">
                  {docs.map((d) => (
                    <li key={d.id} className="grid grid-cols-4 items-center gap-3 rounded-xl bg-surface px-3 py-3">
                      <div className="col-span-2 flex items-center gap-3 min-w-0">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-background ring-1 ring-border">
                          <FileText className="h-4 w-4 text-ink-soft" />
                        </span>
                        <span className="text-sm font-medium truncate">{d.name}</span>
                      </div>
                      <span className="text-xs text-ink-soft">{d.size_text ?? "—"}</span>
                      <span className={`justify-self-start rounded-full px-2.5 py-1 text-[11px] ${statusStyle(d.status)}`}>
                        {d.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </motion.div>
          )}

          {/* ── MENSAGENS ── */}
          {activeSection === "messages" && (
            <motion.div key="messages" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <section className="rounded-3xl bg-background ring-1 ring-border overflow-hidden" style={{ height: "calc(100vh - 10rem)" }}>
                <div className="flex h-full flex-col">
                  {/* Header */}
                  <div className="flex items-center gap-3 border-b border-border px-6 py-4">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-foreground text-background text-sm">
                      CR
                    </div>
                    <div>
                      <div className="font-medium">Carla Rocha</div>
                      <div className="text-xs text-ink-soft">Arquiteta · online agora</div>
                    </div>
                    <span className="ml-auto h-2 w-2 rounded-full bg-accent" />
                  </div>

                  {/* Messages */}
                  <div ref={chatRef} className="flex-1 overflow-y-auto p-6 space-y-3">
                    {msgs.map((m) => (
                      <div key={m.id} className={`flex ${m.is_client ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                            m.is_client
                              ? "rounded-br-md bg-accent text-accent-foreground"
                              : "rounded-bl-md bg-surface text-foreground"
                          }`}
                        >
                          {!m.is_client && (
                            <div className="mb-1 text-[11px] font-medium opacity-70">{m.sender_name}</div>
                          )}
                          {m.content}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Input */}
                  <form onSubmit={sendMessage} className="flex items-center gap-3 border-t border-border p-4">
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Escreva uma mensagem…"
                      className="flex-1 rounded-full bg-surface px-5 py-2.5 text-sm outline-none placeholder:text-ink-soft/60"
                      disabled={sendingMsg}
                    />
                    <button
                      type="submit"
                      disabled={sendingMsg || !chatInput.trim()}
                      className="grid h-10 w-10 place-items-center rounded-full bg-foreground text-background disabled:opacity-40"
                    >
                      {sendingMsg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </form>
                </div>
              </section>
            </motion.div>
          )}

          {/* ── PROFISSIONAL ── */}
          {activeSection === "professional" && (
            <motion.div key="professional" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <section className="rounded-3xl bg-background ring-1 ring-border p-6 sm:p-8">
                <div className="text-xs text-ink-soft mb-1">Responsável pelo processo</div>
                <h2 className="font-serif text-2xl tracking-tight mb-6">Seu especialista</h2>
                <div className="flex items-center gap-4 mb-6">
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-foreground text-background text-xl">
                    CR
                  </div>
                  <div>
                    <div className="text-lg font-medium">Carla Rocha</div>
                    <div className="text-sm text-ink-soft">Arquiteta e Urbanista · CAU A-12345-6</div>
                    <div className="mt-1 text-xs text-accent">● Online agora</div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Processos concluídos", value: "48" },
                    { label: "Tempo médio", value: "42 dias" },
                    { label: "Satisfação", value: "4.9/5" },
                  ].map((m) => (
                    <div key={m.label} className="rounded-2xl bg-surface p-4">
                      <div className="font-serif text-3xl">{m.value}</div>
                      <div className="text-xs text-ink-soft mt-1">{m.label}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl bg-surface-elevated p-4 text-sm text-ink-soft">
                  Dúvidas sobre o andamento do seu processo? Use a aba de mensagens ou entre em contato
                  diretamente com a especialista.
                </div>
                <button
                  onClick={() => setActiveSection("messages")}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-sm"
                >
                  <MessageSquare className="h-4 w-4" /> Enviar mensagem
                </button>
              </section>
            </motion.div>
          )}

          {/* ── HISTÓRICO ── */}
          {activeSection === "history" && (
            <motion.div key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <section className="rounded-3xl bg-background ring-1 ring-border p-6 sm:p-8">
                <div className="text-xs text-ink-soft mb-1">Linha do tempo</div>
                <h2 className="font-serif text-2xl tracking-tight mb-6">Histórico do processo</h2>
                <ol className="relative border-l border-border ml-3 space-y-6">
                  {stages.filter((s) => s.state !== "pending").map((s) => (
                    <li key={s.id} className="ml-6">
                      <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background ring-4 ring-background">
                        <Check className="h-3 w-3" />
                      </span>
                      <div className="font-medium">{s.label}</div>
                      <div className="text-xs text-ink-soft mt-0.5">
                        {s.state === "done" ? "Concluído" : "Em andamento"}
                        {s.completed_at && ` · ${new Date(s.completed_at).toLocaleDateString("pt-BR")}`}
                      </div>
                      {s.notes && <div className="mt-1 text-sm text-ink-soft">{s.notes}</div>}
                    </li>
                  ))}
                </ol>
              </section>
            </motion.div>
          )}
          </AnimatePresence>

          <div className="mt-8 flex items-center justify-between text-xs text-ink-soft">
            <span>Sincronizado em tempo real · Supabase</span>
            <Link to="/" className="hover:text-foreground">Voltar para o site</Link>
          </div>
        </main>
      </div>
    </div>
  );
}

function DashboardPage() {
  return (
    <TourProvider onComplete={() => { console.log("Tour completado!"); }}>
      <DashboardContent />
      <DashboardTourSteps />
    </TourProvider>
  );
}

function DashboardTourSteps() {
  const { setSteps } = useTour();

  useEffect(() => {
    setSteps(getTourSteps());
  }, [setSteps]);

  return null;
}
