import { motion, type Variants } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, MessageCircle, ShieldCheck, Clock, Star } from "lucide-react";
import { WHATSAPP } from "@/lib/brand";
import { WordScrambleText } from "@/components/ui/word-scramble-text";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { GLSLHills } from "@/components/landing/GLSLHills";

const proofs = [
  { icon: ShieldCheck, label: "Sem burocracia para você" },
  { icon: Clock,       label: "Até 3,2× mais rápido"    },
  { icon: Star,        label: "4,9/5 com proprietários"  },
];

const EASE = [0.22, 1, 0.36, 1] as const;

const fade: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.75, delay: i * 0.09, ease: EASE },
  }),
};

export function Hero() {
  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ minHeight: "max(92dvh, 640px)" }}
      aria-label="Apresentação principal"
    >
      {/* Topografia WebGL animada — fica abaixo de tudo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-[15] opacity-50"
        style={{
          maskImage: "radial-gradient(ellipse 85% 65% at 50% 55%, black, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 85% 65% at 50% 55%, black, transparent)",
        }}
      >
        <GLSLHills width="100%" height="100%" cameraZ={140} planeSize={256} speed={0.18} />
      </div>

      {/* Brilho radial quente de fundo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(60% 50% at 50% 18%, oklch(0.66 0.18 38 / 0.08), transparent 70%)",
        }}
      />
      {/* Orbs sutis no topo — dão o que refratar para o vidro da nav */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-[5] h-44 overflow-hidden">
        <div
          className="absolute left-[20%] top-[-40px] h-48 w-48 rounded-full"
          style={{ background: "radial-gradient(circle, oklch(0.70 0.17 40 / 0.40), transparent 70%)", filter: "blur(44px)" }}
        />
        <div
          className="absolute right-[24%] top-[-30px] h-44 w-44 rounded-full"
          style={{ background: "radial-gradient(circle, oklch(0.82 0.14 80 / 0.36), transparent 70%)", filter: "blur(44px)" }}
        />
      </div>

      <div className="mx-auto flex min-h-[max(92dvh,640px)] max-w-3xl flex-col items-center justify-center px-6 pb-20 pt-28 text-center">
        {/* Badge */}
        <motion.div
          custom={0}
          initial="hidden"
          animate="show"
          variants={fade}
          className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-ink-soft"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          Disponível em 118 cidades brasileiras
        </motion.div>

        {/* Headline — "anos" cicla dias → meses → anos */}
        <h1 className="font-serif text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.98] tracking-tight text-balance">
          Regularize seu imóvel em semanas,{" "}
          <em className="italic text-ink-soft">
            não em{" "}
            <WordScrambleText words={["dias", "meses", "anos"]} startDelay={700} hold={900} />
            .
          </em>
        </h1>

        {/* Sub */}
        <motion.p
          custom={2}
          initial="hidden"
          animate="show"
          variants={fade}
          className="mt-7 max-w-xl text-balance text-base leading-relaxed text-ink-soft sm:text-lg"
        >
          Imóvel irregular trava venda, herança e financiamento. A gente
          cuida de tudo — docs, cartório e prefeitura — enquanto você
          acompanha cada etapa em tempo real, sem juridiquês.
        </motion.p>

        {/* CTAs */}
        <motion.div
          custom={3}
          initial="hidden"
          animate="show"
          variants={fade}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <MagneticButton strength={0.12}>
            <a
              href={WHATSAPP.avaliacaoGratuita}
              target="_blank"
              rel="noreferrer"
              data-cursor="expand"
              className="group inline-flex items-center gap-2 rounded-full bg-foreground py-3 pl-6 pr-2 text-base text-background shadow-[0_10px_30px_-10px_oklch(0.16_0.01_60_/_0.4)] transition-all hover:scale-[1.02]"
            >
              Quero regularizar meu imóvel
              <span className="grid h-9 w-9 place-items-center rounded-full bg-accent transition-transform group-hover:rotate-12">
                <ArrowUpRight className="h-5 w-5" />
              </span>
            </a>
          </MagneticButton>

          <MagneticButton strength={0.2}>
            <Link
              to="/precos"
              data-cursor="expand"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-6 py-3 text-base text-foreground transition-all hover:border-foreground/30"
            >
              <MessageCircle className="h-4 w-4" />
              Ver planos
            </Link>
          </MagneticButton>
        </motion.div>

        {/* Prova social */}
        <motion.div
          custom={4}
          initial="hidden"
          animate="show"
          variants={fade}
          className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-3"
        >
          {proofs.map((c) => (
            <div key={c.label} className="flex items-center gap-2 text-sm text-ink-soft">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent/15 text-accent">
                <c.icon className="h-3.5 w-3.5" />
              </span>
              {c.label}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
