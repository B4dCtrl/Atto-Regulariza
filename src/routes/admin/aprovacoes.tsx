import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  UserCheck,
  Check,
  X,
  Loader2,
  Mail,
  Phone,
  MapPin,
  BadgeCheck,
  Clock,
  Inbox,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/admin/aprovacoes")({
  head: () => ({ meta: [{ title: "Aprovações — Gestão Regulariza" }] }),
  component: AprovacoesPage,
});

type Profile = Tables<"profiles">;
type Filtro = "pendente" | "aprovado" | "recusado";

const FILTROS: { key: Filtro; label: string }[] = [
  { key: "pendente", label: "Pendentes" },
  { key: "aprovado", label: "Aprovados" },
  { key: "recusado", label: "Recusados" },
];

function AprovacoesPage() {
  const [filtro, setFiltro] = useState<Filtro>("pendente");
  const [rows, setRows] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "profissional")
      .eq("approval_status", filtro)
      .order("created_at", { ascending: false });
    if (error) setErro(error.message);
    setRows(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  async function decidir(id: string, status: Filtro) {
    const nota =
      status === "recusado"
        ? window.prompt("Motivo da recusa (o profissional vê esta mensagem):")?.trim()
        : undefined;
    // Cancelou o prompt: não decide nada.
    if (status === "recusado" && nota === undefined) return;

    setSavingId(id);
    setErro(null);
    const { error } = await supabase
      .from("profiles")
      .update({ approval_status: status, approval_note: nota || null })
      .eq("id", id);
    setSavingId(null);

    if (error) {
      setErro(`Não foi possível salvar: ${error.message}`);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="mx-auto max-w-[1000px] p-6 lg:p-8">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-widest text-ink-soft">Gestão · Acesso</div>
        <h1 className="font-serif text-3xl tracking-tight">Aprovação de profissionais</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Nenhuma conta de profissional acessa processos ou dados de cliente antes de ser aprovada
          aqui.
        </p>
      </div>

      <div className="mb-5 flex gap-1.5">
        {FILTROS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
              filtro === f.key ? "bg-foreground text-background" : "text-ink-soft hover:bg-surface"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {erro && (
        <div className="mb-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
          {erro}
        </div>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-ink-soft" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl bg-background p-16 text-center ring-1 ring-border">
          <Inbox className="mx-auto h-7 w-7 text-ink-soft" />
          <p className="mt-3 text-sm text-ink-soft">
            {filtro === "pendente"
              ? "Nenhum cadastro aguardando análise."
              : `Nenhum profissional ${filtro}.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((p) => (
            <div key={p.id} className="rounded-2xl bg-background p-5 ring-1 ring-border">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 gap-3.5">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent/15 text-sm font-medium text-accent">
                    {p.initials ?? (p.name ?? "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.name ?? "Sem nome"}</span>
                      {filtro === "pendente" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[10px] uppercase tracking-widest text-ink-soft">
                          <Clock className="h-2.5 w-2.5" /> em análise
                        </span>
                      )}
                    </div>
                    {p.specialization && (
                      <div className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-soft">
                        <BadgeCheck className="h-3.5 w-3.5" /> {p.specialization}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
                      {p.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {p.email}
                        </span>
                      )}
                      {p.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {p.phone}
                        </span>
                      )}
                      {(p.city || p.state) && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{" "}
                          {[p.city, p.state].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </div>
                    {p.approval_note && (
                      <div className="mt-2 rounded-xl bg-surface/60 px-3 py-2 text-xs leading-relaxed text-ink-soft">
                        <strong className="text-foreground">Observação:</strong> {p.approval_note}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  {filtro !== "aprovado" && (
                    <button
                      onClick={() => decidir(p.id, "aprovado")}
                      disabled={savingId === p.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {savingId === p.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Aprovar
                    </button>
                  )}
                  {filtro !== "recusado" && (
                    <button
                      onClick={() => decidir(p.id, "recusado")}
                      disabled={savingId === p.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm text-ink-soft transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" /> Recusar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
        <UserCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />O profissional vê o resultado ao entrar
        no site. Ao recusar, a observação escrita aqui aparece para ele na tela de análise.
      </p>
    </div>
  );
}
