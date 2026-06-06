import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

interface MagneticButtonProps {
  children: ReactNode;
  className?: string;
  /** 0 = sem efeito · 1 = cursor puxa totalmente o botão */
  strength?: number;
  /** Raio em px — fora desse raio o efeito não acontece */
  radius?: number;
  as?: "button" | "a" | "div";
  [key: string]: unknown;
}

const SPRING = { stiffness: 180, damping: 18, mass: 0.8 };

export function MagneticButton({
  children,
  className = "",
  strength = 0.38,
  radius = 120,
  as: Tag = "div",
  ...props
}: MagneticButtonProps) {
  const ref = useRef<HTMLElement>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, SPRING);
  const sy = useSpring(y, SPRING);

  function onMouseMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < radius) {
      x.set(dx * strength);
      y.set(dy * strength);
    }
  }

  function onMouseLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref as React.RefObject<HTMLDivElement>}
      style={{ x: sx, y: sy, display: "inline-flex" }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      data-cursor="expand"
    >
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Tag className={className} {...(props as any)}>
        {children}
      </Tag>
    </motion.div>
  );
}
