import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Check } from "lucide-react";

const steps = [
  { n: "01", t: "Escolha seu plano",       d: "Em 2 minutos no /precos." },
  { n: "02", t: "Especialista designado",  d: "Em até 24h, alguém assume seu caso." },
  { n: "03", t: "Documentos orientados",   d: "Você só envia o que pedirmos." },
  { n: "04", t: "Tramitação acompanhada",  d: "Veja cada etapa em tempo real." },
  { n: "05", t: "Matrícula nas suas mãos", d: "Regularização concluída." },
];

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-100px" });

  return (
    <section
      ref={sectionRef}
      id="como-funciona"
      className="border-t border-border bg-surface/40 px-6 py-28"
    >
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <motion.div
          className="mb-14 max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="font-serif text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.05] tracking-tight">
            Cinco passos. Você no controle.
          </h2>
        </motion.div>

        {/* Steps */}
        <div className="relative">
          {/* Linha de fundo (estática, cinza) */}
          <div className="pointer-events-none absolute left-0 right-0 top-6 hidden h-px bg-border md:block" />

          {/* Linha animada (beam) — percorre da esquerda para a direita */}
          <div className="pointer-events-none absolute left-0 right-0 top-6 hidden overflow-hidden md:block">
            <motion.div
              className="h-px origin-left bg-accent/60"
              initial={{ scaleX: 0 }}
              animate={inView ? { scaleX: 1 } : { scaleX: 0 }}
              transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            />
          </div>

          {/* Partícula viajando na linha */}
          {inView && (
            <motion.div
              className="pointer-events-none absolute top-[21px] hidden h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_10px_2px_oklch(0.66_0.18_38_/_0.6)] md:block"
              initial={{ left: "0%" }}
              animate={{ left: "100%" }}
              transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            />
          )}

          <div className="grid gap-8 md:grid-cols-5">
            {steps.map((s, i) => {
              const isLast = i === steps.length - 1;
              const stepDelay = 0.25 + i * 0.18;

              return (
                <motion.div
                  key={s.n}
                  className="relative"
                  initial={{ opacity: 0, y: 16 }}
                  animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
                  transition={{ duration: 0.55, delay: stepDelay, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* Círculo numerado */}
                  <motion.div
                    className="relative z-10 mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full font-serif text-lg"
                    initial={{
                      backgroundColor: "oklch(1 0 0)",
                      borderColor: "oklch(0.9 0.008 75)",
                      color: "oklch(0.45 0.01 60)",
                      boxShadow: "0 0 0 0px oklch(0.66 0.18 38 / 0)",
                    }}
                    animate={
                      inView
                        ? {
                            backgroundColor: isLast
                              ? "oklch(0.66 0.18 38)"
                              : "oklch(1 0 0)",
                            borderColor: "oklch(0.66 0.18 38)",
                            color: isLast
                              ? "oklch(0.985 0.005 80)"
                              : "oklch(0.66 0.18 38)",
                            boxShadow: isLast
                              ? "0 0 0 6px oklch(0.66 0.18 38 / 0.15)"
                              : "0 0 0 0px oklch(0.66 0.18 38 / 0)",
                          }
                        : {}
                    }
                    transition={{ duration: 0.5, delay: stepDelay + 0.25 }}
                    style={{ border: "1px solid" }}
                  >
                    {isLast ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      s.n
                    )}
                  </motion.div>

                  <h3 className="text-base font-medium">{s.t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{s.d}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
