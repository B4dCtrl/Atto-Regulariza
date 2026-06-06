import { motion, useInView, type Variants } from "framer-motion";
import { useRef } from "react";

interface SplitWordsProps {
  children: string;
  className?: string;
  delay?: number;
  stagger?: number;
  /** "animate" inicia logo ao montar; "inView" dispara quando entra no viewport */
  trigger?: "animate" | "inView";
  once?: boolean;
}

const EASE = [0.22, 1, 0.36, 1] as const;

const containerVariants: Variants = {
  hidden: {},
  show: (stagger: number) => ({
    transition: { staggerChildren: stagger },
  }),
};

const wordVariants: Variants = {
  hidden: { opacity: 0, y: 22, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.65, ease: EASE },
  },
};

/** Quebra o texto em palavras, cada uma com fade+blur+translateY estaggerado. */
export function SplitWords({
  children,
  className = "",
  delay = 0,
  stagger = 0.07,
  trigger = "animate",
  once = true,
}: SplitWordsProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once, margin: "-40px" });

  const words = children.split(" ");
  const isVisible = trigger === "animate" ? true : inView;

  return (
    <motion.span
      ref={ref}
      className={`inline-flex flex-wrap items-baseline ${className}`}
      style={{ gap: "0 0.28em" }}
      initial="hidden"
      animate={isVisible ? "show" : "hidden"}
      custom={stagger}
      variants={containerVariants}
      aria-label={children}
    >
      {words.map((word, i) => (
        <motion.span
          key={i}
          variants={wordVariants}
          className="inline-block"
          style={{ transitionDelay: `${delay + i * stagger}s` }}
          aria-hidden
        >
          {word}
        </motion.span>
      ))}
    </motion.span>
  );
}
