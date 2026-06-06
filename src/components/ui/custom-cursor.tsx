import { useEffect, useRef, useState } from "react";

type CursorState = "default" | "expand" | "text" | "hidden";

/**
 * Cursor personalizado — substituí o cursor nativo em desktop.
 * - Ponto pequeno que segue o mouse com lag suave
 * - Expande sobre CTAs   [data-cursor="expand"]
 * - Vira barra de texto  [data-cursor="text"]
 * - Some em iframes      [data-cursor="hidden"]
 */
export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<CursorState>("default");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Não mostrar em dispositivos touch
    if (window.matchMedia("(hover: none)").matches) return;

    const cursor = cursorRef.current as HTMLDivElement;
    const ring = ringRef.current as HTMLDivElement;
    if (!cursor || !ring) return;

    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;
    let rafId = 0;

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    function animate() {
      // Cursor central: segue imediatamente
      cursor.style.transform = `translate(${mouseX - 4}px, ${mouseY - 4}px)`;

      // Anel externo: segue com lag
      ringX = lerp(ringX, mouseX, 0.12);
      ringY = lerp(ringY, mouseY, 0.12);
      ring.style.transform = `translate(${ringX - 16}px, ${ringY - 16}px)`;

      rafId = requestAnimationFrame(animate);
    }

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!visible) setVisible(true);

      // Detectar estado pelo elemento sob o cursor
      const el = document.elementFromPoint(mouseX, mouseY);
      const target = el?.closest("[data-cursor]");
      const val = target?.getAttribute("data-cursor") as CursorState | null;
      setState(val ?? "default");
    };

    const onLeave = () => setVisible(false);
    const onEnter = () => setVisible(true);

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseenter", onEnter);
    rafId = requestAnimationFrame(animate);

    // Esconder cursor nativo globalmente
    document.documentElement.style.cursor = "none";

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseenter", onEnter);
      cancelAnimationFrame(rafId);
      document.documentElement.style.cursor = "";
    };
  }, [visible]);

  // Dimensões e cores por estado
  const styles: Record<CursorState, React.CSSProperties> = {
    default: {
      width: 32,
      height: 32,
      borderColor: "oklch(0.16 0.01 60 / 0.35)",
      backgroundColor: "transparent",
    },
    expand: {
      width: 56,
      height: 56,
      borderColor: "oklch(0.66 0.18 38 / 0.5)",
      backgroundColor: "oklch(0.66 0.18 38 / 0.08)",
    },
    text: {
      width: 4,
      height: 28,
      borderRadius: "2px",
      borderColor: "oklch(0.16 0.01 60 / 0.6)",
      backgroundColor: "oklch(0.16 0.01 60 / 0.6)",
    },
    hidden: {
      opacity: 0,
    },
  };

  if (typeof window === "undefined") return null;

  return (
    <>
      {/* Ponto central */}
      <div
        ref={cursorRef}
        aria-hidden
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: "oklch(0.16 0.01 60)",
          pointerEvents: "none",
          zIndex: 9999,
          opacity: visible ? 1 : 0,
          transition: "opacity 0.2s",
          willChange: "transform",
        }}
      />

      {/* Anel com lag */}
      <div
        ref={ringRef}
        aria-hidden
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          borderRadius: "50%",
          border: "1.5px solid",
          pointerEvents: "none",
          zIndex: 9998,
          opacity: visible ? 1 : 0,
          transition:
            "opacity 0.2s, width 0.25s cubic-bezier(0.22,1,0.36,1), height 0.25s cubic-bezier(0.22,1,0.36,1), background-color 0.25s, border-color 0.25s",
          willChange: "transform",
          ...styles[state],
        }}
      />
    </>
  );
}
