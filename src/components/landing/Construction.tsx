import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Lock } from "lucide-react";
import { WHATSAPP } from "@/lib/brand";
import { DEV_ACCESS_KEY, DEV_STORAGE_KEY } from "@/lib/site-config";

const EASE = [0.22, 1, 0.36, 1] as const;

export function Construction() {
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [erro, setErro] = useState(false);

  function entrarEquipe(e: FormEvent) {
    e.preventDefault();
    if (pwd.trim() === DEV_ACCESS_KEY) {
      try {
        localStorage.setItem(DEV_STORAGE_KEY, "1");
      } catch {
        /* noop */
      }
      window.location.href = "/";
    } else {
      setErro(true);
    }
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
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-foreground text-background">
          <span className="font-serif text-2xl leading-none">R</span>
        </div>

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

        <div className="mt-12 text-xs text-ink-soft/60">Regulariza · 2026</div>

        {/* Acesso da equipe */}
        <div className="mt-6">
          <AnimatePresence mode="wait">
            {!open ? (
              <motion.button
                key="btn"
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs text-ink-soft/50 transition-colors hover:text-ink-soft"
              >
                <Lock className="h-3 w-3" />
                Acesso da equipe
              </motion.button>
            ) : (
              <motion.form
                key="form"
                onSubmit={entrarEquipe}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto flex max-w-xs flex-col items-center gap-2"
              >
                <div className="flex w-full items-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2">
                  <Lock className="h-3.5 w-3.5 text-ink-soft" />
                  <input
                    type="password"
                    autoFocus
                    value={pwd}
                    onChange={(e) => {
                      setPwd(e.target.value);
                      setErro(false);
                    }}
                    placeholder="Senha da equipe"
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-soft/50"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-foreground px-3 py-1 text-xs text-background"
                  >
                    Entrar
                  </button>
                </div>
                {erro && (
                  <span className="text-xs text-red-500">Senha incorreta.</span>
                )}
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
