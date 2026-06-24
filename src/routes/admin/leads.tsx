import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Plus, X, Building2, Clock, MapPin, Check,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/admin/leads")({
  head: () => ({ meta: [{ title: "Leads — Ato Regulariza" }] }),
  component: LeadsPage,
});

/* ──────── Types */
type Urgency    = "alta" | "media" | "baixa";
type LeadStatus = "novo" | "triagem" | "atribuido" | "ativo" | "recusado";

interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  propertyType: string;
  situation: string;
  urgency: Urgency;
  status: LeadStatus;
  professionalName: string | null;
  notes: string;
  createdAt: string;
}

/* ──────── Constants */
const STATUS_FLOW: LeadStatus[] = ["novo", "triagem", "atribuido", "ativo"];

const STATUS_LABEL: Record<LeadStatus, string> = {
  novo:      "Novo",
  triagem:   "Triagem",
  atribuido: "Atribuído",
  ativo:     "Ativo",
  recusado:  "Recusado",
};

const STATUS_CLS: Record<LeadStatus, string> = {
  novo:      "bg-blue-50 text-blue-700",
  triagem:   "bg-yellow-50 text-yellow-700",
  atribuido: "bg-purple-50 text-purple-700",
  ativo:     "bg-green-50 text-green-700",
  recusado:  "bg-surface text-ink-soft ring-1 ring-border",
};

const URGENCY_LABEL: Record<Urgency, string> = { alta: "Urgente", media: "Média", baixa: "Baixa" };
const URGENCY_CLS: Record<Urgency, string>   = {
  alta:  "bg-red-50 text-red-600 ring-1 ring-red-200",
  media: "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200",
  baixa: "bg-green-50 text-green-700 ring-1 ring-green-200",
};

const ADVANCE_LABEL: Record<LeadStatus, string> = {
  novo:      "Iniciar triagem",
  triagem:   "Atribuir profissional",
  atribuido: "Marcar como ativo",
  ativo:     "",
  recusado:  "",
};

/* ──────── Mapper */
type LeadRow = Tables<"leads">;
function rowToLead(r: LeadRow): Lead {
  return {
    id: r.id, name: r.name ?? "—", phone: r.phone ?? "", email: r.email,
    city: r.city ?? "", state: r.state ?? "",
    propertyType: r.tipo_imovel ?? "—",
    situation: r.situacao ?? "—",
    urgency: (r.urgencia as Urgency) ?? "media",
    status: (r.status as LeadStatus) ?? "novo",
    professionalName: r.professional_name ?? null,
    notes: r.notes ?? "",
    createdAt: r.created_at,
  };
}

/* ──────── Component */
function LeadsPage() {
  const [leads,        setLeads]        = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [filter,       setFilter]       = useState<LeadStatus | "all">("all");
  const [notes,        setNotes]        = useState("");
  const [pros,         setPros]         = useState<{ id: string; name: string | null }[]>([]);
  const [showNew,      setShowNew]      = useState(false);
  const [nl,           setNl]           = useState({ name: "", email: "", phone: "", city: "", state: "", situation: "" });
  const nlInp = "w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground/30";

  useEffect(() => {
    supabase.from("leads").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setLeads(data.map((r) => rowToLead(r as LeadRow))); });
    supabase.from("profiles").select("id, name").eq("role", "profissional").eq("active", true).order("name")
      .then(({ data }) => setPros(data ?? []));
  }, []);

  const update = async (id: string, patch: Partial<Lead>) => {
    const dbPatch: Record<string, unknown> = {};
    if (patch.status) dbPatch.status = patch.status;
    if (patch.professionalName !== undefined) dbPatch.professional_name = patch.professionalName;
    if (patch.notes !== undefined) dbPatch.notes = patch.notes;
    await supabase.from("leads").update(dbPatch).eq("id", id);
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    setSelectedLead((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  };

  const advance = (lead: Lead) => {
    const idx = STATUS_FLOW.indexOf(lead.status);
    if (idx < STATUS_FLOW.length - 1) {
      const nextStatus = STATUS_FLOW[idx + 1];
      const patch: Partial<Lead> = { status: nextStatus };
      update(lead.id, patch);
    }
  };

  const refuse    = (id: string) => { update(id, { status: "recusado" }); if (selectedLead?.id === id) setSelectedLead(null); };
  const saveNotes = () => { if (selectedLead) update(selectedLead.id, { notes }); };
  const assignPro = (name: string) => {
    if (!selectedLead || !name) return;
    update(selectedLead.id, { status: "atribuido", professionalName: name });
  };
  async function createManualLead() {
    if (!nl.name.trim() || !nl.email.trim()) return;
    const { data, error } = await supabase.from("leads").insert({
      name: nl.name, email: nl.email, phone: nl.phone || null,
      city: nl.city || null, state: nl.state || null,
      situacao: nl.situation || null, status: "novo", source: "manual",
    }).select("*").single();
    if (error) { alert(`Erro ao criar lead: ${error.message}`); return; }
    if (data) setLeads((prev) => [rowToLead(data as LeadRow), ...prev]);
    setNl({ name: "", email: "", phone: "", city: "", state: "", situation: "" });
    setShowNew(false);
  }

  const openDetail = (lead: Lead) => { setSelectedLead(lead); setNotes(lead.notes); };

  const activeLeads   = leads.filter((l) => l.status !== "recusado");
  const filtered      = filter === "all" ? activeLeads : leads.filter((l) => l.status === filter);
  const countStatus   = (s: LeadStatus) => leads.filter((l) => l.status === s).length;

  const newCount = countStatus("novo");

  return (
    <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-ink-soft">Backoffice</div>
          <h1 className="font-serif text-3xl tracking-tight">Central de Leads</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {activeLeads.length} leads ativos ·{" "}
            {newCount > 0 && (
              <span className="text-accent font-medium">{newCount} novo{newCount !== 1 ? "s" : ""} aguardando triagem</span>
            )}
          </p>
        </div>
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm text-background hover:bg-foreground/90 transition-colors">
          <Plus className="h-4 w-4" />
          Novo lead manual
        </button>
      </div>

      {/* Pipeline summary */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATUS_FLOW.map((s) => {
          const count = countStatus(s);
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-2xl border p-3 text-left transition-all ${
                filter === s ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:border-foreground/30"
              }`}
            >
              <div className={`text-2xl font-serif tracking-tight ${filter === s ? "" : ""}`}>{count}</div>
              <div className={`text-xs mt-0.5 ${filter === s ? "text-background/70" : "text-ink-soft"}`}>{STATUS_LABEL[s]}</div>
            </button>
          );
        })}
      </div>

      {/* Filter tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        {(["all", ...STATUS_FLOW, "recusado"] as const).map((s) => {
          const count = s === "all" ? activeLeads.length : countStatus(s as LeadStatus);
          return (
            <button
              key={s}
              onClick={() => setFilter(s as LeadStatus | "all")}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                filter === s
                  ? "bg-foreground text-background"
                  : "border border-border text-ink-soft hover:border-foreground/30"
              }`}
            >
              {s === "all" ? "Todos" : STATUS_LABEL[s as LeadStatus]}{" "}
              <span className="ml-1 opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Lead list */}
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="rounded-2xl bg-background ring-1 ring-border py-12 text-center text-sm text-ink-soft">
              Nenhum lead nesta fase.
            </div>
          )}
          <AnimatePresence>
            {filtered.map((lead) => (
              <motion.div
                key={lead.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className={`cursor-pointer rounded-2xl bg-background ring-1 p-4 transition-all hover:shadow-md ${
                  selectedLead?.id === lead.id ? "ring-foreground" : "ring-border hover:ring-foreground/20"
                }`}
                onClick={() => openDetail(lead)}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface ring-1 ring-border text-xs font-medium">
                    {lead.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium">{lead.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] ${URGENCY_CLS[lead.urgency]}`}>
                        {URGENCY_LABEL[lead.urgency]}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_CLS[lead.status]}`}>
                        {STATUS_LABEL[lead.status]}
                      </span>
                      {lead.professionalName && (
                        <span className="text-[11px] text-ink-soft">→ {lead.professionalName}</span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-soft">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{lead.city}/{lead.state}</span>
                      <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{lead.propertyType}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />
                        {new Date(lead.createdAt).toLocaleDateString("pt-BR", { day:"2-digit", month:"short" })}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-ink-soft line-clamp-1">{lead.situation}</p>
                  </div>

                  {/* Quick action */}
                  {STATUS_FLOW.includes(lead.status) && lead.status !== "ativo" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); if (lead.status === "triagem") openDetail(lead); else advance(lead); }}
                      className="shrink-0 rounded-full border border-border px-3 py-1 text-xs text-ink-soft hover:bg-foreground hover:text-background hover:border-foreground transition-colors whitespace-nowrap"
                    >
                      {ADVANCE_LABEL[lead.status]}
                    </button>
                  )}
                  {lead.status === "ativo" && (
                    <span className="shrink-0 flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs text-green-700">
                      <Check className="h-3 w-3" />Ativo
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Detail panel */}
        <AnimatePresence>
          {selectedLead && (
            <motion.aside
              key={selectedLead.id}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.2 }}
              className="sticky top-6 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-3xl bg-background ring-1 ring-border p-5 space-y-4"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-serif text-xl tracking-tight">{selectedLead.name}</h3>
                  <div className="mt-0.5 text-xs text-ink-soft">{selectedLead.email}</div>
                </div>
                <button onClick={() => setSelectedLead(null)} className="text-ink-soft hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Details grid */}
              <div className="space-y-2 rounded-2xl bg-surface p-3 text-xs">
                {[
                  ["Telefone",  selectedLead.phone],
                  ["Cidade",    `${selectedLead.city}/${selectedLead.state}`],
                  ["Tipo",      selectedLead.propertyType],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="w-20 shrink-0 text-ink-soft">{k}</span>
                    <span>{v}</span>
                  </div>
                ))}
                <div className="flex gap-2">
                  <span className="w-20 shrink-0 text-ink-soft">Urgência</span>
                  <span className={`rounded-full px-2 py-0.5 ${URGENCY_CLS[selectedLead.urgency]}`}>
                    {URGENCY_LABEL[selectedLead.urgency]}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="w-20 shrink-0 text-ink-soft">Status</span>
                  <span className={`rounded-full px-2 py-0.5 ${STATUS_CLS[selectedLead.status]}`}>
                    {STATUS_LABEL[selectedLead.status]}
                  </span>
                </div>
              </div>

              {/* Situation */}
              <div>
                <div className="mb-1 text-xs font-medium">Situação do imóvel</div>
                <p className="text-xs text-ink-soft leading-relaxed">{selectedLead.situation}</p>
              </div>

              {/* Professional */}
              {selectedLead.professionalName && (
                <div className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5 text-xs">
                  <div className="grid h-6 w-6 place-items-center rounded-full bg-foreground text-background text-[10px] font-medium">
                    {selectedLead.professionalName.split(" ").map((n) => n[0]).slice(0,2).join("")}
                  </div>
                  <span className="text-ink-soft">Atribuído a</span>
                  <span className="font-medium">{selectedLead.professionalName}</span>
                </div>
              )}

              {/* Notes */}
              <div>
                <div className="mb-1.5 text-xs font-medium">Notas internas</div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Histórico de contato, detalhes da triagem, observações importantes..."
                  rows={3}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs resize-none outline-none focus:border-foreground/30"
                />
                <button
                  onClick={saveNotes}
                  className="mt-1.5 rounded-full border border-border px-3 py-1 text-xs text-ink-soft hover:bg-surface transition-colors"
                >
                  Salvar notas
                </button>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                {selectedLead.status === "novo" && (
                  <button
                    onClick={() => advance(selectedLead)}
                    className="w-full rounded-xl bg-foreground py-2.5 text-sm text-background hover:bg-foreground/90 transition-colors"
                  >
                    Iniciar triagem
                  </button>
                )}
                {selectedLead.status === "triagem" && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-medium">Atribuir profissional</div>
                    <select
                      defaultValue=""
                      onChange={(e) => assignPro(e.target.value)}
                      className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground/30"
                    >
                      <option value="" disabled>Selecione um profissional…</option>
                      {pros.map((p) => (
                        <option key={p.id} value={p.name ?? ""}>{p.name ?? "(sem nome)"}</option>
                      ))}
                    </select>
                    {pros.length === 0 && (
                      <p className="text-[11px] text-ink-soft">
                        Nenhum profissional ativo. Cadastre em Cadastros · Profissional.
                      </p>
                    )}
                  </div>
                )}
                {selectedLead.status === "atribuido" && (
                  <button
                    onClick={() => advance(selectedLead)}
                    className="w-full rounded-xl bg-accent py-2.5 text-sm text-accent-foreground hover:opacity-90 transition-colors"
                  >
                    Marcar como ativo
                  </button>
                )}
                {selectedLead.status !== "recusado" && (
                  <button
                    onClick={() => refuse(selectedLead.id)}
                    className="w-full rounded-xl border border-border py-2 text-xs text-ink-soft hover:bg-surface transition-colors"
                  >
                    <AlertTriangle className="inline h-3 w-3 mr-1" />
                    Recusar caso
                  </button>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Modal — novo lead manual */}
      <AnimatePresence>
        {showNew && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowNew(false)}
          >
            <motion.div
              className="w-full max-w-md rounded-3xl bg-background ring-1 ring-border p-6"
              initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-serif text-xl tracking-tight">Novo lead manual</h3>
                <button onClick={() => setShowNew(false)} className="text-ink-soft hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-3">
                <input value={nl.name} onChange={(e) => setNl({ ...nl, name: e.target.value })} placeholder="Nome *" className={nlInp} />
                <input value={nl.email} onChange={(e) => setNl({ ...nl, email: e.target.value })} placeholder="E-mail *" className={nlInp} />
                <input value={nl.phone} onChange={(e) => setNl({ ...nl, phone: e.target.value })} placeholder="Telefone" className={nlInp} />
                <div className="flex gap-3">
                  <input value={nl.city} onChange={(e) => setNl({ ...nl, city: e.target.value })} placeholder="Cidade" className={nlInp} />
                  <input value={nl.state} onChange={(e) => setNl({ ...nl, state: e.target.value })} placeholder="UF" className={`${nlInp} w-20`} />
                </div>
                <textarea value={nl.situation} onChange={(e) => setNl({ ...nl, situation: e.target.value })} placeholder="Situação do imóvel" rows={2} className={`${nlInp} resize-none`} />
              </div>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setShowNew(false)} className="flex-1 rounded-xl border border-border py-2.5 text-sm text-ink-soft hover:bg-surface transition-colors">Cancelar</button>
                <button onClick={createManualLead} disabled={!nl.name.trim() || !nl.email.trim()} className="flex-1 rounded-xl bg-foreground py-2.5 text-sm text-background hover:bg-foreground/90 disabled:opacity-50 transition-colors">Criar lead</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
