import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Home, HardHat, Building2, ArrowUpRight } from "lucide-react";

const items = [
  {
    icon: Home,
    t: "Proprietários",
    d: "Que querem regularizar com clareza e sem virar especialista no assunto.",
    href: "/precos" as const,
    cta: "Ver preços PF",
  },
  {
    icon: HardHat,
    t: "Profissionais parceiros",
    d: "Arquitetos, engenheiros, despachantes e advogados que ganham organização e fluxo.",
    href: "/entrar" as const,
    cta: "Área do parceiro",
  },
  {
    icon: Building2,
    t: "Imobiliárias e construtoras",
    d: "Operação em escala com SLAs, métricas e padronização entre cidades.",
    href: "/institucional" as const,
    cta: "Solução institucional",
  },
];

export function Audiences() {
  return (
    <section id="para-quem" className="px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-ink-soft">
            Para quem é
          </div>
          <h2 className="font-serif text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.05] tracking-tight">
            Feito para cada lado do processo.
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {items.map((it, i) => (
            <motion.div
              key={it.t}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="group rounded-3xl bg-surface-elevated p-7 ring-1 ring-border transition-all hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_oklch(0.16_0.01_60_/_0.25)]"
            >
              <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-foreground text-background transition-colors group-hover:bg-accent">
                <it.icon className="h-5 w-5" />
              </div>
              <h3 className="font-serif text-2xl leading-tight">{it.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{it.d}</p>
              <Link
                to={it.href}
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-foreground opacity-0 transition-all group-hover:opacity-100"
              >
                {it.cta}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
