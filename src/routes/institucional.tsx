import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Building2,
  HardHat,
  Landmark,
  MessageCircle,
  Layers,
  BarChart3,
  Users,
  Plug,
  FileText,
  Shield,
} from "lucide-react";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { BlurReveal } from "@/components/landing/BlurReveal";
import { WHATSAPP } from "@/lib/brand";

export const Route = createFileRoute("/institucional")({
  head: () => ({
    meta: [
      { title: "Institucional — Ato Regulariza" },
      {
        name: "description",
        content:
          "Regularização em escala para imobiliárias, construtoras e órgãos públicos. SLAs, dashboard multi-imóvel e operação padronizada.",
      },
    ],
  }),
  component: InstitucionalPage,
});

const segments = [
  {
    icon: Building2,
    title: "Imobiliárias",
    desc: "Regularize carteira de imóveis com visibilidade para corretores e clientes finais.",
    bullets: ["Painel por imóvel", "Status para o cliente final", "SLA por operação"],
  },
  {
    icon: HardHat,
    title: "Construtoras",
    desc: "Habite-se, averbações e entrega documental alinhada ao ritmo do empreendimento.",
    bullets: ["Visão por empreendimento", "Checklist por unidade", "Prazos consolidados"],
  },
  {
    icon: Landmark,
    title: "Órgãos e instituições",
    desc: "Operação auditável, contratos anuais e relatórios para compliance.",
    bullets: ["Contas master + equipes", "Relatórios exportáveis", "Contrato anual"],
  },
];

const benefits = [
  { icon: Layers, t: "Portfolio centralizado", d: "Todos os imóveis e etapas em um só lugar — sem planilhas." },
  { icon: BarChart3, t: "SLAs e métricas", d: "Tempo por etapa, gargalos e performance por cidade." },
  { icon: Users, t: "Contas e permissões", d: "Gestor master, corretores e backoffice com acessos distintos." },
  { icon: Plug, t: "Integração via API", d: "Conecte CRM, ERP ou portal de vendas (planos Enterprise)." },
  { icon: FileText, t: "NF mensal", d: "Faturamento consolidado para financeiro e compliance." },
  { icon: Shield, t: "Qualidade operacional", d: "Playbooks padronizados e revisão central de documentos." },
];

const useCases = [
  "Carteira de usados com pendências de matrícula antes da venda",
  "Entrega de unidades em lançamento com habite-se em lote",
  "Regularização de patrimônio corporativo multi-cidade",
  "Parceria white-label para escritórios e redes imobiliárias",
];

const logos = ["Imob Partner", "Grupo Horizonte", "Construtora Atlas", "Rede Patrimonial", "Urban Corp"];

function InstitucionalPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main className="pt-28">
        {/* Hero */}
        <section className="px-6 pb-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-4xl"
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-ink-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Para empresas e instituições
            </div>
            <h1 className="font-serif text-[clamp(2.25rem,5.5vw,4.75rem)] leading-[0.98] tracking-tight text-balance">
              Regularização em escala para imobiliárias, construtoras e{" "}
              <em className="italic text-ink-soft">órgãos públicos.</em>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
              A mesma clareza que o proprietário vê no painel — aplicada à sua operação inteira.
              Multi-imóvel, SLAs, equipe e previsibilidade.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a
                href={WHATSAPP.consultor}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex items-center gap-2 rounded-full bg-foreground py-3 pl-6 pr-2 text-base text-background transition-all hover:scale-[1.02]"
              >
                Falar com consultor
                <span className="grid h-9 w-9 place-items-center rounded-full bg-accent transition-transform group-hover:rotate-12">
                  <ArrowUpRight className="h-5 w-5" />
                </span>
              </a>
              <Link
                to="/precos/institucional"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-6 py-3 text-base transition-all hover:border-foreground/30"
              >
                Ver planos institucionais
              </Link>
            </div>
          </motion.div>
        </section>

        {/* Segmentos */}
        <section className="px-6 pb-24">
          <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
            {segments.map((s, i) => (
              <BlurReveal key={s.title}>
                <div className="flex h-full flex-col rounded-3xl bg-surface-elevated p-7 ring-1 ring-border transition-all hover:-translate-y-1">
                  <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-foreground text-background">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <h2 className="font-serif text-2xl tracking-tight">{s.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.desc}</p>
                  <ul className="mt-5 space-y-2 text-sm text-ink-soft">
                    {s.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-2">
                        <span className="h-1 w-1 rounded-full bg-accent" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </BlurReveal>
            ))}
          </div>
        </section>

        {/* Benefícios */}
        <section className="border-y border-border bg-surface/50 px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-14 text-center">
              <h2 className="font-serif text-[clamp(1.75rem,4vw,3rem)] tracking-tight">
                Infraestrutura operacional, não só documentos.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-ink-soft">
                Torre de controle, padronização entre cidades e visibilidade para quem vende, constrói ou audita.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {benefits.map((b) => (
                <div
                  key={b.t}
                  className="rounded-2xl bg-background p-6 ring-1 ring-border"
                >
                  <b.icon className="mb-4 h-5 w-5 text-accent" />
                  <h3 className="font-medium">{b.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{b.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Casos de uso */}
        <section className="px-6 py-24">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="mb-4 text-xs uppercase tracking-widest text-ink-soft">Casos de uso</div>
              <h2 className="font-serif text-4xl tracking-tight">Onde empresas usam a plataforma.</h2>
              <ul className="mt-8 space-y-4">
                {useCases.map((u) => (
                  <li key={u} className="flex gap-3 text-sm leading-relaxed text-ink-soft">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {u}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl bg-foreground p-8 text-background">
              <div className="text-xs uppercase tracking-widest text-background/60">Operação típica</div>
              <div className="mt-3 font-serif text-3xl leading-tight">47 imóveis ativos · 12 em prefeitura</div>
              <div className="mt-6 h-2 overflow-hidden rounded-full bg-background/15">
                <div className="h-full w-[68%] rounded-full bg-accent" />
              </div>
              <p className="mt-4 text-sm text-background/70">
                Dashboard consolidado com SLA médio de 23 dias por etapa cartorial — visível para gestores e clientes finais.
              </p>
            </div>
          </div>
        </section>

        {/* Logos placeholder */}
        <section className="px-6 pb-20">
          <p className="mb-8 text-center text-xs uppercase tracking-widest text-ink-soft">
            Parceiros em operação piloto
          </p>
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {logos.map((name) => (
              <span key={name} className="font-serif text-lg text-ink-soft/50">
                {name}
              </span>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 pb-28">
          <div className="mx-auto max-w-4xl rounded-[36px] bg-foreground px-8 py-16 text-center text-background sm:px-12">
            <h2 className="font-serif text-[clamp(2rem,4vw,3.25rem)] tracking-tight">
              Vamos desenhar sua operação.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-background/70">
              Conte volume, cidades e tipo de imóvel. Montamos proposta com SLA, usuários e modelo de faturamento.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a
                href={WHATSAPP.parceriaInstitucional}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-background py-3 pl-6 pr-3 text-base text-foreground"
              >
                <MessageCircle className="h-4 w-4" />
                Falar com consultor
                <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-accent-foreground">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </a>
              <Link
                to="/precos/institucional"
                className="rounded-full border border-background/30 px-6 py-3 text-base transition-colors hover:border-background/60"
              >
                Ver preços B2B
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
