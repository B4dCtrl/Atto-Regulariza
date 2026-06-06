import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check, ArrowUpRight, MessageCircle, Building2, HardHat, Landmark } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { BlurReveal } from "@/components/landing/BlurReveal";
import { WHATSAPP } from "@/lib/brand";

export const Route = createFileRoute("/precos/institucional")({
  head: () => ({
    meta: [
      { title: "Preços institucionais — Regulariza" },
      {
        name: "description",
        content:
          "Planos sob medida para imobiliárias, construtoras e órgãos públicos. Volume, SLA e faturamento mensal.",
      },
    ],
  }),
  component: PrecosInstitucionalPage,
});

const plans = [
  {
    icon: Building2,
    name: "Imobiliária",
    price: "Sob consulta",
    period: "por imóvel ou mensal",
    desc: "Para carteiras de venda e locação com regularização recorrente.",
    features: [
      "Painel multi-imóvel",
      "Contas de gestor e corretor",
      "Status visível ao cliente final",
      "SLA por operação",
      "Suporte prioritário",
    ],
  },
  {
    icon: HardHat,
    name: "Construtora",
    price: "Sob consulta",
    period: "por empreendimento",
    tag: "Mais pedido",
    popular: true,
    desc: "Habite-se, averbações e entregas documentais por torre ou loteamento.",
    features: [
      "Visão por empreendimento",
      "Checklist por unidade",
      "Torre de controle central",
      "Validação documental",
      "Gerente de conta",
    ],
  },
  {
    icon: Landmark,
    name: "Órgão público / institucional",
    price: "Sob consulta",
    period: "contrato anual",
    desc: "Compliance, auditoria e operação em volume com NF mensal.",
    features: [
      "Contrato anual",
      "Relatórios exportáveis",
      "Contas master + sub-usuários",
      "SLAs personalizados",
      "Integração via API (Enterprise)",
    ],
  },
];

const compareRows = [
  { label: "Dashboard multi-imóvel", v: [true, true, true] },
  { label: "Torre de controle com SLAs", v: [true, true, true] },
  { label: "Múltiplas contas de gestor", v: [true, true, true] },
  { label: "API / integração CRM", v: [false, true, true] },
  { label: "Gerente dedicado (CSM)", v: [false, true, true] },
  { label: "NF mensal consolidada", v: [true, true, true] },
];

const faqs = [
  {
    q: "Como funciona a precificação?",
    a: "Depende do volume de imóveis ativos, cidades e complexidade média dos casos. Montamos proposta após uma call de diagnóstico.",
  },
  {
    q: "Existe mínimo de imóveis?",
    a: "Para imobiliárias enxutas, a partir de 5 imóveis ativos simultâneos. Construtoras e órgãos negociamos por empreendimento ou contrato.",
  },
  {
    q: "O cliente final vê o andamento?",
    a: "Sim. Você pode dar visibilidade ao proprietário ou comprador sem expor a operação interna da sua empresa.",
  },
  {
    q: "Atendem em quantas cidades?",
    a: "Operação em expansão com rede de profissionais locais. Confirmamos cobertura na proposta comercial.",
  },
  {
    q: "Quanto tempo para começar?",
    a: "Após assinatura, onboarding em 5–10 dias úteis: contas, playbooks e importação inicial da carteira.",
  },
];

function PrecosInstitucionalPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main className="pt-32">
        <section className="px-6 pb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-3xl"
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-ink-soft">
              B2B · Volume e SLA
            </div>
            <h1 className="font-serif text-[clamp(2.25rem,5.5vw,4.5rem)] leading-[1] tracking-tight text-balance">
              Planos sob medida
              <br />
              <em className="italic text-ink-soft">para volume.</em>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-ink-soft">
              Imobiliária, construtora ou instituição: proposta comercial alinhada ao seu fluxo, usuários e
              faturamento.
            </p>
            <a
              href={WHATSAPP.parceriaInstitucional}
              target="_blank"
              rel="noreferrer"
              className="group mt-8 inline-flex items-center gap-2 rounded-full bg-foreground py-3 pl-6 pr-2 text-base text-background transition-all hover:scale-[1.02]"
            >
              <MessageCircle className="h-4 w-4" />
              Falar com consultor
              <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-foreground transition-transform group-hover:rotate-12">
                <ArrowUpRight className="h-5 w-5" />
              </span>
            </a>
            <p className="mt-4 text-sm text-ink-soft">
              É pessoa física?{" "}
              <Link to="/precos" className="text-foreground underline-offset-4 hover:underline">
                Ver preços para proprietários
              </Link>
            </p>
          </motion.div>
        </section>

        <section className="px-6 pb-20">
          <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
            {plans.map((p) => (
              <BlurReveal key={p.name}>
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
                  <p.icon className={`mb-4 h-6 w-6 ${p.popular ? "text-accent" : "text-accent"}`} />
                  <div className={`text-xs ${p.popular ? "text-background/60" : "text-ink-soft"}`}>
                    {p.name}
                  </div>
                  <div className="mt-3 font-serif text-4xl leading-none">{p.price}</div>
                  <div className={`mt-1 text-xs ${p.popular ? "text-background/60" : "text-ink-soft"}`}>
                    {p.period}
                  </div>
                  <p
                    className={`mt-4 text-sm leading-relaxed ${p.popular ? "text-background/80" : "text-ink-soft"}`}
                  >
                    {p.desc}
                  </p>
                  <ul className="mt-6 space-y-2.5 text-sm">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <span
                          className={`mt-0.5 grid h-4 w-4 place-items-center rounded-[5px] ${
                            p.popular ? "bg-accent text-accent-foreground" : "bg-accent/15 text-accent"
                          }`}
                        >
                          <Check className="h-3 w-3" />
                        </span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href={WHATSAPP.parceriaInstitucional}
                    target="_blank"
                    rel="noreferrer"
                    className={`group mt-8 inline-flex items-center justify-center gap-2 rounded-full py-3 pl-5 pr-3 text-sm transition-all ${
                      p.popular
                        ? "bg-background text-foreground hover:scale-[1.02]"
                        : "bg-foreground text-background hover:scale-[1.02]"
                    }`}
                  >
                    Falar com consultor
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-accent-foreground transition-transform group-hover:rotate-12">
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </a>
                </div>
              </BlurReveal>
            ))}
          </div>
        </section>

        <section className="px-6 pb-24">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-surface-elevated ring-1 ring-border">
            <div className="grid grid-cols-4 border-b border-border bg-surface px-4 py-4 text-xs uppercase tracking-wider text-ink-soft sm:px-6">
              <div>Recursos</div>
              {plans.map((p) => (
                <div
                  key={p.name}
                  className="text-center font-medium normal-case tracking-normal text-foreground"
                >
                  {p.name.split(" ")[0]}
                </div>
              ))}
            </div>
            {compareRows.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-4 items-center border-b border-border px-4 py-3.5 text-sm last:border-0 sm:px-6"
              >
                <div className="text-ink-soft">{row.label}</div>
                {row.v.map((ok, j) => (
                  <div key={j} className="flex justify-center">
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

        <section className="px-6 pb-28">
          <div className="mx-auto max-w-4xl rounded-[36px] bg-foreground p-12 text-center text-background">
            <h2 className="font-serif text-4xl tracking-tight">Quer ver a operação antes?</h2>
            <p className="mt-3 text-background/70">
              Agende uma demo do painel institucional e da torre de controle.
            </p>
            <Link
              to="/institucional"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-background/30 px-6 py-3 text-base hover:border-background/60"
            >
              Conhecer solução institucional
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
