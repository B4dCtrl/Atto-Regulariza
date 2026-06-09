import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { useRef } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

export function BlurHeadline() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 85%", "center 35%"],
  });

  /* Segunda parte revela com blur + opacity + y — ligado ao scroll */
  const blur    = useTransform(scrollYProgress, [0, 0.85], [10, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.85], [0,  1]);
  const y       = useTransform(scrollYProgress, [0, 0.85], [20, 0]);
  const filter  = useTransform(blur, (b) => `blur(${b}px)`);

  return (
    <section ref={ref} className="px-6 py-32 sm:py-44">
      <div className="mx-auto max-w-5xl text-center">

        {/* Badge — entra quando a seção fica visível */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, ease: EASE }}
          className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-ink-soft"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Construído para clareza
        </motion.div>

        <h2 className="font-serif text-[clamp(2rem,5.5vw,4.75rem)] leading-[1.05] tracking-tight text-balance">
          {/* Primeira metade — aparece logo */}
          <motion.span
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
            className="inline"
          >
            Do caos dos cartórios
          </motion.span>
          {" "}
          {/* Segunda metade — desfoca ao rolar para dentro */}
          <motion.span
            style={{ filter, opacity, y }}
            className="inline-block text-ink-soft"
          >
            a um fluxo que você acompanha em tempo real.
          </motion.span>
        </h2>

      </div>
    </section>
  );
}
