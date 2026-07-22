import { motion, useInView, useAnimation } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { Check } from "lucide-react";

const steps = [
  { n: "01", t: "Escolha seu plano",       d: "Em 2 minutos no /precos." },
  { n: "02", t: "Especialista designado",  d: "Em até 24h, alguém assume seu caso." },
  { n: "03", t: "Documentos orientados",   d: "Você só envia o que pedirmos." },
  { n: "04", t: "Tramitação acompanhada",  d: "Veja cada etapa em tempo real." },
  { n: "05", t: "Matrícula nas suas mãos", d: "Regularização concluída." },
];

const TRAVEL = 0.35;  // s para mover ao próximo passo
const PAUSE  = 600;   // ms de pausa em cima do círculo
const REST   = 1500;  // ms no final antes de reiniciar

const ACTIVE: React.CSSProperties = {
  backgroundColor: "oklch(0.66 0.18 38)",
  borderColor:     "oklch(0.66 0.18 38)",
  color:           "oklch(0.985 0.005 80)",
  boxShadow:       "0 0 0 6px oklch(0.66 0.18 38 / 0.15)",
};
const IDLE: React.CSSProperties = {
  backgroundColor: "oklch(1 0 0)",
  borderColor:     "oklch(0.9 0.008 75)",
  color:           "oklch(0.45 0.01 60)",
  boxShadow:       "0 0 0 0px oklch(0.66 0.18 38 / 0)",
};

export function HowItWorks() {
  const sectionRef   = useRef<HTMLElement>(null);
  const relRef       = useRef<HTMLDivElement>(null);   // container com position:relative
  const circleRefs   = useRef<(HTMLDivElement | null)[]>([null, null, null, null, null]);

  const inView = useInView(sectionRef, { once: true, margin: "-100px" });

  /* Controles individuais — sem hook em loop */
  const beamCtrl = useAnimation();
  const partCtrl = useAnimation();
  const c0 = useAnimation(); const c1 = useAnimation();
  const c2 = useAnimation(); const c3 = useAnimation(); const c4 = useAnimation();
  const cc = [c0, c1, c2, c3, c4];

  const [done, setDone] = useState<Set<number>>(new Set());

  /* Mede o centro X de um círculo em relação ao relRef */
  function centerX(i: number): number {
    const el  = circleRefs.current[i];
    const box = relRef.current;
    if (!el || !box) return 0;
    const er = el.getBoundingClientRect();
    const br = box.getBoundingClientRect();
    return er.left + er.width / 2 - br.left;
  }

  useEffect(() => {
    if (!inView) return;
    let dead = false;
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    async function loop() {
      while (!dead) {
        /* ── reset ── */
        setDone(new Set());
        cc.forEach((c) => c.set(IDLE));

        const x0 = centerX(0);
        /* partícula começa exatamente em cima do círculo 0 (centralizada) */
        partCtrl.set({ x: x0 });
        /* beam começa como ponto no centro do círculo 0 */
        beamCtrl.set({ x: x0, width: 0 });

        /* ── passo a passo ── */
        for (let i = 0; i < steps.length; i++) {
          if (dead) return;

          if (i > 0) {
            const xi  = centerX(i);
            const bw  = xi - centerX(0); // largura do beam = distância do início

            await Promise.all([
              partCtrl.start({
                x: xi,
                transition: { duration: TRAVEL, ease: [0.4, 0, 0.2, 1] },
              }),
              beamCtrl.start({
                width: bw,
                transition: { duration: TRAVEL, ease: [0.4, 0, 0.2, 1] },
              }),
            ]);
          }

          if (dead) return;

          /* Acende círculo + ✓ */
          setDone((prev) => new Set([...prev, i]));
          cc[i].start({ ...ACTIVE, transition: { duration: 0.28 } });

          /* Pausa em cima do círculo */
          await wait(PAUSE);
        }

        if (dead) return;
        await wait(REST);
      }
    }

    loop();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);

  return (
    <section
      ref={sectionRef}
      id="como-funciona"
      className="border-t border-border bg-surface/40 px-6 py-28"
    >
      <div className="mx-auto max-w-6xl">
        {/* Título */}
        <motion.div
          className="mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="font-serif text-[clamp(1.6rem,3.8vw,3.5rem)] leading-[1.1] tracking-tight text-balance">
            Cinco passos. Você no controle.
          </h2>
        </motion.div>

        {/* Grid de passos */}
        <div className="relative" ref={relRef}>
          {/* Trilha estática */}
          <div className="pointer-events-none absolute left-0 right-0 top-6 hidden h-px bg-border md:block" />

          {/* Beam animado — parte do centro do círculo 0, cresce para a direita */}
          <motion.div
            className="pointer-events-none absolute top-6 hidden h-px bg-accent/70 origin-left md:block"
            animate={beamCtrl}
            initial={{ x: 0, width: 0 }}
          />

          {/* Partícula — translateX centraliza nos círculos */}
          <motion.div
            className="pointer-events-none absolute hidden h-3 w-3 -translate-x-1/2 rounded-full bg-accent shadow-[0_0_12px_3px_oklch(0.66_0.18_38_/_0.6)] md:block"
            style={{ top: "18px" }} /* 24px (top-6) - 6px (metade de h-3=12px) */
            animate={partCtrl}
            initial={{ x: 0 }}
          />

          <div className="grid gap-8 md:grid-cols-5">
            {steps.map((s, i) => (
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
                  ref={(el) => { circleRefs.current[i] = el; }}
                  className="relative z-10 mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full font-serif text-lg"
                  animate={cc[i]}
                  initial={IDLE}
                  style={{ border: "1px solid" }}
                >
                  {done.has(i) ? <Check className="h-5 w-5" /> : s.n}
                </motion.div>

                <h3 className="text-base font-medium">{s.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{s.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
