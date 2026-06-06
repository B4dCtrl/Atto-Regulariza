import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const before = "Do caos dos cartórios";
const after = "a um fluxo que você acompanha em tempo real.";

export function BlurHeadline() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 80%", "end 60%"],
  });
  const blur = useTransform(scrollYProgress, [0, 1], [12, 0]);
  const opacity = useTransform(scrollYProgress, [0, 1], [0.25, 1]);
  const filter = useTransform(blur, (b) => `blur(${b}px)`);

  return (
    <section ref={ref} className="px-6 py-32 sm:py-44">
      <div className="mx-auto max-w-5xl text-center">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-ink-soft">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Construído para clareza
        </div>
        <h2 className="font-serif text-[clamp(2rem,5.5vw,4.75rem)] leading-[1.05] tracking-tight text-balance">
          {before}{" "}
          <motion.span style={{ filter, opacity }} className="inline-block text-ink-soft">
            {after}
          </motion.span>
        </h2>
      </div>
    </section>
  );
}
