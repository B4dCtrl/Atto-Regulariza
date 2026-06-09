import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import { WHATSAPP } from "@/lib/brand";
import { WordScrambleText } from "@/components/ui/word-scramble-text";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { GLSLHills } from "@/components/landing/GLSLHills";

const EASE = [0.22, 1, 0.36, 1] as const;

const fade = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.75, delay: i * 0.09, ease: EASE },
  }),
};

export function Hero() {
  return (
    /*
     * Card da hero — cor ligeiramente mais forte que o creme do site,
     * cantos arredondados apenas embaixo, como o Tailark.
     * O vídeo e as linhas topográficas ficam numa camada z-0 (não -z-10),
     * evitando o bug de ficar coberto pelo background-color.
     */
    <section
      className="relative mx-3 sm:mx-4 overflow-hidden rounded-b-[2.5rem] sm:rounded-b-[3.5rem]"
      style={{
        minHeight: "max(92dvh, 640px)",
        backgroundColor: "oklch(0.91 0.03 68)",
      }}
      aria-label="Apresentação principal"
    >
      {/* ── Camada de fundo: vídeo + overlay + GLSLHills ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        <video
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover opacity-[0.28]"
          src="https://videos.pexels.com/video-files/35968183/15249566_1920_1080_30fps.mp4"
        />
        {/* Overlay suave */}
        <div className="absolute inset-0 bg-black/20" />
        {/* Linhas topográficas animadas */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            maskImage:
              "radial-gradient(ellipse 90% 70% at 50% 50%, black 30%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 90% 70% at 50% 50%, black 30%, transparent 100%)",
          }}
        >
          <GLSLHills
            width="100%"
            height="100%"
            cameraZ={140}
            planeSize={256}
            speed={0.18}
          />
        </div>
      </div>

      {/* Brilho radial quente no topo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          backgroundImage:
            "radial-gradient(60% 50% at 50% 18%, oklch(0.66 0.18 38 / 0.10), transparent 70%)",
        }}
      />

      {/* ── Conteúdo ── */}
      <div className="relative z-10 mx-auto flex min-h-[max(92dvh,640px)] max-w-3xl flex-col items-center justify-center px-6 pb-20 pt-28 text-center">
        {/* Badge */}
        <motion.div
          custom={0}
          initial="hidden"
          animate="show"
          variants={fade}
          className="mb-7 inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1 text-xs text-foreground/60"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          Disponível em 118 cidades brasileiras
        </motion.div>

        {/* Headline com WordScramble */}
        <h1 className="font-serif text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.98] tracking-tight text-balance text-foreground">
          Regularize seu imóvel em semanas,{" "}
          <em className="italic text-foreground/55">
            não em{" "}
            <WordScrambleText words={["meses", "anos"]} startDelay={700} hold={5000} />
            .
          </em>
        </h1>

        {/* Subheading */}
        <motion.p
          custom={2}
          initial="hidden"
          animate="show"
          variants={fade}
          className="mt-7 max-w-xl text-balance text-base leading-relaxed text-foreground/60 sm:text-lg"
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
              className="inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-foreground/5 px-6 py-3 text-base text-foreground transition-all hover:border-foreground/30 hover:bg-foreground/10"
            >
              <MessageCircle className="h-4 w-4" />
              Ver planos
            </Link>
          </MagneticButton>
        </motion.div>

        {/* Social Proof */}
        <motion.div
          custom={4}
          initial="hidden"
          animate="show"
          variants={fade}
          className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-3"
        >
          {[
            { label: "Sem burocracia" },
            { label: "3,2× mais rápido" },
            { label: "4,9/5 satisfação" },
          ].map((item) => (
            <div key={item.label} className="text-sm text-foreground/50">
              ✓ {item.label}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
