import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { registrarAcesso } from "@/lib/api/acessos";
import { Kanban } from "@/components/admin/Kanban";
import { ChatbotPanel } from "@/components/admin/ChatbotPanel";
import { UploadZone } from "@/components/admin/UploadZone";
import { Search, Bell, Plus, Loader2, User, Settings, LogOut, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Back office — Regulariza" }] }),
  beforeLoad: async () => {
    // Sem desvio por LOGIN_PAUSED: back office exige sessão + papel de admin.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/entrar" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);
    const isAdmin = roles?.some((r) => r.role === "admin");
    if (!isAdmin) throw redirect({ to: "/dashboard" });
    return { userId: session.user.id as string | null };
  },
  component: AdminHome,
});

type KPI = { l: string; v: string };
type NextAction = { name: string; next_action_deadline: string };

function AdminHome() {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<KPI[]>([
    { l: "Ativos", v: "…" },
    { l: "Em prefeitura", v: "…" },
    { l: "Aguardando cliente", v: "…" },
    { l: "Entregues no mês", v: "…" },
  ]);
  const [nextActions, setNextActions] = useState<NextAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAvatar, setShowAvatar] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setShowAvatar(false);
    }
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, []);

  async function loadKpis() {
    const { data } = await supabase
      .from("properties")
      .select("status, updated_at, name, next_action_deadline");
    if (!data) {
      setLoading(false);
      return;
    }

    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const ativos = data.filter((p) => p.status !== "entregue").length;
    const prefeitura = data.filter((p) => p.status === "prefeitura").length;
    const aguardando = data.filter((p) => p.status === "entrada").length;
    const entregues = data.filter((p) => {
      if (p.status !== "entregue") return false;
      const d = new Date(p.updated_at);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }).length;

    setKpis([
      { l: "Ativos", v: String(ativos) },
      { l: "Em prefeitura", v: String(prefeitura) },
      { l: "Aguardando cliente", v: String(aguardando) },
      { l: "Entregues no mês", v: String(entregues) },
    ]);

    const upcoming = data
      .filter((p) => p.next_action_deadline)
      .sort(
        (a, b) =>
          new Date(a.next_action_deadline!).getTime() - new Date(b.next_action_deadline!).getTime(),
      )
      .slice(0, 5) as NextAction[];
    setNextActions(upcoming);

    setLoading(false);
  }

  useEffect(() => {
    loadKpis();

    const channel = supabase
      .channel("admin-kpis")
      .on("postgres_changes", { event: "*", schema: "public", table: "properties" }, loadKpis)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /* Registra a entrada uma vez por montagem da tela. */
  useEffect(() => {
    registrarAcesso("admin");
  }, []);

  return (
    <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
      <div className="mb-6 flex items-center gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-ink-soft">Visão geral</div>
          <h1 className="font-serif text-3xl tracking-tight">Processos em andamento</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* Busca */}
          {showSearch ? (
            <div className="flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5">
              <Search className="h-3.5 w-3.5 text-ink-soft" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar processo…"
                className="w-40 bg-transparent text-xs outline-none placeholder:text-ink-soft/60"
              />
              <button
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery("");
                }}
              >
                <X className="h-3.5 w-3.5 text-ink-soft" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSearch(true)}
              className="hidden items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-ink-soft md:flex hover:bg-surface transition-colors"
            >
              <Search className="h-3.5 w-3.5" /> Buscar processo
            </button>
          )}

          {/* Sino */}
          <button
            type="button"
            onClick={() => navigate({ to: "/admin/processos" })}
            className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background hover:bg-surface transition-colors"
          >
            <Bell className="h-4 w-4 text-ink-soft" />
          </button>

          {/* Novo processo */}
          <button
            type="button"
            onClick={() => navigate({ to: "/admin/cadastro-cliente" })}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-3 py-2 text-sm text-background hover:opacity-80 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" /> Novo processo
          </button>

          {/* Avatar AD */}
          <div ref={avatarRef} className="relative">
            <button
              onClick={() => setShowAvatar((v) => !v)}
              className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-xs text-background hover:opacity-80 transition-opacity"
            >
              AD
            </button>
            {showAvatar && (
              <div className="absolute right-0 top-11 z-50 w-48 overflow-hidden rounded-2xl border border-border bg-background shadow-xl">
                <div className="border-b border-border px-4 py-3">
                  <div className="text-xs font-medium">Admin</div>
                  <div className="text-[11px] text-ink-soft">Backoffice</div>
                </div>
                <div className="p-1.5 space-y-0.5">
                  <button
                    onClick={() => {
                      setShowAvatar(false);
                      navigate({ to: "/perfil-profissional" });
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ink-soft hover:bg-surface hover:text-foreground transition-colors"
                  >
                    <User className="h-4 w-4" /> Meu Perfil
                  </button>
                  <button
                    onClick={() => {
                      setShowAvatar(false);
                      navigate({ to: "/perfil-profissional" });
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ink-soft hover:bg-surface hover:text-foreground transition-colors"
                  >
                    <Settings className="h-4 w-4" /> Configurações
                  </button>
                  <div className="my-1 h-px bg-border" />
                  <button
                    onClick={async () => {
                      await supabase.auth.signOut();
                      window.location.href = "/entrar";
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="h-4 w-4" /> Sair
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((m) => (
          <div key={m.l} className="rounded-2xl bg-background p-4 ring-1 ring-border">
            <div className="text-[11px] text-ink-soft">{m.l}</div>
            <div className="mt-1 font-serif text-3xl tracking-tight">
              {loading ? <Loader2 className="inline h-5 w-5 animate-spin text-ink-soft" /> : m.v}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Kanban filter={searchQuery} />
          <ChatbotPanel />
        </div>
        <div className="space-y-6">
          <UploadZone />
          <div className="rounded-2xl bg-foreground p-5 text-background">
            <div className="text-[10px] uppercase tracking-widest text-background/60">
              Próximas ações
            </div>
            <div className="mt-2 font-serif text-xl leading-snug">
              {nextActions.length > 0
                ? `${nextActions.length} prazo${nextActions.length !== 1 ? "s" : ""} agendado${nextActions.length !== 1 ? "s" : ""}`
                : "Nenhum prazo agendado"}
            </div>
            {nextActions.length > 0 && (
              <ul className="mt-3 space-y-2 text-xs text-background/80">
                {nextActions.map((a) => {
                  const ms = new Date(a.next_action_deadline).getTime() - Date.now();
                  const days = Math.ceil(ms / 86_400_000);
                  return (
                    <li
                      key={a.name + a.next_action_deadline}
                      className="flex justify-between gap-2"
                    >
                      <span className="truncate">{a.name}</span>
                      <span
                        className={`shrink-0 ${days <= 0 ? "text-red-300" : days <= 2 ? "text-yellow-300" : ""}`}
                      >
                        {days <= 0 ? "Vencido" : `${days}d`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
