import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, ArrowUpRight, Building2, HardHat, Landmark,
  Phone, Mail, User, Briefcase, Send, CheckCircle,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { BlurReveal } from "@/components/landing/BlurReveal";

export const Route = createFileRoute("/precos/institucional")({
  head: () => ({
    meta: [
      { title: "Soluções B2B — Ato Regulariza" },
      {
        name: "description",
        content:
          "Imobiliária, construtora ou órgão público: solução sob medida para regularização em volume. Fale com um consultor.",
      },
    ],
  }),
  component: PrecosInstitucionalPage,
});

/* ─── Segments (no prices) */
const segments = [
  {
    icon: Building2,
    name: "Imobiliária",
    desc: "Para carteiras com regularização recorrente em compra, venda e locação.",
    features: [
      "Painel multi-imóvel por corretor",
      "Visibilidade do cliente final",
      "SLA por operação definido em contrato",
      "Suporte prioritário e gerente de conta",
    ],
  },
  {
    icon: HardHat,
    name: "Construtora",
    tag: "Mais pedido",
    popular: true,
    desc: "Habite-se, averbações e entregas documentais por torre ou loteamento.",
    features: [
      "Visão por empreendimento e torre",
      "Checklist por unidade",
      "Torre de controle central",
      "Gerente de conta dedicado",
    ],
  },
  {
    icon: Landmark,
    name: "Órgão público",
    desc: "Compliance, auditoria e operação em volume com NF mensal e API.",
    features: [
      "Contrato anual com SLAs personalizados",
      "Relatórios exportáveis e auditoria",
      "Contas master + sub-usuários",
      "Integração via API (Enterprise)",
    ],
  },
];

const compareRows = [
  { label: "Dashboard multi-imóvel",       v: [true, true, true] },
  { label: "Torre de controle com SLAs",   v: [true, true, true] },
  { label: "Múltiplas contas de gestor",   v: [true, true, true] },
  { label: "API / integração CRM",         v: [false, true, true] },
  { label: "Gerente dedicado (CSM)",       v: [false, true, true] },
  { label: "NF mensal consolidada",        v: [true, true, true] },
];

const faqs = [
  { q: "Como funciona a precificação?",     a: "Depende do volume de imóveis ativos, cidades e complexidade média dos casos. Montamos proposta após uma call de diagnóstico." },
  { q: "Existe mínimo de imóveis?",         a: "Para imobiliárias enxutas, a partir de 5 imóveis ativos simultâneos. Construtoras e órgãos negociamos por empreendimento ou contrato." },
  { q: "O cliente final vê o andamento?",   a: "Sim. Você pode dar visibilidade ao proprietário ou comprador sem expor a operação interna da sua empresa." },
  { q: "Atendem em quantas cidades?",       a: "Operação em expansão com rede de profissionais locais. Confirmamos cobertura na proposta comercial." },
  { q: "Quanto tempo para começar?",        a: "Após assinatura, onboarding em 5–10 dias úteis: contas, playbooks e importação inicial da carteira." },
];

const SEGMENTS_OPTIONS = ["Imobiliária", "Construtora", "Órgão público / Institucional", "Incorporadora", "Outro"];

function storeLeadAppend(lead: object) {
  try {
    const existing = JSON.parse(localStorage.getItem("regulariza-leads") ?? "[]");
    localStorage.setItem("regulariza-leads", JSON.stringify([lead, ...existing]));
  } catch { /* noop */ }
}

const EASE = [0.22, 1, 0.36, 1] as const;

function PrecosInstitucionalPage() {
  const [name,      setName]      = useState("");
  const [company,   setCompany]   = useState("");
  const [segment,   setSegment]   = useState("");
  const [email,     setEmail]     = useState("");
  const [phone,     setPhone]     = useState("");
  const [situation, setSituation] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    const lead = {
      id:              crypto.randomUUID(),
      name,
      phone,
      email,
      city:            "",
      state:           "",
      propertyType:    segment || "Empresa",
      situation:       situation || `Consulta B2B — ${company}`,
      urgency:         "media" as const,
      status:          "novo" as const,
      professionalName: null,
      notes:           `Empresa: ${company} | Segmento: ${segment}`,
      createdAt:       new Date().toISOString(),
    };

    storeLeadAppend(lead);
    setTimeout(() => { setLoading(false); setSubmitted(true); }, 700);
  }

  const inputCls =
    "w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none " +
    "focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10 transition-colors " +
    "placeholder:text-ink-soft/50";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main className="pt-32">
        {/* ── Hero ── */}
        <section className="px-6 pb-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-3xl"
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-ink-soft">
              B2B · Volume e SLA
            </div>
            <h1 className="font-serif text-[clamp(2.25rem,5.5vw,4.5rem)] leading-[1] tracking-tight text-balance">
              Regularização em escala
              <br />
              <em className="italic text-ink-soft">para empresas.</em>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-ink-soft">
              Imobiliária, construtora ou órgão público — proposta personalizada com SLA, volume e faturamento adequados ao seu negócio.
            </p>
            <p className="mt-4 text-sm text-ink-soft">
              É pessoa física?{" "}
              <Link to="/precos" className="text-foreground underline-offset-4 hover:underline">
                Ver preços para proprietários
              </Link>
            </p>
          </motion.div>
        </section>

        {/* ── Segments (features, no price) ── */}
        <section className="px-6 pb-16">
          <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
            {segments.map((s) => (
              <BlurReveal key={s.name}>
                <div
                  className={`relative flex h-full flex-col rounded-3xl p-7 ring-1 transition-all hover:-translate-y-1 ${
                    s.popular
                      ? "bg-foreground text-background ring-foreground shadow-[0_30px_80px_-40px_oklch(0.66_0.18_38_/_0.6)]"
                      : "bg-surface-elevated ring-border"
                  }`}
                >
                  {s.tag && (
                    <span className="absolute -top-3 left-7 rounded-full bg-accent px-3 py-1 text-[11px] text-accent-foreground">
                      {s.tag}
                    </span>
                  )}
                  <s.icon className="mb-4 h-6 w-6 text-accent" />
                  <div className={`text-xs ${s.popular ? "text-background/60" : "text-ink-soft"}`}>{s.name}</div>
                  <p className={`mt-3 text-sm leading-relaxed ${s.popular ? "text-background/80" : "text-ink-soft"}`}>
                    {s.desc}
                  </p>
                  <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                    {s.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <span className={`mt-0.5 grid h-4 w-4 place-items-center rounded-[5px] ${s.popular ? "bg-accent text-accent-foreground" : "bg-accent/15 text-accent"}`}>
                          <Check className="h-3 w-3" />
                        </span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href="#consulta"
                    className={`group mt-6 inline-flex items-center justify-center gap-2 rounded-full py-3 pl-5 pr-3 text-sm transition-all hover:scale-[1.02] ${
                      s.popular ? "bg-background text-foreground" : "bg-foreground text-background"
                    }`}
                  >
                    Consultar caso
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-accent-foreground transition-transform group-hover:rotate-12">
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </a>
                </div>
              </BlurReveal>
            ))}
          </div>
        </section>

        {/* ── Consultation form ── */}
        <section id="consulta" className="px-6 pb-20">
          <div className="mx-auto max-w-2xl">
            <BlurReveal>
              <div className="rounded-3xl bg-surface-elevated ring-1 ring-border p-8 sm:p-10">
                <div className="mb-6 text-center">
                  <div className="text-[10px] uppercase tracking-widest text-ink-soft">Proposta personalizada</div>
                  <h2 className="mt-1 font-serif text-3xl tracking-tight">Consultar caso</h2>
                  <p className="mt-2 text-sm text-ink-soft">
                    Sem tabela de preços — cada operação é diferente. Responderemos em até 24h com uma proposta alinhada ao seu volume.
                  </p>
                </div>

                <AnimatePresence mode="wait">
                  {submitted ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: EASE }}
                      className="py-6 text-center"
                    >
                      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-accent/15">
                        <CheckCircle className="h-7 w-7 text-accent" />
                      </div>
                      <h3 className="font-serif text-2xl">Consulta recebida!</h3>
                      <p className="mt-2 text-sm text-ink-soft">
                        Um especialista em soluções empresariais entrará em contato em até 24h para agendar uma call de diagnóstico.
                      </p>
                      <p className="mt-1 text-xs text-ink-soft">Respondemos no e-mail: <strong>{email}</strong></p>
                    </motion.div>
                  ) : (
                    <motion.form
                      key="form"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                      onSubmit={handleSubmit}
                      className="space-y-3"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs text-ink-soft">Nome *</label>
                          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 focus-within:border-foreground/30 transition-colors">
                            <User className="h-4 w-4 shrink-0 text-ink-soft" />
                            <input
                              required value={name} onChange={(e) => setName(e.target.value)}
                              placeholder="Seu nome"
                              className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-soft/50"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-ink-soft">Empresa *</label>
                          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 focus-within:border-foreground/30 transition-colors">
                            <Briefcase className="h-4 w-4 shrink-0 text-ink-soft" />
                            <input
                              required value={company} onChange={(e) => setCompany(e.target.value)}
                              placeholder="Nome da empresa"
                              className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-soft/50"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-ink-soft">Segmento</label>
                        <select
                          value={segment} onChange={(e) => setSegment(e.target.value)}
                          className={`${inputCls} cursor-pointer`}
                        >
                          <option value="">Selecione o tipo de empresa...</option>
                          {SEGMENTS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs text-ink-soft">E-mail *</label>
                          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 focus-within:border-foreground/30 transition-colors">
                            <Mail className="h-4 w-4 shrink-0 text-ink-soft" />
                            <input
                              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                              placeholder="voce@empresa.com"
                              className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-soft/50"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-ink-soft">Telefone *</label>
                          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 focus-within:border-foreground/30 transition-colors">
                            <Phone className="h-4 w-4 shrink-0 text-ink-soft" />
                            <input
                              type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)}
                              placeholder="(11) 99999-9999"
                              className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-soft/50"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-ink-soft">
                          Descreva a necessidade *
                        </label>
                        <textarea
                          required rows={4}
                          value={situation} onChange={(e) => setSituation(e.target.value)}
                          placeholder="Ex: Somos uma imobiliária com ~20 imóveis que precisam de averbação por mês. Precisamos de um parceiro para operacionalizar esse fluxo com SLA definido..."
                          className={`${inputCls} resize-none`}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="group mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3 text-sm text-background hover:bg-foreground/90 disabled:opacity-60 transition-colors"
                      >
                        {loading ? "Enviando..." : "Solicitar proposta"}
                        {!loading && (
                          <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-accent-foreground transition-transform group-hover:rotate-12">
                            <Send className="h-4 w-4" />
                          </span>
                        )}
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </BlurReveal>
          </div>
        </section>

        {/* ── Feature comparison table ── */}
        <section className="px-6 pb-24">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-surface-elevated ring-1 ring-border">
            <div className="grid grid-cols-4 border-b border-border bg-surface px-4 py-4 text-xs uppercase tracking-wider text-ink-soft sm:px-6">
              <div>Recursos</div>
              {segments.map((s) => (
                <div key={s.name} className="hidden text-center font-medium normal-case tracking-normal text-foreground sm:block">
                  {s.name.split(" ")[0]}
                </div>
              ))}
            </div>
            {compareRows.map((row, i) => (
              <div key={i} className="grid grid-cols-4 items-center border-b border-border px-4 py-3.5 text-sm last:border-0 sm:px-6">
                <div className="text-ink-soft">{row.label}</div>
                {row.v.map((ok, j) => (
                  <div key={j} className="hidden justify-center sm:flex">
                    {ok ? (
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-accent/15 text-accent">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <span className="text-ink-soft/40">—</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="px-6 pb-24">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 text-center">
              <h2 className="font-serif text-4xl tracking-tight">Dúvidas institucionais</h2>
            </div>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((f, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="border-border">
                  <AccordionTrigger className="text-left text-base">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-ink-soft">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <section className="px-6 pb-28">
          <div className="mx-auto max-w-4xl rounded-[36px] bg-foreground p-12 text-center text-background">
            <h2 className="font-serif text-4xl tracking-tight">Quer ver a operação antes?</h2>
            <p className="mt-3 text-background/70">
              Agende uma demo do painel institucional — sem compromisso.
            </p>
            <a
              href="#consulta"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-background py-3 pl-6 pr-3 text-base text-foreground hover:scale-[1.02] transition-transform"
            >
              Solicitar demonstração
              <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-accent-foreground">
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
