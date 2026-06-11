import { motion, useInView, useAnimation } from "framer-motion";
import { useRef, useEffect } from "react";
import { Check } from "lucide-react";

const steps = [
  { n: "01", t: "Escolha seu plano",       d: "Em 2 minutos no /precos." },
  { n: "02", t: "Especialista designado",  d: "Em até 24h, alguém assume seu caso." },
  { n: "03", t: "Documentos orientados",   d: "Você só envia o que pedirmos." },
  { n: "04", t: "Tramitação acompanhada",  d: "Veja cada etapa em tempo real." },
  { n: "05", t: "Matrícula nas suas mãos", d: "Regularização concluída." },
];

const LOOP_DURATION = 2.2; // segundos para percorrer a linha
const LOOP_PAUSE    = 1.2; // pausa no fim antes de reiniciar
const STEP_DELAY    = 0.28;

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const inView     = useInView(sectionRef, { once: true, margin: "-100px" });

  const beamCtrl     = useAnimation();
  const particleCtrl = useAnimation();
  const circleCtrl   = steps.map(() => useAnimation()); // eslint-disable-line react-hooks/rules-of-hooks

  /* ── Loop de animação ── */
  useEffect(() => {
    if (!inView) return;

    let cancelled = false;

    async function runLoop() {
      while (!cancelled) {
        /* Reset tudo */
        beamCtrl.set({ scaleX: 0 });
        particleCtrl.set({ left: "0%" });
        circleCtrl.forEach((c, i) => {
          const isLast = i === steps.length - 1;
          c.set({
            backgroundColor: "oklch(1 0 0)",
            borderColor: "oklch(0.9 0.008 75)",
            color: "oklch(0.45 0.01 60)",
            boxShadow: "0 0 0 0px oklch(0.66 0.18 38 / 0)",
            ...(isLast ? {} : {}),
          });
        });

        /* Anima linha + partícula juntos */
        beamCtrl.start({ scaleX: 1, transition: { duration: LOOP_DURATION, ease: [0.22, 1, 0.36, 1] } });
        particleCtrl.start({ left: "100%", transition: { duration: LOOP_DURATION, ease: [0.22, 1, 0.36, 1] } });

        /* Anima cada círculo em sequência */
        for (let i = 0; i < steps.length; i++) {
          const isLast = i === steps.length - 1;
          const delay  = STEP_DELAY * i * 1000;
          await new Promise((r) => setTimeout(r, delay));
          if (cancelled) return;
          circleCtrl[i].start({
            backgroundColor: isLast ? "oklch(0.66 0.18 38)" : "oklch(1 0 0)",
            borderColor: "oklch(0.66 0.18 38)",
            color: isLast ? "oklch(0.985 0.005 80)" : "oklch(0.66 0.18 38)",
            boxShadow: isLast ? "0 0 0 6px oklch(0.66 0.18 38 / 0.15)" : "0 0 0 0px oklch(0.66 0.18 38 / 0)",
            transition: { duration: 0.45 },
          });
        }

        /* Pausa no fim */
        await new Promise((r) => setTimeout(r, (LOOP_DURATION + LOOP_PAUSE) * 1000));
        if (cancelled) return;
      }
    }

    runLoop();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);

  return (
    <section
      ref={sectionRef}
      id="como-funciona"
      className="border-t border-border bg-surface/40 px-6 py-28"
    >
      <div className="mx-auto max-w-6xl">
        {/* Header — título em uma linha */}
        <motion.div
          className="mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="whitespace-nowrap font-serif text-[clamp(1.6rem,3.8vw,3.5rem)] leading-[1.05] tracking-tight">
            Cinco passos. Você no controle.
          </h2>
        </motion.div>

        {/* Steps */}
        <div className="relative">
          {/* Linha de fundo (estática) */}
          <div className="pointer-events-none absolute left-0 right-0 top-6 hidden h-px bg-border md:block" />

          {/* Beam animado em loop */}
          <div className="pointer-events-none absolute left-0 right-0 top-6 hidden overflow-hidden md:block">
            <motion.div
              className="h-px origin-left bg-accent/60"
              animate={beamCtrl}
              initial={{ scaleX: 0 }}
            />
          </div>

          {/* Partícula viajando */}
          <motion.div
            className="pointer-events-none absolute top-[21px] hidden h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_10px_2px_oklch(0.66_0.18_38_/_0.6)] md:block"
            animate={particleCtrl}
            initial={{ left: "0%" }}
          />

          <div className="grid gap-8 md:grid-cols-5">
            {steps.map((s, i) => {
              const isLast = i === steps.length - 1;

              return (
                <motion.div
                  key={s.n}
                  className="relative"
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.55, delay: 0.15 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* Círculo */}
                  <motion.div
                    className="relative z-10 mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full font-serif text-lg"
                    animate={circleCtrl[i]}
                    initial={{
                      backgroundColor: "oklch(1 0 0)",
                      borderColor: "oklch(0.9 0.008 75)",
                      color: "oklch(0.45 0.01 60)",
                      boxShadow: "0 0 0 0px oklch(0.66 0.18 38 / 0)",
                    }}
                    style={{ border: "1px solid" }}
                  >
                    {isLast ? <Check className="h-5 w-5" /> : s.n}
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
