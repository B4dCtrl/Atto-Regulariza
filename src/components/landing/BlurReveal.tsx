import { motion, useInView } from "framer-motion";
import { useRef, type ReactNode } from "react";

/**
 * Wraps children with a one-time blur→clear + fade-in when scrolled into view.
 * once:true — o efeito abre apenas uma vez e não volta ao scrollar para cima.
 */
export function BlurReveal({
  children,
  className = "",
  amount = 6,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  amount?: number;
  /** @deprecated mantido por compatibilidade, ignorado */
  offset?: [string, string];
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ filter: `blur(${amount}px)`, opacity: 0, y: 20 }}
      animate={inView ? { filter: "blur(0px)", opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
