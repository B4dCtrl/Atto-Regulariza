import { useRef } from "react";
import { motion, type Variants } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, MessageCircle, ShieldCheck, Clock, Star } from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { WHATSAPP } from "@/lib/brand";
import { WordScrambleText } from "@/components/ui/word-scramble-text";
import { MagneticButton } from "@/components/ui/magnetic-button";

gsap.registerPlugin(ScrollTrigger);

const proofs = [
  { icon: ShieldCheck, label: "Sem burocracia para você" },
  { icon: Clock,       label: "Até 3,2× mais rápido"    },
  { icon: Star,        label: "4,9/5 com proprietários"  },
];

const EASE = [0.22, 1, 0.36, 1] as const;

const fade: Variants = {
  hidden: { opacity: 0, y: 20 },
  show:   (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.75, delay: i * 0.09, ease: EASE },
  }),
};

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const casaRef    = useRef<HTMLImageElement>(null);
  const shadowRef  = useRef<HTMLDivElement>(null);

  /* ────────────────────────────────────────────────────────────────
   * SCROLL EFFECT: a casa para de flutuar e "pousa" ao rolar.
   * Metáfora: imóvel irregular → regularizado.
   * ──────────────────────────────────────────────────────────────── */
  useGSAP(
    () => {
      const casa   = casaRef.current;
      const shadow = shadowRef.current;
      if (!casa || !shadow) return;

      /* 1. Pausa a animação CSS de float ao entrar no trigger */
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start:   "top top",
        end:     "+=500",
        pin:     true,            // prende a seção enquanto anima
        scrub:   1.2,
        onUpdate(self) {
          const p = self.progress; // 0 → 1

          /* A casa desce suavemente como se pousasse */
          gsap.set(casa, {
            y:              p * 60,                    // desce 60px
            scale:          1 + p * 0.04,             // cresce levemente
            rotation:       p * -1.5,                 // leve inclinação
            filter:         `drop-shadow(0 ${Math.round(24 - p * 20)}px ${Math.round(40 - p * 30)}px oklch(0.40 0.06 60 / ${0.18 - p * 0.10}))`,
            // Para a animação CSS de float conforme progresso
            animationPlayState: p > 0.05 ? "paused" : "running",
          });

          /* Sombra no chão aparece quando pousa */
          gsap.set(shadow, {
            scaleX:  0.6 + p * 0.6,     // expande de 60% → 120%
            opacity: p * 0.55,
            y:       p * 58,
          });
        },
        onLeaveBack() {
          /* Volta ao estado inicial quando scroll volta ao topo */
          gsap.to(casa, {
            y: 0, scale: 1, rotation: 0,
            filter: "drop-shadow(0 24px 40px oklch(0.40 0.06 60 / 0.18))",
            duration: 0.6, ease: "power2.out",
            onComplete: () => {
              if (casa) casa.style.animationPlayState = "running";
            },
          });
          gsap.to(shadow, { scaleX: 1, opacity: 0, y: 0, duration: 0.4 });
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      className="relative w-full bg-background"
      style={{ minHeight: "max(100dvh, 680px)" }}
      aria-label="Apresentação principal"
    >
      {/*
       * ── Orbs coloridos no TOPO ──────────────────────────────────
       * Ficam atrás da nav (fixed) para o LiquidGL ter o que refratar.
       * Tons quentes da marca, com blur — leitura suave + glass vivo.
       */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-[5] h-48 overflow-hidden">
        <div
          className="absolute left-[8%] top-[-30px] h-44 w-44 rounded-full"
          style={{ background: "radial-gradient(circle, oklch(0.70 0.17 40 / 0.55), transparent 70%)", filter: "blur(36px)" }}
        />
        <div
          className="absolute left-[42%] top-[-50px] h-52 w-52 rounded-full"
          style={{ background: "radial-gradient(circle, oklch(0.82 0.14 80 / 0.50), transparent 70%)", filter: "blur(40px)" }}
        />
        <div
          className="absolute right-[14%] top-[-20px] h-40 w-40 rounded-full"
          style={{ background: "radial-gradient(circle, oklch(0.72 0.12 250 / 0.42), transparent 70%)", filter: "blur(38px)" }}
        />
      </div>

      {/* Fundo sutil coluna texto */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 lg:left-1/2"
        style={{
          backgroundImage:
            "radial-gradient(70% 50% at 80% 20%, oklch(0.66 0.18 38 / 0.07), transparent 65%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 hidden opacity-25 lg:block lg:left-1/2"
        style={{
          backgroundImage:
            "linear-gradient(to right, oklch(0.9 0.008 75) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.9 0.008 75) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(60% 60% at 70% 30%, black, transparent)",
        }}
      />

      <div className="grid min-h-[max(100dvh,680px)] w-full grid-cols-1 lg:grid-cols-2">

        {/* ── Coluna esquerda — casa flutuando ─────────────────── */}
        <div className="relative order-1 flex min-h-[52dvh] w-full items-center justify-center overflow-hidden lg:order-1 lg:min-h-[max(100dvh,680px)]">

          {/* Glow radial quente atrás da casa */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: "radial-gradient(ellipse 75% 60% at 50% 58%, oklch(0.94 0.015 75 / 0.80), transparent 72%)",
            }}
          />

          {/* Sombra projetada — aparece quando a casa pousa via scroll */}
          <div
            ref={shadowRef}
            aria-hidden
            className="absolute bottom-[14%] left-1/2 -translate-x-1/2 opacity-0"
            style={{
              width:      "52%",
              height:     "24px",
              background: "radial-gradient(ellipse, oklch(0.40 0.05 60 / 0.35), transparent 70%)",
              filter:     "blur(14px)",
              transformOrigin: "center",
            }}
          />

          {/*
           * PNG com transparência real.
           * CSS animation: floatHouse (5s loop)
           * GSAP via scroll sobrepõe a animação CSS quando rola.
           */}
          <img
            ref={casaRef}
            src="/casa.png"
            alt="Imóvel regularizado — ilha flutuante"
            draggable={false}
            style={{
              width:         "clamp(340px, 82%, 580px)",
              height:        "auto",
              objectFit:     "contain",
              userSelect:    "none",
              imageRendering: "auto",
              animation:     "floatHouse 5s ease-in-out infinite",
              willChange:    "transform, filter",
              filter:        "drop-shadow(0 24px 40px oklch(0.40 0.06 60 / 0.18))",
              transformOrigin: "center bottom",
            }}
          />

          {/* Badge "Imóvel regularizado" aparece ao final do scroll */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.3, ease: EASE }}
            className="absolute bottom-[10%] right-[8%] flex items-center gap-2 rounded-full
                       border border-border bg-background/90 px-3 py-1.5 backdrop-blur-md
                       shadow-sm text-xs text-foreground"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Pronta para vender
          </motion.div>
        </div>

        {/* ── Coluna direita — copy ─────────────────────────────── */}
        <div className="order-2 flex min-h-0 flex-col justify-center px-6 pb-12 pt-28 sm:px-10 sm:pb-16 sm:pt-32 lg:min-h-[max(100dvh,680px)] lg:px-12 lg:py-20 xl:px-16">
          <div className="mx-auto w-full max-w-xl lg:mx-0 lg:max-w-none">

            {/* Badge */}
            <motion.div
              custom={0} initial="hidden" animate="show" variants={fade}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-ink-soft"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              Disponível em 118 cidades brasileiras
            </motion.div>

            {/* Headline — sem SplitWords; "anos" cicla dias → meses → anos */}
            <h1 className="font-serif text-left text-[clamp(2.25rem,5.5vw,4.5rem)] leading-[0.95] tracking-tight xl:text-[clamp(2.75rem,4vw,5rem)]">
              Regularize seu imóvel
              <br />
              em semanas,{" "}
              <em className="italic text-ink-soft">
                não em{" "}
                <WordScrambleText
                  words={["dias", "meses", "anos"]}
                  startDelay={700}
                  hold={900}
                />
                .
              </em>
            </h1>

            {/* Sub */}
            <motion.p
              custom={2} initial="hidden" animate="show" variants={fade}
              className="mt-7 max-w-md text-left text-balance text-base leading-relaxed text-ink-soft sm:text-lg"
            >
              Imóvel irregular trava venda, herança e financiamento. A gente
              cuida de tudo — docs, cartório e prefeitura — enquanto você
              acompanha cada etapa em tempo real, sem juridiquês.
            </motion.p>

            {/* CTAs */}
            <motion.div
              custom={3} initial="hidden" animate="show" variants={fade}
              className="mt-8 flex flex-wrap gap-3"
            >
              <MagneticButton strength={0.32}>
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
              custom={4} initial="hidden" animate="show" variants={fade}
              className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-6"
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
        </div>
      </div>
    </section>
  );
}
