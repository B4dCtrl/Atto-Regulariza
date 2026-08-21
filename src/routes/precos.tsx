import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowUpRight, Sparkles, Building2, X, ChevronRight, MapPin, Phone, Mail, User } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { BlurReveal } from "@/components/landing/BlurReveal";

export const Route = createFileRoute("/precos")({
  head: () => ({
    meta: [
      { title: "Preços — Ato Regulariza" },
      {
        name: "description",
        content: "Preços por produto para regularizar seu imóvel. Sem mensalidade, sem letras miúdas.",
      },
    ],
  }),
  component: PrecosPage,
});

/* ─── Product list */
const products = [
  {
    id: "matricula",
    name: "Regularização de matrícula",
    price: "a partir de R$ 3.999,99",
    period: "por imóvel",
    desc: "Atualização de registro, pendências cartoriais e documentação básica.",
    features: [
      "Análise documental completa",
      "Especialista designado",
      "Acompanhamento no painel",
      "Tramitação cartorial",
    ],
  },
  {
    id: "habitese",
    name: "Habite-se / Averbação",
    price: "a partir de R$ 3.999,99",
    period: "por imóvel",
    tag: "Mais pedido",
    popular: true,
    desc: "Legalização junto à prefeitura e registro da construção ou alteração.",
    features: [
      "Prefeitura + cartório",
      "Resolução de exigências",
      "Timeline visual",
      "Suporte prioritário",
    ],
  },
  {
    id: "complexo",
    name: "Casos complexos",
    price: "Sob consulta",
    period: "usucapião, inventário, multipropriedade",
    desc: "Situações que exigem estratégia jurídica e operação dedicada.",
    features: [
      "Equipe especializada",
      "Advogado no caso",
      "Prazo personalizado",
      "Mediação cartorial",
    ],
  },
  {
    id: "unificacao",
    name: "Unificação / Desmembramento",
    price: "a partir de R$ 3.999,00",
    period: "por imóvel",
    note: "valor base para 2 terrenos",
    desc: "União ou divisão de terrenos com nova matrícula registrada.",
    features: [
      "Planta e memorial descritivo",
      "Aprovação na prefeitura",
      "Abertura de novas matrículas",
      "Registro em cartório",
    ],
  },
  {
    id: "retificacao",
    name: "Retificação",
    price: "a partir de R$ 2.899,00",
    period: "por imóvel",
    desc: "Correção de área, medidas ou dados divergentes na matrícula.",
    features: [
      "Levantamento e georreferenciamento",
      "Anuência de confrontantes",
      "Planta técnica assinada",
      "Averbação na matrícula",
    ],
  },
  {
    id: "usucapiao",
    name: "Usucapião extrajudicial",
    price: "Sob consulta",
    period: "por imóvel",
    desc: "Reconhecimento de propriedade sem processo judicial, em cartório.",
    features: [
      "Ata notarial",
      "Planta e memorial assinados",
      "Advogado dedicado",
      "Sem ação na justiça",
    ],
  },
];

const compareRows = [
  { label: "Painel acompanhável em tempo real", v: [true, true, true] },
  { label: "Tramitação em cartório",            v: [true, true, true] },
  { label: "Tramitação em prefeitura",          v: [false, true, true] },
  { label: "Casos complexos (usucapião, inv.)", v: [false, false, true] },
  { label: "Equipe jurídica dedicada",          v: [false, false, true] },
];

const faqs = [
  { q: "Em quanto tempo um especialista assume meu caso?",         a: "Em até 24 horas úteis após o cadastro e triagem." },
  { q: "Posso parcelar?",                                          a: "Sim. Muitos casos podem ser parcelados — confirmamos na avaliação." },
  { q: "E se eu já comecei a regularização em outro lugar?",       a: "Sem problema. Nossa equipe assume de onde está, sem refazer trabalho." },
  { q: "Sou imobiliária ou construtora?",                          a: "Veja planos institucionais com volume, SLA e multi-usuário." },
  { q: "Como funciona depois do cadastro?",                        a: "Você preenche a situação do imóvel, nossa equipe analisa e um especialista entra em contato em até 24h." },
];

const PROP_TYPES = ["Casa", "Apartamento", "Terreno", "Sítio / Chácara", "Galpão / Comercial", "Imóvel rural", "Outro"];
const STATES     = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];


const EASE = [0.22, 1, 0.36, 1] as const;

/* ─── Main component */
function PrecosPage() {
  /* Modal state */
  const [modalProduct, setModalProduct] = useState<string | null>(null);
  const [step,         setStep]         = useState(1);
  const [done,         setDone]         = useState(false);
  const [loading,      setLoading]      = useState(false);

  /* Step 1 fields */
  const [name,  setName]  = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  /* Step 2 fields */
  const [propType,   setPropType]   = useState("");
  const [city,       setCity]       = useState("");
  const [state,      setState]      = useState("SP");
  const [situation,  setSituation]  = useState("");

  /* Dynamic plans */
  const [planos, setPlanos] = useState(products);
  useEffect(() => {
    supabase.from("pricing_plans").select("*").eq("visible", true).order("sort")
      .then(({ data }) => {
        if (data && data.length) {
          setPlanos(data.map((p) => ({
            id: p.id, name: p.name, price: p.price ?? "", period: p.period ?? "",
            desc: p.descr ?? "", features: p.features ?? [],
            popular: p.popular, tag: p.tag ?? undefined, note: p.note ?? undefined,
          })));
        }
      });
  }, []);

  function openModal(productName: string) {
    setModalProduct(productName);
    setStep(1);
    setDone(false);
    setName(""); setEmail(""); setPhone("");
    setPropType(""); setCity(""); setState("SP"); setSituation("");
  }

  function closeModal() { setModalProduct(null); }

  function submitStep1(e: FormEvent) {
    e.preventDefault();
    setStep(2);
  }

  async function submitStep2(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    await supabase.from("leads").insert({
      name,
      email,
      phone,
      city,
      state,
      tipo_imovel: propType || "Imóvel",
      situacao:    situation || `Interesse em: ${modalProduct}`,
      notes:       `Produto de interesse: ${modalProduct}`,
      source:      "precos",
    });
    setLoading(false);
    setDone(true);
  }

  const inputCls =
    "w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none " +
    "focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10 transition-colors " +
    "placeholder:text-ink-soft/50";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />

      {/* ── Lead Capture Modal ── */}
      <AnimatePresence>
        {modalProduct && (
          <motion.div
            key="modal-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="relative w-full max-w-lg rounded-3xl bg-background shadow-[0_40px_120px_-30px_oklch(0.16_0.01_60_/_0.4)] ring-1 ring-border overflow-hidden"
            >
              {/* Close */}
              <button
                onClick={closeModal}
                className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-surface text-ink-soft hover:bg-surface-elevated transition-colors"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Progress bar */}
              {!done && (
                <div className="h-1 w-full bg-surface">
                  <motion.div
                    animate={{ width: step === 1 ? "50%" : "100%" }}
                    transition={{ duration: 0.4, ease: EASE }}
                    className="h-full rounded-full bg-accent"
                  />
                </div>
              )}

              <div className="p-6 sm:p-8">
                <AnimatePresence mode="wait">
                  {/* ── SUCESSO ── */}
                  {done && (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.3, ease: EASE }}
                      className="py-4 text-center"
                    >
                      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-accent/15">
                        <Check className="h-7 w-7 text-accent" />
                      </div>
                      <h3 className="font-serif text-2xl tracking-tight">Cadastro recebido!</h3>
                      <p className="mt-2 text-sm text-ink-soft">
                        Em até 24 horas úteis um especialista analisará seu caso e entrará em contato.
                      </p>
                      <p className="mt-1 text-xs text-ink-soft">
                        Vamos enviar atualizações para <strong>{email}</strong>
                      </p>
                      <div className="mt-6 rounded-2xl bg-surface p-4 text-left text-sm">
                        <div className="text-[10px] uppercase tracking-widest text-ink-soft mb-2">Enquanto isso</div>
                        <p className="text-ink-soft leading-relaxed">
                          Você pode criar sua conta para acompanhar o andamento do processo assim que um profissional assumir seu caso.
                        </p>
                        <Link
                          to="/entrar"
                          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:underline"
                        >
                          Criar conta agora <ChevronRight className="h-4 w-4" />
                        </Link>
                      </div>
                      <button
                        onClick={closeModal}
                        className="mt-4 w-full rounded-full border border-border py-2.5 text-sm text-ink-soft hover:bg-surface transition-colors"
                      >
                        Fechar
                      </button>
                    </motion.div>
                  )}

                  {/* ── STEP 1: Dados pessoais ── */}
                  {!done && step === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.22, ease: EASE }}
                    >
                      <div className="mb-5">
                        <div className="text-[10px] uppercase tracking-widest text-ink-soft">Passo 1 de 2</div>
                        <h3 className="mt-1 font-serif text-2xl tracking-tight">Seus dados</h3>
                        <p className="mt-1 text-sm text-ink-soft">
                          Interesse em: <span className="font-medium text-foreground">{modalProduct}</span>
                        </p>
                      </div>
                      <form onSubmit={submitStep1} className="space-y-3">
                        <div>
                          <label className="mb-1 block text-xs text-ink-soft">Nome completo *</label>
                          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 focus-within:border-foreground/30 transition-colors">
                            <User className="h-4 w-4 shrink-0 text-ink-soft" />
                            <input
                              required value={name} onChange={(e) => setName(e.target.value)}
                              placeholder="Seu nome" className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-soft/50"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-ink-soft">E-mail *</label>
                          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 focus-within:border-foreground/30 transition-colors">
                            <Mail className="h-4 w-4 shrink-0 text-ink-soft" />
                            <input
                              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                              placeholder="voce@email.com" className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-soft/50"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-ink-soft">WhatsApp / Telefone *</label>
                          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 focus-within:border-foreground/30 transition-colors">
                            <Phone className="h-4 w-4 shrink-0 text-ink-soft" />
                            <input
                              type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)}
                              placeholder="(11) 99999-9999" className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-soft/50"
                            />
                          </div>
                        </div>
                        <button
                          type="submit"
                          className="group mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3 text-sm text-background hover:bg-foreground/90 transition-colors"
                        >
                          Continuar
                          <span className="grid h-7 w-7 place-items-center rounded-full bg-accent transition-transform group-hover:rotate-12">
                            <ChevronRight className="h-4 w-4" />
                          </span>
                        </button>
                      </form>
                    </motion.div>
                  )}

                  {/* ── STEP 2: Situação do imóvel ── */}
                  {!done && step === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.22, ease: EASE }}
                    >
                      <div className="mb-5">
                        <button
                          onClick={() => setStep(1)}
                          className="mb-2 flex items-center gap-1 text-xs text-ink-soft hover:text-foreground transition-colors"
                        >
                          ← Voltar
                        </button>
                        <div className="text-[10px] uppercase tracking-widest text-ink-soft">Passo 2 de 2</div>
                        <h3 className="mt-1 font-serif text-2xl tracking-tight">Seu imóvel</h3>
                        <p className="mt-1 text-sm text-ink-soft">Nos conte a situação para agilizar a análise.</p>
                      </div>
                      <form onSubmit={submitStep2} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-xs text-ink-soft">Tipo de imóvel</label>
                            <select value={propType} onChange={(e) => setPropType(e.target.value)} className={`${inputCls} cursor-pointer`}>
                              <option value="">Selecione...</option>
                              {PROP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-ink-soft">Estado</label>
                            <select value={state} onChange={(e) => setState(e.target.value)} className={`${inputCls} cursor-pointer`}>
                              {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-ink-soft">Cidade *</label>
                          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 focus-within:border-foreground/30 transition-colors">
                            <MapPin className="h-4 w-4 shrink-0 text-ink-soft" />
                            <input
                              required value={city} onChange={(e) => setCity(e.target.value)}
                              placeholder="Sua cidade" className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-soft/50"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-ink-soft">Situação do imóvel *</label>
                          <textarea
                            required rows={3}
                            value={situation} onChange={(e) => setSituation(e.target.value)}
                            placeholder="Ex: Construí um cômodo em 2019 sem aprovação da prefeitura. Preciso regularizar para vender o imóvel..."
                            className={`${inputCls} resize-none`}
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={loading}
                          className="group mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3 text-sm text-background hover:bg-foreground/90 disabled:opacity-60 transition-colors"
                        >
                          {loading ? "Enviando..." : "Cadastrar meu caso"}
                          {!loading && (
                            <span className="grid h-7 w-7 place-items-center rounded-full bg-accent transition-transform group-hover:rotate-12">
                              <ArrowUpRight className="h-4 w-4" />
                            </span>
                          )}
                        </button>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Page content ── */}
      <main className="pt-32">
        {/* Hero */}
        <section className="px-6 pb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-3xl"
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-ink-soft">
              <Sparkles className="h-3 w-3 text-accent" /> Pessoa física
            </div>
            <h1 className="font-serif text-[clamp(2.25rem,5.5vw,4.5rem)] leading-[1] tracking-tight text-balance">
              Preços por produto,
              <br />
              <em className="italic text-ink-soft">sem mensalidade.</em>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-ink-soft">
              Cada imóvel é diferente. Cadastre seu caso — em até 24h um especialista analisa e entra em contato.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => openModal("Avaliação gratuita")}
                className="group inline-flex items-center gap-2 rounded-full bg-foreground py-3 pl-6 pr-2 text-base text-background transition-all hover:scale-[1.02]"
              >
                Cadastrar meu caso
                <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-foreground transition-transform group-hover:rotate-12">
                  <ArrowUpRight className="h-5 w-5" />
                </span>
              </button>
              <Link
                to="/precos/institucional"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-6 py-3 text-base transition-all hover:border-foreground/30"
              >
                <Building2 className="h-4 w-4" />
                Sou empresa · B2B
              </Link>
            </div>
          </motion.div>
        </section>

        {/* Pricing cards */}
        <section className="px-6 pb-20">
          <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
            {planos.map((p, i) => (
              <BlurReveal key={p.id}>
                <div
                  className={`relative flex h-full flex-col rounded-3xl p-7 ring-1 transition-all hover:-translate-y-1 ${
                    p.popular
                      ? "bg-foreground text-background ring-foreground shadow-[0_30px_80px_-40px_oklch(0.66_0.18_38_/_0.6)]"
                      : "bg-surface-elevated ring-border"
                  }`}
                >
                  {p.tag && (
                    <span className="absolute -top-3 left-7 rounded-full bg-accent px-3 py-1 text-[11px] text-accent-foreground">
                      {p.tag}
                    </span>
                  )}
                  <div className={`text-center font-serif text-2xl italic leading-snug sm:text-[1.7rem] ${p.popular ? "text-background" : "text-foreground"}`}>
                    {p.name}
                  </div>
                  <div className="mt-3 text-center font-serif text-3xl leading-tight sm:text-4xl">{p.price}</div>
                  {(p as any).note && (
                    <div className={`mt-1 text-center text-[11px] italic ${p.popular ? "text-background/50" : "text-ink-soft/70"}`}>
                      {(p as any).note}
                    </div>
                  )}
                  <div className={`mt-1 text-center text-xs ${p.popular ? "text-background/60" : "text-ink-soft"}`}>
                    {p.period}
                  </div>
                  <p className={`mt-4 text-sm leading-relaxed ${p.popular ? "text-background/80" : "text-ink-soft"}`}>
                    {p.desc}
                  </p>
                  <ul className="mt-6 space-y-2.5 text-sm flex-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <span className={`mt-0.5 grid h-4 w-4 place-items-center rounded-[5px] ${p.popular ? "bg-accent text-accent-foreground" : "bg-accent/15 text-accent"}`}>
                          <Check className="h-3 w-3" />
                        </span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => openModal(p.name)}
                    className={`group mt-8 inline-flex items-center justify-center gap-2 rounded-full py-3 pl-5 pr-3 text-sm transition-all hover:scale-[1.02] ${
                      p.popular
                        ? "bg-background text-foreground"
                        : "bg-foreground text-background"
                    }`}
                  >
                    {i === 2 || i === 5 ? "Consultar caso" : "Cadastrar interesse"}
                    <span className={`grid h-7 w-7 place-items-center rounded-full bg-accent text-accent-foreground transition-transform group-hover:rotate-12`}>
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </button>
                </div>
              </BlurReveal>
            ))}
          </div>
        </section>

        {/* Comparison table */}
        <section className="px-6 pb-24">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-surface-elevated ring-1 ring-border">
            <div className="grid grid-cols-4 border-b border-border bg-surface px-4 py-4 text-xs uppercase tracking-wider text-ink-soft sm:px-6">
              <div>Comparativo</div>
              {products.slice(0, 3).map((p) => (
                <div key={p.id} className="hidden text-center font-medium normal-case tracking-normal text-foreground sm:block">
                  {p.name.split(" ")[0]}
                </div>
              ))}
            </div>
            {compareRows.map((row, i) => (
              <div key={i} className="grid grid-cols-4 items-center border-b border-border px-4 py-3.5 text-sm last:border-0 sm:px-6">
                <div className="col-span-1 text-ink-soft">{row.label}</div>
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

        {/* FAQ */}
        <section className="px-6 pb-24">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 text-center">
              <h2 className="font-serif text-4xl tracking-tight">Dúvidas frequentes</h2>
            </div>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((f, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="border-border">
                  <AccordionTrigger className="text-left text-base">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-ink-soft">
                    {f.q.includes("imobiliária") ? (
                      <><Link to="/precos/institucional" className="text-foreground underline">Ver preços B2B</Link>.</>
                    ) : f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="px-6 pb-28">
          <div className="mx-auto max-w-4xl rounded-[36px] bg-foreground p-12 text-center text-background">
            <h2 className="font-serif text-4xl tracking-tight">Ainda em dúvida?</h2>
            <p className="mt-3 text-background/70">Cadastre o seu caso — respondemos em até 24h, sem juridiquês.</p>
            <button
              onClick={() => openModal("Consulta geral")}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-background py-3 pl-6 pr-3 text-base text-foreground hover:scale-[1.02] transition-transform"
            >
              Cadastrar meu caso
              <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-accent-foreground">
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
