import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ArrowLeft, Building2, Check, Clock, FileText, Loader2,
  MessageSquare, User, ChevronRight, AlertCircle, Send,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LOGIN_PAUSED } from "@/lib/site-config";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/admin/projeto/$id")({
  head: () => ({ meta: [{ title: "Projeto — Admin Regulariza" }] }),
  beforeLoad: async ({ params }) => {
    if (LOGIN_PAUSED) return { userId: null as string | null, propertyId: params.id };
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/entrar" });
    return { userId: session.user.id as string | null, propertyId: params.id };
  },
  component: ProjetoPage,
});

type PropertyRow = Tables<"properties">;
type StageRow    = Tables<"process_stages">;
type DocRow      = Tables<"documents">;
type MsgRow      = Tables<"messages">;

const STATUS_LABEL: Record<string, string> = {
  entrada:      "Entrada",
  analise:      "Em análise",
  profissional: "Com profissional",
  prefeitura:   "Em prefeitura",
  entregue:     "Entregue",
};

const STAGE_LABELS = ["Cadastro", "Análise", "Profissional", "Tramitação", "Entrega"];

const STATUS_ORDER = ["entrada", "analise", "profissional", "prefeitura", "entregue"] as const;

const STATUS_MAP: Record<string, { stage: number; progress: number }> = {
  entrada:      { stage: 1, progress: 10  },
  analise:      { stage: 2, progress: 30  },
  profissional: { stage: 3, progress: 55  },
  prefeitura:   { stage: 4, progress: 75  },
  entregue:     { stage: 5, progress: 100 },
};

function ProjetoPage() {
  const { propertyId, userId } = Route.useRouteContext();
  const navigate = useNavigate();

  const [property, setProperty] = useState<PropertyRow | null>(null);
  const [stages,   setStages]   = useState<StageRow[]>([]);
  const [docs,     setDocs]     = useState<DocRow[]>([]);
  const [msgs,     setMsgs]     = useState<MsgRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [msgText,  setMsgText]  = useState("");
  const [sending,  setSending]  = useState(false);
  const [tab,      setTab]      = useState<"info" | "docs" | "msgs">("info");
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    loadAll();
    const ch = supabase
      .channel(`admin-proj-${propertyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `property_id=eq.${propertyId}` },
        loadMsgs,
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  async function loadAll() {
    setLoading(true);
    const [{ data: p }, { data: s }, { data: d }, { data: m }] = await Promise.all([
      supabase.from("properties").select("*").eq("id", propertyId).single(),
      supabase.from("process_stages").select("*").eq("property_id", propertyId).order("stage_number"),
      supabase.from("documents").select("*").eq("property_id", propertyId).order("created_at"),
      supabase.from("messages").select("*").eq("property_id", propertyId).order("created_at"),
    ]);
    if (p) setProperty(p as PropertyRow);
    if (s) setStages(s as StageRow[]);
    if (d) setDocs(d as DocRow[]);
    if (m) setMsgs(m as MsgRow[]);
    setLoading(false);
  }

  async function loadMsgs() {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at");
    if (data) setMsgs(data as MsgRow[]);
  }

  async function advanceStage() {
    if (!property) return;
    const cur = STATUS_ORDER.indexOf(property.status as typeof STATUS_ORDER[number]);
    if (cur >= STATUS_ORDER.length - 1) return;
    const next = STATUS_ORDER[cur + 1];
    const { stage, progress } = STATUS_MAP[next];
    setAdvancing(true);
    await supabase
      .from("properties")
      .update({ status: next, current_stage: stage, progress, updated_at: new Date().toISOString() })
      .eq("id", propertyId);
    for (let i = 0; i < STAGE_LABELS.length; i++) {
      await supabase
        .from("process_stages")
        .update({
          state: i + 1 < stage ? "done" : i + 1 === stage ? "active" : "pending",
          completed_at: i + 1 < stage ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("property_id", propertyId)
        .eq("stage_number", i + 1);
    }
    setAdvancing(false);
    loadAll();
  }

  async function sendMsg() {
    if (!msgText.trim()) return;
    setSending(true);
    await supabase.from("messages").insert({
      property_id: propertyId,
      sender_id: userId ?? undefined,
      sender_name: "Admin",
      content: msgText.trim(),
      is_client: false,
    });
    setMsgText("");
    setSending(false);
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-soft" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <AlertCircle className="h-8 w-8 text-ink-soft" />
        <p className="text-sm text-ink-soft">Projeto não encontrado.</p>
        <button onClick={() => navigate({ to: "/admin" })} className="text-sm underline">
          Voltar ao board
        </button>
      </div>
    );
  }

  const curStageIdx = (STATUS_MAP[property.status]?.stage ?? 1) - 1;
  const isLast = property.status === "entregue";

  return (
    <div className="mx-auto max-w-[1400px] p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/admin" })}
          className="grid h-9 w-9 place-items-center rounded-full border border-border text-ink-soft hover:bg-surface transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-ink-soft">Admin · Projetos</div>
          <h1 className="font-serif text-2xl tracking-tight truncate">{property.name}</h1>
        </div>
        <span className="rounded-full bg-surface px-3 py-1 text-xs font-medium ring-1 ring-border">
          {STATUS_LABEL[property.status] ?? property.status}
        </span>
        <div className="text-sm font-medium">{property.progress}%</div>
      </div>

      {/* Progress bar */}
      <div className="mb-6 h-1.5 w-full rounded-full bg-surface overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: `${property.progress}%` }}
        />
      </div>

      {/* Etapas */}
      <div className="mb-8 flex gap-1">
        {STAGE_LABELS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-1">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium transition-colors
                ${i < curStageIdx
                  ? "bg-accent text-background"
                  : i === curStageIdx
                    ? "bg-foreground text-background"
                    : "bg-surface text-ink-soft ring-1 ring-border"
                }`}
            >
              {i < curStageIdx ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            <span className="hidden text-[11px] text-ink-soft sm:inline truncate">{label}</span>
            {i < STAGE_LABELS.length - 1 && <ChevronRight className="h-3 w-3 text-ink-soft/30 shrink-0" />}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* ─── Left column ─── */}
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 rounded-xl bg-surface p-1">
            {(["info", "docs", "msgs"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors
                  ${tab === t ? "bg-background shadow-sm text-foreground" : "text-ink-soft hover:text-foreground"}`}
              >
                {t === "info" ? "Informações" : t === "docs" ? `Documentos (${docs.length})` : `Mensagens (${msgs.length})`}
              </button>
            ))}
          </div>

          {/* Tab: Info */}
          {tab === "info" && (
            <div className="rounded-2xl bg-background ring-1 ring-border p-5 space-y-4">
              <h3 className="font-medium text-sm">Dados do cliente</h3>
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <InfoField label="Nome"     value={property.client_name  ?? "—"} />
                <InfoField label="Email"    value={property.client_email ?? "—"} />
                <InfoField label="CPF"      value={property.client_cpf   ?? "—"} />
                <InfoField label="Telefone" value={property.client_phone ?? "—"} />
                <InfoField label="Cidade"   value={[property.city, property.state].filter(Boolean).join("/") || "—"} />
                <InfoField label="Tipo"     value={property.tipo_imovel  ?? "—"} />
                <InfoField label="Situação" value={property.situacao     ?? "—"} />
                <InfoField label="Objetivo" value={property.objetivo     ?? "—"} />
                <InfoField label="Urgência" value={property.urgencia     ?? "—"} />
              </div>
              {property.notes && (
                <div className="rounded-xl bg-surface p-3">
                  <div className="text-[11px] text-ink-soft mb-1">Observações</div>
                  <p className="text-sm">{property.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Tab: Docs */}
          {tab === "docs" && (
            <div className="rounded-2xl bg-background ring-1 ring-border divide-y divide-border overflow-hidden">
              {docs.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-sm text-ink-soft">
                  Nenhum documento enviado ainda.
                </div>
              ) : (
                docs.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 px-5 py-3">
                    <FileText className="h-4 w-4 shrink-0 text-ink-soft" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{d.name}</div>
                      <div className="text-[11px] text-ink-soft">{d.size_text ?? "—"}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium
                      ${d.status === "Aprovado"   ? "bg-green-50 text-green-700"
                      : d.status === "Em análise" ? "bg-foreground/10 text-foreground"
                      : d.status === "Pendente"   ? "bg-yellow-50 text-yellow-700"
                      : "bg-surface text-ink-soft ring-1 ring-border"}`
                    }>{d.status}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab: Msgs */}
          {tab === "msgs" && (
            <div className="rounded-2xl bg-background ring-1 ring-border overflow-hidden flex flex-col" style={{ minHeight: 340 }}>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {msgs.length === 0 ? (
                  <div className="flex h-24 items-center justify-center text-sm text-ink-soft">
                    Nenhuma mensagem ainda.
                  </div>
                ) : (
                  msgs.map((m) => (
                    <div key={m.id} className={`flex ${m.is_client ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm
                        ${m.is_client ? "bg-surface text-foreground" : "bg-foreground text-background"}`}
                      >
                        <div className="text-[11px] opacity-60 mb-0.5">{m.sender_name}</div>
                        {m.content}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="border-t border-border p-3 flex gap-2">
                <input
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMsg()}
                  placeholder="Enviar mensagem ao cliente…"
                  className="flex-1 rounded-xl bg-surface px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-foreground"
                />
                <button
                  onClick={sendMsg}
                  disabled={sending || !msgText.trim()}
                  className="grid h-9 w-9 place-items-center rounded-xl bg-foreground text-background disabled:opacity-40 transition-opacity"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ─── Right column ─── */}
        <div className="space-y-4">
          {/* Avançar etapa */}
          <div className="rounded-2xl bg-background ring-1 ring-border p-5 space-y-3">
            <h3 className="font-medium text-sm">Ações do processo</h3>
            <button
              onClick={advanceStage}
              disabled={isLast || advancing}
              className="w-full rounded-xl bg-foreground py-2.5 text-sm text-background hover:opacity-80 disabled:opacity-40 transition-opacity"
            >
              {advancing
                ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Atualizando…</span>
                : isLast ? "Processo concluído ✓" : "Avançar para próxima etapa →"
              }
            </button>
            <div className="text-[11px] text-ink-soft text-center">
              Etapa atual: <strong>{STATUS_LABEL[property.status]}</strong>
            </div>
          </div>

          {/* Próxima ação / prazo */}
          {property.next_action_deadline && (
            <div className="rounded-2xl bg-background ring-1 ring-border p-5">
              <div className="text-[11px] text-ink-soft mb-1 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Próxima ação
              </div>
              <div className="text-sm font-medium">{property.next_action ?? "—"}</div>
              <div className="text-[11px] text-ink-soft mt-1">
                Prazo: {new Date(property.next_action_deadline).toLocaleDateString("pt-BR")}
              </div>
            </div>
          )}

          {/* Etapas detalhe */}
          {stages.length > 0 && (
            <div className="rounded-2xl bg-background ring-1 ring-border p-5">
              <h3 className="font-medium text-sm mb-3">Etapas do processo</h3>
              <div className="space-y-2">
                {stages.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 text-sm">
                    <div className={`h-5 w-5 shrink-0 rounded-full flex items-center justify-center
                      ${s.state === "done"    ? "bg-accent text-background"
                      : s.state === "active"  ? "bg-foreground text-background"
                      : "bg-surface text-ink-soft ring-1 ring-border"}`}
                    >
                      {s.state === "done"
                        ? <Check className="h-3 w-3" />
                        : <span className="text-[10px]">{s.stage_number}</span>
                      }
                    </div>
                    <span className={s.state === "pending" ? "text-ink-soft" : ""}>{s.label}</span>
                    {s.state === "done" && s.completed_at && (
                      <span className="ml-auto text-[11px] text-ink-soft">
                        {new Date(s.completed_at).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                    {s.state === "active" && (
                      <span className="ml-auto text-[11px] text-accent font-medium">Em andamento</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Link painel cliente */}
          <div className="rounded-2xl bg-surface ring-1 ring-border p-4 text-center">
            <p className="text-xs text-ink-soft mb-2">Ver como o cliente vê</p>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-background transition-colors"
            >
              <User className="h-3 w-3" /> Abrir painel do cliente
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-ink-soft">{label}</div>
      <div className="font-medium truncate">{value}</div>
    </div>
  );
}
