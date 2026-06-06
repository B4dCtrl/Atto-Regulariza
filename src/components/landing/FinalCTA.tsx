import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import { WHATSAPP } from "@/lib/brand";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { SplitWords } from "@/components/ui/split-words";

export function FinalCTA() {
  return (
    <section id="cta" className="px-6 pb-28">
      <motion.div
        initial={{ opacity: 0, y: 36 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto max-w-6xl overflow-hidden rounded-[36px] bg-foreground px-8 py-20 text-center text-background sm:px-16 sm:py-28"
      >
        {/* Radial glow topo */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-35"
          style={{
            backgroundImage:
              "radial-gradient(40% 60% at 50% 0%, oklch(0.66 0.18 38 / 0.55), transparent 70%)",
          }}
        />

        {/* Grain texture sutil */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(oklch(0.985 0.005 80 / 0.06) 1px, transparent 1px)",
            backgroundSize: "3px 3px",
          }}
        />

        <div className="relative">
          <h2 className="font-serif text-[clamp(2.25rem,5.5vw,5rem)] leading-[0.98] tracking-tight text-balance">
            <SplitWords trigger="inView" delay={0.1} stagger={0.08}>
              Sua regularização,
            </SplitWords>
            <br />
            <em className="italic text-background/55">
              <SplitWords trigger="inView" delay={0.5} stagger={0.08}>
                finalmente clara.
              </SplitWords>
            </em>
          </h2>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mt-6 max-w-xl text-base text-background/70"
          >
            Escolha seu plano e em 24 horas um especialista assume seu caso.
            Sem cartórios, sem ansiedade, sem juridiquês.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 flex flex-wrap justify-center gap-3"
          >
            <MagneticButton strength={0.3}>
              <Link
                to="/precos"
                data-cursor="expand"
                className="group inline-flex items-center gap-2 rounded-full bg-background py-3 pl-6 pr-2 text-base text-foreground transition-all hover:scale-[1.02]"
              >
                Ver planos
                <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-foreground transition-transform group-hover:rotate-12">
                  <ArrowUpRight className="h-5 w-5" />
                </span>
              </Link>
            </MagneticButton>

            <MagneticButton strength={0.2}>
              <a
                href={WHATSAPP.avaliacaoGratuita}
                target="_blank"
                rel="noreferrer"
                data-cursor="expand"
                className="inline-flex items-center gap-2 rounded-full border border-background/30 px-6 py-3 text-base text-background transition-all hover:border-background/70"
              >
                <MessageCircle className="h-4 w-4" />
                Avaliação gratuita no WhatsApp
              </a>
            </MagneticButton>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
