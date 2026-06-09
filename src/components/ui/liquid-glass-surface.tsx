import * as React from "react";
import { cn } from "@/lib/utils";
import { WEBP_DISPLACEMENT_MAP } from "@/components/ui/liquid-glass-map";

export interface LiquidGlassSurfaceProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Tint do vidro. Default = vidro neutro bem transparente. */
  glassColor?: string;
  /** Blur do fundo (px). Default 7. */
  blur?: number;
  /** Saturação do que está atrás. Default 175%. */
  saturate?: number;
  /** Escala da refração de borda (0 = sem). Default 0.12 — sutil, só no rim. */
  refraction?: number;
  /** Brilho do fundo. <1 escurece, >1 clareia. Default 1.05. */
  brightness?: number;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

/**
 * "Liquid glass" em CSS puro — parece vidro de verdade, sem WebGL/html2canvas
 * (que travavam a página por causa do oklch). Combina:
 *   • frosted blur leve            → translucidez
 *   • refração de BORDA (SVG map)  → luz curva no rim, como vidro; escala baixa
 *                                    p/ o centro ficar limpo (sem distorcer
 *                                    conteúdo em movimento atrás de nav fixa)
 *   • specular rim highlights      → o "brilho" do vidro
 */
export const LiquidGlassSurface = React.forwardRef<
  HTMLDivElement,
  LiquidGlassSurfaceProps
>(
  (
    {
      glassColor,
      blur = 3,
      saturate = 170,
      refraction = 0.1,
      brightness = 1.05,
      children,
      className,
      contentClassName,
      ...props
    },
    ref
  ) => {
    const id = React.useId().replace(/:/g, "");
    const lens = `lg-${id}`;

    return (
      <div ref={ref} className={cn("relative isolate", className)} {...props}>
        {/* Filtro de refração de borda (mapa de deslocamento) */}
        <svg
          className="pointer-events-none absolute h-0 w-0 overflow-hidden"
          aria-hidden="true"
        >
          <filter id={`flt-${id}`} primitiveUnits="objectBoundingBox">
            <feImage
              result="map"
              href={WEBP_DISPLACEMENT_MAP}
              width="100%"
              height="100%"
              x="0"
              y="0"
              preserveAspectRatio="none"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={refraction}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </svg>

        <style>{`
          .${lens} {
            /* Tint Opacity 0.06 (igual ao painel) */
            background-color: ${glassColor || "oklch(from var(--background) l c h / 6%)"};
            /* refração no rim (url) + blur + brilho — Chromium/Safari */
            backdrop-filter: blur(${blur}px) url(#flt-${id}) saturate(${saturate}%) brightness(${brightness});
            -webkit-backdrop-filter: blur(${blur}px) saturate(${saturate}%) brightness(${brightness});
            box-shadow:
              /* contorno de vidro */
              inset 0 0 0 1px color-mix(in srgb, white 22%, transparent),
              /* rim de luz no topo (lábio do vidro) */
              inset 0 2px 1px -0.5px color-mix(in srgb, white 90%, transparent),
              inset 1px 0 1px -0.5px color-mix(in srgb, white 55%, transparent),
              /* sombra interna inferior — volume/curvatura */
              inset 0 -10px 16px -12px color-mix(in srgb, black 35%, transparent),
              inset -2px -4px 8px -6px color-mix(in srgb, black 22%, transparent),
              /* elevação externa */
              0 1px 2px color-mix(in srgb, black 6%, transparent),
              0 10px 30px -8px color-mix(in srgb, black 16%, transparent);
          }
          /* Brilho convexo (curvatura da lente) — diagonal superior */
          .${lens}-sheen {
            background: linear-gradient(
              130deg,
              color-mix(in srgb, white 40%, transparent) 0%,
              transparent 30%,
              transparent 70%,
              color-mix(in srgb, white 14%, transparent) 100%
            );
            mix-blend-mode: screen;
          }
        `}</style>

        {/* Vidro (vazio — só refração/blur) */}
        <span
          className={cn(
            lens,
            "pointer-events-none absolute inset-0 -z-10 rounded-[inherit]"
          )}
        />
        {/* Brilho especular */}
        <span
          className={cn(
            `${lens}-sheen`,
            "pointer-events-none absolute inset-0 -z-10 rounded-[inherit]"
          )}
        />

        {/* Conteúdo acima do vidro */}
        <div className={cn("relative z-10", contentClassName)}>{children}</div>
      </div>
    );
  }
);
LiquidGlassSurface.displayName = "LiquidGlassSurface";
