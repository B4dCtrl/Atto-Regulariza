import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Save, Plus, Trash2, Star,
  Check, RefreshCw, Info,
} from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Gestão Regulariza" }] }),
  component: FinanceiroPage,
});

export interface PricePlan {
  id: string;
  name: string;
  price: string;
  period: string;
  desc: string;
  features: string[];
  popular?: boolean;
  tag?: string;
  note?: string;
  visible: boolean;
}

export const DEFAULT_PLANS: PricePlan[] = [
  {
    id: "matricula",
    name: "Regularização de matrícula",
    price: "a partir de R$ 3.999,99",
    period: "por imóvel",
    desc: "Atualização de registro, pendências cartoriais e documentação básica.",
    features: ["Análise documental completa", "Especialista designado", "Acompanhamento no painel", "Tramitação cartorial"],
    visible: true,
  },
  {
    id: "habitese",
    name: "Habite-se / Averbação",
    price: "a partir de R$ 3.999,99",
    period: "por imóvel",
    tag: "Mais pedido",
    popular: true,
    desc: "Legalização junto à prefeitura e registro da construção ou alteração.",
    features: ["Prefeitura + cartório", "Resolução de exigências", "Timeline visual", "Suporte prioritário"],
    visible: true,
  },
  {
    id: "complexos",
    name: "Casos complexos",
    price: "Sob consulta",
    period: "usucapião, inventário, multipropriedade",
    desc: "Situações que exigem estratégia jurídica e operação dedicada.",
    features: ["Equipe especializada", "Advogado no caso", "Prazo personalizado", "Mediação cartorial"],
    visible: true,
  },
  {
    id: "unificacao",
    name: "Unificação / Desmembramento",
    price: "a partir de R$ 3.999,00",
    period: "por imóvel",
    note: "valor base para 2 terrenos",
    desc: "União ou divisão de terrenos com nova matrícula registrada.",
    features: ["Planta e memorial descritivo", "Aprovação na prefeitura", "Abertura de novas matrículas", "Registro em cartório"],
    visible: true,
  },
  {
    id: "retificacao",
    name: "Retificação",
    price: "a partir de R$ 2.899,00",
    period: "por imóvel",
    desc: "Correção de área, medidas ou dados divergentes na matrícula.",
    features: ["Levantamento e georreferenciamento", "Anuência de confrontantes", "Planta técnica assinada", "Averbação na matrícula"],
    visible: true,
  },
  {
    id: "institucional",
    name: "Institucional",
    price: "Sob consulta",
    period: "volume, SLA e multi-usuário",
    desc: "Para imobiliárias, construtoras e cartórios com volume alto de processos.",
    features: ["Integração de sistemas", "SLA personalizado", "Acesso multi-usuário", "Gerente de conta dedicado"],
    visible: true,
  },
];

function FinanceiroPage() {
  const [plans,   setPlans]   = useState<PricePlan[]>(DEFAULT_PLANS);
  const [saved,   setSaved]   = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  // Load from Supabase on mount
  useEffect(() => {
    supabase.from("pricing_plans").select("*").order("sort").then(({ data }) => {
      if (data && data.length > 0) {
        setPlans(data.map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price ?? "",
          period: p.period ?? "",
          desc: p.descr ?? "",
          features: p.features ?? [],
          popular: p.popular ?? undefined,
          tag: p.tag ?? undefined,
          note: p.note ?? undefined,
          visible: p.visible ?? true,
        })));
      }
    });
  }, []);

  async function savePlan(p: PricePlan, sort: number) {
    await supabase.from("pricing_plans").upsert({
      id: p.id,
      name: p.name,
      price: p.price,
      period: p.period,
      descr: p.desc,
      features: p.features,
      popular: !!p.popular,
      tag: p.tag ?? null,
      note: p.note ?? null,
      visible: p.visible,
      sort,
      updated_at: new Date().toISOString(),
    });
  }

  async function deletePlan(id: string) {
    await supabase.from("pricing_plans").delete().eq("id", id);
  }

  const saveAll = async () => {
    await Promise.all(plans.map((p, i) => savePlan(p, i)));
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const reset = () => {
    if (!confirm("Restaurar todos os preços para os valores padrão? Isso sobrescreverá os dados no banco.")) return;
    setPlans(DEFAULT_PLANS);
    Promise.all(DEFAULT_PLANS.map((p, i) => savePlan(p, i))).then(() => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    });
  };

  const updatePlan = (id: string, patch: Partial<PricePlan>) => {
    setPlans((cur) => cur.map((p) => p.id === id ? { ...p, ...patch } : p));
  };

  const addFeature = (id: string) => {
    updatePlan(id, { features: [...(plans.find((p) => p.id === id)?.features ?? []), ""] });
  };

  const updateFeature = (id: string, idx: number, val: string) => {
    const plan = plans.find((p) => p.id === id);
    if (!plan) return;
    const features = [...plan.features];
    features[idx] = val;
    updatePlan(id, { features });
  };

  const removeFeature = (id: string, idx: number) => {
    const plan = plans.find((p) => p.id === id);
    if (!plan) return;
    updatePlan(id, { features: plan.features.filter((_, i) => i !== idx) });
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm("Remover este plano permanentemente?")) return;
    await deletePlan(id);
    setPlans((cur) => cur.filter((p) => p.id !== id));
  };

  const handleAddPlan = () => {
    const newPlan: PricePlan = {
      id: crypto.randomUUID().slice(0, 8),
      name: "Novo plano",
      price: "",
      period: "",
      desc: "",
      features: [],
      visible: false,
    };
    setPlans((cur) => [...cur, newPlan]);
  };

  return (
    <div className="mx-auto max-w-[1400px] p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-ink-soft">Gestão · Financeiro</div>
          <h1 className="font-serif text-3xl tracking-tight">Precificação</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Edite os preços e textos exibidos na página pública de preços.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddPlan}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-ink-soft hover:border-foreground/30 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Novo plano
          </button>
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-ink-soft hover:border-foreground/30 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Restaurar padrão
          </button>
          <button
            onClick={saveAll}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all ${
              saved ? "bg-green-600 text-white" : "bg-foreground text-background hover:bg-foreground/90"
            }`}
          >
            {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saved ? "Salvo!" : "Salvar alterações"}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 text-sm text-ink-soft">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>As alterações salvas são publicadas diretamente no banco de dados e aparecem imediatamente na página pública de preços (<code>/precos</code>).</span>
      </div>

      {/* Cards grid */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan, i) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className={`rounded-3xl bg-background ring-1 transition-shadow ${
              editing === plan.id ? "ring-foreground shadow-[0_0_0_3px_oklch(0.16_0.01_60_/_0.08)]" : "ring-border"
            }`}
          >
            {/* Card header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${plan.visible ? "bg-accent" : "bg-ink-soft"}`} />
                <span className="text-xs font-medium uppercase tracking-wider text-ink-soft">
                  {plan.popular ? "Destaque" : "Produto"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updatePlan(plan.id, { popular: !plan.popular })}
                  title="Marcar como destaque"
                  className={`grid h-7 w-7 place-items-center rounded-full transition-colors ${plan.popular ? "bg-accent text-accent-foreground" : "text-ink-soft hover:bg-surface"}`}
                >
                  <Star className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => updatePlan(plan.id, { visible: !plan.visible })}
                  className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${plan.visible ? "bg-surface text-ink-soft hover:bg-border" : "bg-foreground/10 text-foreground/40"}`}
                >
                  {plan.visible ? "Visível" : "Oculto"}
                </button>
                <button
                  onClick={() => setEditing(editing === plan.id ? null : plan.id)}
                  className="rounded-full bg-surface px-3 py-1 text-[11px] text-ink-soft hover:bg-border transition-colors"
                >
                  {editing === plan.id ? "Fechar" : "Editar"}
                </button>
                <button
                  onClick={() => handleDeletePlan(plan.id)}
                  title="Remover plano"
                  className="grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-ink-soft mb-1">Nome do produto</label>
                <input
                  value={plan.name}
                  onChange={(e) => updatePlan(plan.id, { name: e.target.value })}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium outline-none focus:border-foreground"
                />
              </div>

              {/* Preço */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-ink-soft mb-1">Preço</label>
                  <input
                    value={plan.price}
                    onChange={(e) => updatePlan(plan.id, { price: e.target.value })}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-foreground"
                    placeholder="a partir de R$ 3.999"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-ink-soft mb-1">Período</label>
                  <input
                    value={plan.period}
                    onChange={(e) => updatePlan(plan.id, { period: e.target.value })}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-foreground"
                    placeholder="por imóvel"
                  />
                </div>
              </div>

              {/* Tag + Nota */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-ink-soft mb-1">Badge (opcional)</label>
                  <input
                    value={plan.tag ?? ""}
                    onChange={(e) => updatePlan(plan.id, { tag: e.target.value || undefined })}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-foreground"
                    placeholder="Mais pedido"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-ink-soft mb-1">Nota (opcional)</label>
                  <input
                    value={plan.note ?? ""}
                    onChange={(e) => updatePlan(plan.id, { note: e.target.value || undefined })}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-foreground"
                    placeholder="valor base para 2 terrenos"
                  />
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-ink-soft mb-1">Descrição</label>
                <textarea
                  value={plan.desc}
                  onChange={(e) => updatePlan(plan.id, { desc: e.target.value })}
                  rows={2}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-foreground resize-none"
                />
              </div>

              {/* Features */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] uppercase tracking-wider text-ink-soft">Itens inclusos</label>
                  <button onClick={() => addFeature(plan.id)}
                    className="inline-flex items-center gap-1 text-[11px] text-accent hover:text-accent/80 transition-colors">
                    <Plus className="h-3 w-3" /> Adicionar
                  </button>
                </div>
                <ul className="space-y-1.5">
                  {plan.features.map((f, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <Check className="h-3 w-3 shrink-0 text-accent" />
                      <input
                        value={f}
                        onChange={(e) => updateFeature(plan.id, idx, e.target.value)}
                        className="flex-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-foreground"
                      />
                      <button onClick={() => removeFeature(plan.id, idx)}
                        className="grid h-6 w-6 place-items-center rounded text-ink-soft hover:text-foreground transition-colors">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Sticky save */}
      <div className="sticky bottom-6 mt-8 flex justify-center">
        <button
          onClick={saveAll}
          className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium shadow-[0_8px_32px_-8px_oklch(0.16_0.01_60_/_0.3)] transition-all ${
            saved ? "bg-green-600 text-white" : "bg-foreground text-background hover:bg-foreground/90"
          }`}
        >
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? "Alterações salvas!" : "Salvar todas as alterações"}
        </button>
      </div>
    </div>
  );
}
