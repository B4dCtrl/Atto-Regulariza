import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import {
  Home, FileText, MessageSquare, User, History, Bell, Search,
  Check, Clock, Upload, AlertCircle, ArrowUpRight,
  Building2, Calendar, TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel — Regulariza" },
      { name: "description", content: "Acompanhe sua regularização em tempo real, envie documentos e converse com seu especialista." },
    ],
  }),
  component: DashboardPage,
});

const navItems = [
  { icon: Home, label: "Visão geral", active: true },
  { icon: FileText, label: "Documentos" },
  { icon: MessageSquare, label: "Mensagens" },
  { icon: User, label: "Profissional" },
  { icon: History, label: "Histórico" },
];

const stages = [
  { n: 1, label: "Cadastro", state: "done" as const },
  { n: 2, label: "Análise", state: "done" as const },
  { n: 3, label: "Profissional", state: "done" as const },
  { n: 4, label: "Tramitação", state: "active" as const },
  { n: 5, label: "Entrega", state: "pending" as const },
];

type DocStatus = "Aprovado" | "Em análise" | "Pendente" | "Enviado";
const initialDocs: { name: string; status: DocStatus; size: string }[] = [
  { name: "RG do proprietário.pdf", status: "Aprovado", size: "1.2 MB" },
  { name: "Matrícula atualizada.pdf", status: "Em análise", size: "820 KB" },
  { name: "Habite-se", status: "Pendente", size: "—" },
  { name: "Certidão negativa.pdf", status: "Enviado", size: "640 KB" },
];

function statusStyle(s: DocStatus) {
  switch (s) {
    case "Aprovado": return "bg-accent/15 text-accent";
    case "Em análise": return "bg-foreground text-background";
    case "Pendente": return "bg-surface text-ink-soft";
    case "Enviado": return "bg-border text-foreground";
  }
}

function DashboardPage() {
  const [docs, setDocs] = useState(initialDocs);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files).map((f) => ({
      name: f.name,
      status: "Enviado" as DocStatus,
      size: `${Math.max(1, Math.round(f.size / 1024))} KB`,
    }));
    setDocs((d) => [...next, ...d]);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

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
            <Building2 className="h-4 w-4 text-ink-soft" />
            <span className="font-medium">Apto 142 — Vila Madalena</span>
            <span className="text-ink-soft hidden md:inline">/ São Paulo · SP</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button className="hidden md:flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-xs text-ink-soft">
              <Search className="h-3.5 w-3.5" /> Buscar
            </button>
            <button className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface-elevated">
              <Bell className="h-4 w-4 text-ink-soft" />
            </button>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-background text-xs font-medium">MS</div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar retrátil — gutter fixo (w-16), expande no hover sem empurrar conteúdo */}
        <aside className="group sticky top-14 hidden h-[calc(100vh-3.5rem)] w-16 shrink-0 md:block">
          <div
            className="absolute inset-y-0 left-0 z-20 flex w-16 flex-col overflow-hidden border-r border-border
                       bg-background p-3 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
                       group-hover:w-60 group-hover:shadow-[8px_0_32px_-12px_oklch(0.16_0.01_60_/_0.18)]"
          >
            <nav className="space-y-1">
              {navItems.map((it) => (
                <button
                  key={it.label}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    it.active ? "bg-foreground text-background" : "text-ink-soft hover:bg-surface"
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
              <div className="mt-1 text-sm font-medium leading-snug">Enviar Habite-se até 12/06</div>
              <button className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:underline">
                Enviar agora <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 p-4 sm:p-8 max-w-6xl mx-auto w-full">
          {/* Property header */}
          <motion.section
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="rounded-3xl bg-background ring-1 ring-border p-6 sm:p-8"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-foreground text-background">
                  <Building2 className="h-7 w-7" />
                </div>
                <div>
                  <div className="text-xs text-ink-soft">Imóvel em regularização</div>
                  <h1 className="font-serif text-3xl tracking-tight">Apto 142 — Vila Madalena</h1>
                  <div className="mt-1 text-sm text-ink-soft">Rua Harmonia, 142 · São Paulo · SP</div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-foreground text-background px-3 py-1.5 text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                Em tramitação na Prefeitura
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between text-xs text-ink-soft mb-2">
                <span>Progresso geral</span>
                <span>62% concluído</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
                <motion.div
                  initial={{ width: 0 }} animate={{ width: "62%" }}
                  transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full rounded-full bg-accent"
                />
              </div>
            </div>
          </motion.section>

          {/* Stages timeline */}
          <section className="mt-6 rounded-3xl bg-background ring-1 ring-border p-6 sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="text-xs text-ink-soft">Etapas</div>
                <h2 className="font-serif text-2xl tracking-tight">Onde sua regularização está</h2>
              </div>
              <div className="hidden sm:flex items-center gap-1 text-xs text-ink-soft">
                <Clock className="h-3.5 w-3.5" /> ~18 dias para conclusão
              </div>
            </div>

            <div className="relative grid gap-6 md:grid-cols-5">
              <div className="pointer-events-none absolute left-0 right-0 top-5 hidden h-px bg-border md:block" />
              {stages.map((s, i) => {
                const isDone = s.state === "done";
                const isActive = s.state === "active";
                return (
                  <motion.div
                    key={s.n}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: i * 0.06 }}
                    className="relative"
                  >
                    <div
                      className={`grid h-10 w-10 place-items-center rounded-full ring-1 ring-border ${
                        isDone ? "bg-foreground text-background"
                        : isActive ? "bg-accent text-accent-foreground shadow-[0_0_0_6px_oklch(0.66_0.18_38_/_0.15)]"
                        : "bg-background text-ink-soft"
                      }`}
                    >
                      {isDone ? <Check className="h-4 w-4" /> : <span className="font-serif text-sm">{s.n}</span>}
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

          {/* Grid: Upload + Next action + Chat + Metrics */}
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {/* Upload card */}
            <section className="lg:col-span-2 rounded-3xl bg-background ring-1 ring-border p-6 sm:p-8">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="text-xs text-ink-soft">Documentos</div>
                  <h2 className="font-serif text-2xl tracking-tight">Envie seus documentos</h2>
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="group inline-flex items-center gap-2 rounded-full bg-foreground py-2 pl-4 pr-2 text-sm text-background"
                >
                  Enviar documento
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
                <p className="text-sm">Arraste arquivos aqui ou <span className="text-accent underline-offset-4 hover:underline">clique para enviar</span></p>
                <p className="text-xs text-ink-soft">PDF, JPG ou PNG · até 20 MB</p>
                <input
                  ref={fileRef} type="file" multiple className="hidden"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => addFiles(e.target.files)}
                />
              </div>

              <ul className="mt-6 space-y-2">
                {docs.map((d, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-background ring-1 ring-border">
                      <FileText className="h-4 w-4 text-ink-soft" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{d.name}</div>
                      <div className="text-xs text-ink-soft">{d.size}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] ${statusStyle(d.status)}`}>{d.status}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Side column */}
            <div className="space-y-6">
              {/* Next action */}
              <section className="rounded-3xl bg-foreground text-background p-6">
                <div className="flex items-center gap-2 text-xs text-background/60">
                  <AlertCircle className="h-3.5 w-3.5" /> O que falta de você
                </div>
                <h3 className="mt-2 font-serif text-2xl leading-tight">Enviar o Habite-se até 12 de junho</h3>
                <p className="mt-2 text-sm text-background/70">
                  Sem ele, a prefeitura não emite o próximo despacho.
                </p>
                <button className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent text-accent-foreground py-2 pl-4 pr-2 text-sm">
                  Enviar agora
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-background text-foreground">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </button>
              </section>

              {/* Metrics */}
              <section className="rounded-3xl bg-background ring-1 ring-border p-6">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: Calendar, l: "Dias", v: "27" },
                    { icon: TrendingUp, l: "Concluído", v: "62%" },
                    { icon: Clock, l: "Próx. etapa", v: "~7d" },
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
              <section className="rounded-3xl bg-background ring-1 ring-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-background text-xs">CR</div>
                    <div>
                      <div className="text-sm font-medium">Carla Rocha</div>
                      <div className="text-xs text-ink-soft">Arquiteta · sua especialista</div>
                    </div>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-accent" />
                </div>
                <div className="space-y-2">
                  <div className="rounded-2xl rounded-bl-md bg-surface px-3 py-2 text-sm">
                    Protocolei na prefeitura. Devo ter retorno até sexta.
                  </div>
                  <div className="rounded-2xl rounded-br-md bg-accent text-accent-foreground px-3 py-2 text-sm ml-auto max-w-[85%]">
                    Perfeito, obrigada!
                  </div>
                </div>
                <button className="mt-4 w-full rounded-full border border-border bg-surface-elevated py-2 text-xs text-ink-soft hover:border-foreground/30">
                  Abrir conversa
                </button>
              </section>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between text-xs text-ink-soft">
            <span>Última sincronização agora</span>
            <Link to="/" className="hover:text-foreground">Voltar para o site</Link>
          </div>
        </main>
      </div>
    </div>
  );
}

