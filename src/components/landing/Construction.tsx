import { motion } from "framer-motion";
import { MessageCircle, ArrowRight } from "lucide-react";
import { WHATSAPP } from "@/lib/brand";
import { DEV_STORAGE_KEY } from "@/lib/site-config";

const EASE = [0.22, 1, 0.36, 1] as const;

export function Construction() {
  // Equipe entra direto, sem senha
  function entrarEquipe() {
    try {
      localStorage.setItem(DEV_STORAGE_KEY, "1");
    } catch {
      /* noop */
    }
    window.location.href = "/";
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 text-center">
      {/* Glow radial quente */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(55% 45% at 50% 30%, oklch(0.66 0.18 38 / 0.10), transparent 70%)",
        }}
      />
      {/* Textura grain sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage: "radial-gradient(oklch(0.16 0.01 60 / 0.04) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="relative flex flex-col items-center"
      >
        {/* Logo */}
        <img src="/logo-ato.png" alt="Ato Regulariza" className="h-12 w-12 rounded-xl object-contain" />

        {/* Badge */}
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-ink-soft">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          Em construção
        </div>

        {/* Headline */}
        <h1 className="mt-6 font-serif text-[clamp(2.5rem,6.5vw,4.75rem)] leading-[1.0] tracking-tight text-balance">
          Estamos construindo
          <br />
          <em className="italic text-ink-soft">algo especial.</em>
        </h1>

        {/* Texto */}
        <p className="mt-5 max-w-md text-balance leading-relaxed text-ink-soft">
          Nossa plataforma de regularização imobiliária está quase pronta.
          Em breve, regularizar seu imóvel vai ser simples, claro e acompanhável
          em tempo real.
        </p>

        {/* WhatsApp — captura leads mesmo durante a construção */}
        <a
          href={WHATSAPP.avaliacaoGratuita}
          target="_blank"
          rel="noreferrer"
          className="group mt-9 inline-flex items-center gap-2 rounded-full bg-foreground py-3 pl-6 pr-2 text-base text-background shadow-[0_10px_30px_-10px_oklch(0.16_0.01_60_/_0.4)] transition-all hover:scale-[1.02]"
        >
          <MessageCircle className="h-4 w-4" />
          Adiante seu caso no WhatsApp
          <span className="grid h-8 w-8 place-items-center rounded-full bg-accent transition-transform group-hover:rotate-12">
            <MessageCircle className="h-4 w-4" />
          </span>
        </a>

        <div className="mt-12 text-xs text-ink-soft/60">Ato Regulariza · 2026</div>

        {/* Acesso da equipe — entra direto, sem senha */}
        <div className="mt-6">
          <button
            type="button"
            onClick={entrarEquipe}
            className="inline-flex items-center gap-1.5 text-xs text-ink-soft/50 transition-colors hover:text-accent"
          >
            Entrar como equipe
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
