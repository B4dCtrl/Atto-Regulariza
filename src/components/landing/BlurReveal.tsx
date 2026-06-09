import { motion, useScroll, useTransform, type MotionStyle } from "framer-motion";
import { useRef, type ReactNode } from "react";

/**
 * Wraps children with a scroll-linked blur→clear + fade-in.
 * Use to give the Tubik/Cliento cinematic feel to any section/card.
 */
export function BlurReveal({
  children,
  className = "",
  amount = 6,
  offset = ["start 90%", "center 65%"],
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  amount?: number;
  offset?: [string, string];
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    // @ts-expect-error - framer accepts these string offsets
    offset,
  });
  const blur = useTransform(scrollYProgress, [0, 1], [amount, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.6, 1], [0.15, 0.85, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [24, 0]);
  const filter = useTransform(blur, (b) => `blur(${b}px)`);

  const style: MotionStyle = { filter, opacity, y, transitionDelay: `${delay}s` };

  return (
    <motion.div ref={ref} style={style} className={className}>
      {children}
    </motion.div>
  );
}
