import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BlurReveal } from "./BlurReveal";
import { User, Briefcase } from "lucide-react";

// Mesma lógica do carrossel da tela de login — troca sozinho a cada 2.6s
const STATUS_STEPS = [
  { label: "Com profissional",   pct: 35,  done: "2 de 6 etapas · ~10 dias" },
  { label: "Em prefeitura",      pct: 70,  done: "4 de 6 etapas · ~5 dias" },
  { label: "Matrícula averbada", pct: 100, done: "6 de 6 etapas · concluído" },
];

/**
 * Environments — Exibe apenas a Área do Cliente.
 * Área do Profissional e Central da Empresa foram movidas para /profissionais.
 */
export function Environments() {
  const [statusStep, setStatusStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setStatusStep((s) => (s + 1) % STATUS_STEPS.length);
    }, 2600);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="px-6 pb-32">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-ink-soft">
            Área do Cliente
          </div>
          <h2 className="font-serif text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.05] tracking-tight text-balance">
            Seu imóvel,
            <br />
            <span className="italic text-ink-soft">acompanhado de perto.</span>
          </h2>
        </div>

        <BlurReveal className="grid items-center gap-10 md:grid-cols-2">
          {/* Texto */}
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs text-accent">
              <User className="h-3 w-3" /> Área do Cliente
            </div>
            <h3 className="font-serif text-4xl leading-tight tracking-tight">
              Tranquilidade em forma de painel.
            </h3>
            <p className="mt-4 max-w-md text-base leading-relaxed text-ink-soft">
              O cliente vê seu imóvel, sua timeline e seus próximos passos —
              sem termos técnicos, sem ansiedade.
            </p>
            <ul className="mt-6 space-y-2">
              {[
                "Timeline visual da regularização",
                "Central de documentos",
                "IA que explica em linguagem humana",
              ].map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-1.5 h-1 w-4 rounded-full bg-accent" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Mockup */}
          <div className="rounded-[28px] border border-border bg-surface/60 p-5 shadow-[0_30px_80px_-40px_oklch(0.16_0.01_60_/_0.4)]">
            <div className="space-y-3">
              <div className="rounded-2xl bg-surface-elevated p-4 ring-1 ring-border">
                <div className="text-xs text-ink-soft">Status atual</div>
                <div className="relative mt-1 h-8 overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={statusStep}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute inset-0 font-serif text-2xl"
                    >
                      {STATUS_STEPS[statusStep].label}
                    </motion.div>
                  </AnimatePresence>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface">
                  <motion.div
                    className="h-full rounded-full bg-accent"
                    animate={{ width: `${STATUS_STEPS[statusStep].pct}%` }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
                <div className="relative mt-2 h-4 overflow-hidden text-xs text-ink-soft">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={statusStep}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35 }}
                      className="absolute inset-0"
                    >
                      {STATUS_STEPS[statusStep].done}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
              <div className="rounded-2xl bg-surface-elevated p-4 ring-1 ring-border">
                <div className="text-xs text-ink-soft">Responsável agora</div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-background">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Especialista designado</div>
                    <div className="text-xs text-ink-soft">Arquitetura e Urbanismo</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </BlurReveal>
      </div>
    </section>
  );
}
