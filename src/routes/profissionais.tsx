import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Briefcase, Building, CheckCircle } from "lucide-react";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { BlurReveal } from "@/components/landing/BlurReveal";

export const Route = createFileRoute("/profissionais")({
  head: () => ({
    meta: [
      { title: "Para Profissionais — Ato Regulariza" },
      {
        name: "description",
        content:
          "Plataforma para arquitetos, engenheiros, advogados e despachantes. Organize processos, acesse instruções por cidade e atenda seus clientes com mais eficiência.",
      },
    ],
  }),
  component: ProfissionaisPage,
});

const EASE = [0.22, 1, 0.36, 1] as const;

const vantagens = [
  "Kanban de processos ativos por cliente",
  "Instruções por prefeitura e cartório",
  "Assistente operacional com IA embarcada",
  "Notificações automáticas de prazo",
  "Central de documentos organizada",
  "Dashboard de SLA e métricas pessoais",
];

function ProfissionaisPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main className="w-full overflow-x-hidden">

        {/* ── Hero da página ── */}
        <section
          className="relative flex min-h-[70dvh] flex-col items-center justify-center px-6 pb-20 pt-32 text-center"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              backgroundImage:
                "radial-gradient(55% 40% at 50% 20%, oklch(0.66 0.18 38 / 0.07), transparent 70%)",
            }}
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: EASE }}
            className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-ink-soft"
          >
            <Briefcase className="h-3 w-3" />
            Para profissionais parceiros
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.07, ease: EASE }}
            className="max-w-3xl font-serif text-[clamp(2.5rem,6vw,5rem)] leading-[0.98] tracking-tight text-balance"
          >
            Regularize imóveis com{" "}
            <em className="italic text-ink-soft">clareza e escala.</em>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.14, ease: EASE }}
            className="mt-7 max-w-lg text-balance text-base leading-relaxed text-ink-soft sm:text-lg"
          >
            Arquitetos, engenheiros, advogados e despachantes têm tudo
            o que precisam para atender clientes com mais organização,
            menos retrabalho e sem burocracia paralela.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.22, ease: EASE }}
            className="mt-9 flex flex-wrap items-center justify-center gap-3"
          >
            <Link
              to="/entrar"
              data-cursor="expand"
              className="group inline-flex items-center gap-2 rounded-full bg-foreground py-3 pl-6 pr-2 text-base text-background shadow-[0_10px_30px_-10px_oklch(0.16_0.01_60_/_0.4)] transition-all hover:scale-[1.02]"
            >
              Quero ser parceiro
              <span className="grid h-9 w-9 place-items-center rounded-full bg-accent transition-transform group-hover:rotate-12">
                <ArrowUpRight className="h-5 w-5" />
              </span>
            </Link>
            <Link
              to="/precos"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-6 py-3 text-base text-foreground transition-all hover:border-foreground/30"
            >
              Ver preços parceiro
            </Link>
          </motion.div>
        </section>

        {/* ── Vantagens grid ── */}
        <section className="px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <BlurReveal className="mb-14 text-center">
              <h2 className="font-serif text-[clamp(1.75rem,4vw,3.5rem)] leading-[1.05] tracking-tight">
                O que você ganha.
              </h2>
              <p className="mt-4 text-ink-soft">
                Ferramentas feitas para quem trabalha com regularização todo dia.
              </p>
            </BlurReveal>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {vantagens.map((v, i) => (
                <motion.div
                  key={v}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: i * 0.06, ease: EASE }}
                  className="flex items-start gap-3 rounded-2xl border border-border bg-surface-elevated p-5"
                >
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <span className="text-sm leading-relaxed">{v}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Área do Profissional ── */}
        <section className="px-6 py-24 bg-surface/40">
          <div className="mx-auto max-w-6xl">
            <BlurReveal className="grid items-center gap-10 md:grid-cols-2">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs text-accent">
                  <Briefcase className="h-3 w-3" /> Área do Profissional
                </div>
                <h3 className="font-serif text-4xl leading-tight tracking-tight">
                  Operação premium, com inteligência embarcada.
                </h3>
                <p className="mt-4 max-w-md text-base leading-relaxed text-ink-soft">
                  Arquitetos, engenheiros, advogados e despachantes acessam
                  um kanban claro, instruções por cidade e suporte direto.
                </p>
                <ul className="mt-6 space-y-2">
                  {[
                    "Kanban de processos ativos",
                    "Instruções por prefeitura e cartório",
                    "Assistente operacional com IA",
                  ].map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-sm">
                      <span className="mt-1.5 h-1 w-4 rounded-full bg-accent" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-[28px] border border-border bg-surface/60 p-5 shadow-[0_30px_80px_-40px_oklch(0.16_0.01_60_/_0.4)]">
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  {[
                    { t: "A fazer",    n: 4, items: ["Coletar matrícula", "Conferir ITBI"] },
                    { t: "Em curso",   n: 2, items: ["Protocolo prefeitura", "Análise cartório"], hi: true },
                    { t: "Concluídos", n: 6, items: ["Habite-se", "ART/RRT"] },
                  ].map((col, i) => (
                    <div key={i} className="rounded-2xl bg-surface-elevated p-3 ring-1 ring-border">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-medium">{col.t}</span>
                        <span className="text-ink-soft">{col.n}</span>
                      </div>
                      <div className="space-y-1.5">
                        {col.items.map((it, j) => (
                          <div
                            key={j}
                            className={`rounded-lg px-2 py-1.5 ${col.hi && j === 0 ? "bg-accent text-accent-foreground" : "bg-surface"}`}
                          >
                            {it}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </BlurReveal>
          </div>
        </section>

        {/* ── Central da Empresa ── */}
        <section className="px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <BlurReveal className="grid items-center gap-10 md:grid-cols-2 md:[&>*:first-child]:order-2">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs text-accent">
                  <Building className="h-3 w-3" /> Central da Empresa
                </div>
                <h3 className="font-serif text-4xl leading-tight tracking-tight">
                  Uma torre de controle para toda a operação.
                </h3>
                <p className="mt-4 max-w-md text-base leading-relaxed text-ink-soft">
                  Monitore todos os processos, profissionais e SLAs em tempo real.
                  Detecte gargalos antes que virem problema.
                </p>
                <ul className="mt-6 space-y-2">
                  {[
                    "Métricas e SLAs em tempo real",
                    "Validação central de documentos",
                    "Automação de etapas e alertas",
                  ].map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-sm">
                      <span className="mt-1.5 h-1 w-4 rounded-full bg-accent" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-[28px] border border-border bg-surface/60 p-5 shadow-[0_30px_80px_-40px_oklch(0.16_0.01_60_/_0.4)]">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { l: "Processos ativos", v: "1.284" },
                    { l: "SLA no prazo",     v: "97,2%" },
                    { l: "Profissionais",    v: "342"   },
                    { l: "Cidades atendidas",v: "118"   },
                  ].map((m, i) => (
                    <div key={i} className="rounded-2xl bg-surface-elevated p-4 ring-1 ring-border">
                      <div className="text-xs text-ink-soft">{m.l}</div>
                      <div className="mt-1 font-serif text-2xl">{m.v}</div>
                    </div>
                  ))}
                  <div className="col-span-2 rounded-2xl bg-foreground p-4 text-background">
                    <div className="text-xs text-background/60">Alerta inteligente</div>
                    <div className="mt-1 text-sm">3 processos em risco de SLA na regional Campinas</div>
                  </div>
                </div>
              </div>
            </BlurReveal>
          </div>
        </section>

        {/* ── CTA final ── */}
        <section className="px-6 py-28">
          <div className="mx-auto max-w-2xl text-center">
            <BlurReveal>
              <h2 className="font-serif text-[clamp(2rem,5vw,4rem)] leading-[1.05] tracking-tight text-balance">
                Pronto para atender melhor?
              </h2>
              <p className="mt-5 text-base leading-relaxed text-ink-soft">
                Junte-se a arquitetos, engenheiros e advogados que já simplificaram
                sua operação com a Ato Regulariza.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <Link
                  to="/entrar"
                  className="group inline-flex items-center gap-2 rounded-full bg-foreground py-3 pl-6 pr-2 text-base text-background shadow-[0_10px_30px_-10px_oklch(0.16_0.01_60_/_0.4)] transition-all hover:scale-[1.02]"
                >
                  Quero ser parceiro
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-accent transition-transform group-hover:rotate-12">
                    <ArrowUpRight className="h-5 w-5" />
                  </span>
                </Link>
              </div>
            </BlurReveal>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
