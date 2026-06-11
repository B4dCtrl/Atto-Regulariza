import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import { WHATSAPP } from "@/lib/brand";
import { WordScrambleText } from "@/components/ui/word-scramble-text";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { ParticleSphere } from "@/components/landing/ParticleSphere";

const EASE = [0.22, 1, 0.36, 1] as const;

const fade = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.75, delay: i * 0.1, ease: EASE },
  }),
};

export function Hero() {
  return (
    /*
     * Card escuro com cantos inferiores arredondados — estilo Tailark.
     * Fundo: marrom-escuro quente da paleta do site.
     * Margem lateral para flutuar sobre o creme da página.
     * Conteúdo alinhado à esquerda embaixo, como no Tailark.
     */
    <section
      className="relative mx-3 sm:mx-5 overflow-hidden rounded-t-[1rem] rounded-b-[2.5rem] sm:rounded-t-[1.5rem] sm:rounded-b-[3.5rem]"
      style={{
        minHeight: "max(94dvh, 680px)",
        /* Areia quente — cor das partículas virou o fundo */
        backgroundColor: "oklch(0.76 0.04 68)",
      }}
      aria-label="Apresentação principal"
    >

      {/* ── Esfera de partículas (fundo principal) ── */}
      <div className="absolute inset-0 z-0">
        <ParticleSphere />
      </div>

      {/* Gradiente esquerda → transparente: garante leitura do texto */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "linear-gradient(100deg, oklch(0.76 0.04 68 / 0.96) 0%, oklch(0.76 0.04 68 / 0.72) 38%, oklch(0.76 0.04 68 / 0.10) 65%, transparent 100%)",
        }}
      />
      {/* Gradiente baixo → cima: ancora o texto ao fundo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1]"
        style={{
          height: "65%",
          background:
            "linear-gradient(to top, oklch(0.76 0.04 68 / 0.85) 0%, transparent 100%)",
        }}
      />
      {/* Glow escuro sutil no centro */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          backgroundImage:
            "radial-gradient(50% 40% at 30% 55%, oklch(0.13 0.03 55 / 0.05), transparent 70%)",
        }}
      />

      {/* ── Conteúdo — bottom-left, como Tailark ── */}
      <div className="relative z-10 flex min-h-[max(94dvh,680px)] max-w-2xl flex-col justify-end px-8 pb-16 pt-36 sm:px-14 sm:pb-20">

        {/* Headline */}
        <motion.h1
          custom={0}
          initial="hidden"
          animate="show"
          variants={fade}
          className="font-serif text-[clamp(1.6rem,3.8vw,3.6rem)] leading-[1.06] tracking-tight text-foreground"
        >
          <span className="whitespace-nowrap">Regularize seu imóvel</span>{" "}em semanas,{" "}
          <em className="italic text-foreground/50">
            não em{" "}
            <WordScrambleText
              words={["meses", "anos"]}
              startDelay={600}
              scrambleTime={180}
              hold={2800}
              loop
            />
            .
          </em>
        </motion.h1>

        {/* Subtítulo */}
        <motion.p
          custom={1}
          initial="hidden"
          animate="show"
          variants={fade}
          className="mt-5 max-w-lg text-base leading-relaxed text-foreground/80 sm:text-lg"
        >
          Imóvel irregular trava venda, herança e financiamento. A gente
          cuida de tudo — docs, cartório e prefeitura — enquanto você
          acompanha cada etapa em tempo real.
        </motion.p>

        {/* CTAs */}
        <motion.div
          custom={2}
          initial="hidden"
          animate="show"
          variants={fade}
          className="mt-8 flex flex-wrap items-center gap-3"
        >
          <MagneticButton strength={0.12}>
            <a
              href={WHATSAPP.avaliacaoGratuita}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-2 rounded-full bg-foreground py-3 pl-6 pr-2 text-sm font-medium text-background shadow-[0_12px_32px_-10px_oklch(0.13_0.03_55_/_0.4)] transition-all hover:scale-[1.02]"
            >
              Quero regularizar meu imóvel
              <span className="grid h-8 w-8 place-items-center rounded-full bg-accent transition-transform group-hover:rotate-12">
                <ArrowUpRight className="h-4 w-4 text-background" />
              </span>
            </a>
          </MagneticButton>

          <MagneticButton strength={0.2}>
            <Link
              to="/precos"
              className="inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-foreground/5 px-6 py-3 text-sm font-medium text-foreground/80 transition-all hover:border-foreground/30 hover:bg-foreground/10"
            >
              <MessageCircle className="h-4 w-4" />
              Ver planos
            </Link>
          </MagneticButton>
        </motion.div>

        {/* Social proof */}
        <motion.div
          custom={3}
          initial="hidden"
          animate="show"
          variants={fade}
          className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2"
        >
          {["Menos burocracia", "3x mais rápido", "Satisfação garantida"].map(
            (item) => (
              <div key={item} className="text-xs text-foreground/60">
                ✓ {item}
              </div>
            )
          )}
        </motion.div>
      </div>
    </section>
  );
}
