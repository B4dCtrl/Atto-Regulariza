"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useScroll, LayoutGroup } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ChevronDown, Home, Building2, Briefcase } from "lucide-react";

/* ─── Glass CSS — dois estilos conforme o fundo ────────────────────────── */

/**
 * MERGED — sobre a hero escura (oklch 0.13).
 * Specular highlights brancos ficam visíveis sobre fundo escuro.
 * 16% white = bem perceptível sem ser pesado.
 */
const GLASS_DARK: React.CSSProperties = {
  backdropFilter:       "blur(18.5px) saturate(175%) brightness(1.16)",
  WebkitBackdropFilter: "blur(18.5px) saturate(175%) brightness(1.16)",
  backgroundColor:      "color-mix(in srgb, white 16%, transparent)",
  boxShadow: [
    "inset 0 0 0 1px color-mix(in srgb, white 34%, transparent)",
    "inset 0 2px 1px -0.5px color-mix(in srgb, white 95%, transparent)",
    "inset 1px 0 1px -0.5px color-mix(in srgb, white 60%, transparent)",
    "inset 0 -10px 16px -12px color-mix(in srgb, black 30%, transparent)",
    "inset -2px -4px 8px -6px color-mix(in srgb, black 18%, transparent)",
    "0 2px 4px color-mix(in srgb, black 18%, transparent)",
    "0 16px 40px -10px color-mix(in srgb, black 32%, transparent)",
  ].join(", "),
};

/**
 * SPLIT — sobre o fundo creme claro da página.
 * Background semi-opaco + borda escura sutil para contraste no tema claro.
 */
const GLASS_LIGHT: React.CSSProperties = {
  backdropFilter:       "blur(18.5px) saturate(175%) brightness(1.16)",
  WebkitBackdropFilter: "blur(18.5px) saturate(175%) brightness(1.16)",
  backgroundColor:      "color-mix(in srgb, white 76%, transparent)",
  boxShadow: [
    "inset 0 0 0 1px color-mix(in srgb, black 7%, transparent)",
    "inset 0 1px 0 0 color-mix(in srgb, white 85%, transparent)",
    "inset 0 -1px 0 0 color-mix(in srgb, black 4%, transparent)",
    "0 1px 3px color-mix(in srgb, black 5%, transparent)",
    "0 8px 24px -8px color-mix(in srgb, black 12%, transparent)",
  ].join(", "),
};

const SPRING = {
  type: "spring" as const,
  stiffness: 340,
  damping: 28,
  mass: 0.9,
};

const EASE = [0.22, 1, 0.36, 1] as const;

const PARA_QUEM = [
  { label: "Pessoa física",  desc: "Proprietários e compradores",          to: "/" as const,              icon: Home      },
  { label: "Profissionais",  desc: "Arquitetos, engenheiros, advogados",   to: "/profissionais" as const, icon: Briefcase },
  { label: "Institucional",  desc: "Imobiliárias, construtoras e órgãos", to: "/institucional" as const, icon: Building2 },
];

export function Nav() {
  const [split, setSplit] = useState(false);
  const [open,  setOpen]  = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();

  /* Detecta quando saiu da hero (~90dvh).
   * Verifica posição inicial também (caso a página carregue já rolada). */
  useEffect(() => {
    const threshold = window.innerHeight * 0.90;
    // Verifica posição atual na montagem
    setSplit(scrollY.get() > threshold);
    // Escuta mudanças contínuas
    return scrollY.on("change", (y) => {
      setSplit(y > threshold);
    });
  }, [scrollY]);

  /* Fecha dropdown ao clicar fora */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);

  return (
    <motion.header
      initial={{ y: -28, opacity: 0 }}
      animate={{ y: 0,   opacity: 1 }}
      transition={{ duration: 0.65, ease: EASE }}
      className="fixed left-0 right-0 top-0 z-50 px-5 py-4"
    >
      <LayoutGroup id="nav">
        {/*
         * Container principal.
         * MERGED  → w-fit, sem gap, centrado — todos os islands colados formando 1 pill.
         * SPLIT   → w-full max-w-7xl, gap-3, justify-between — 3 pills separados.
         * O `layout` anima a transição com mola (spring).
         */}
        <motion.div
          layout
          transition={SPRING}
          style={
            /* Quando merged: GLASS_DARK no WRAPPER cobre os 3 islands (sobre hero escura) */
            !split
              ? { ...GLASS_DARK, borderRadius: "9999px" }
              : {}
          }
          className={
            split
              ? "mx-auto flex w-full max-w-7xl items-center justify-between gap-3"
              : "mx-auto flex w-fit items-center gap-0"
          }
        >

          {/* ── Island 1: Logo ── */}
          <motion.div
            layout
            transition={SPRING}
            style={
              split
                ? { ...GLASS_LIGHT, borderRadius: "9999px" }    // island próprio (fundo claro)
                : { borderRadius: "9999px 0 0 9999px" }         // parte do pill unificado
            }
            className="flex items-center px-4 py-2.5"
          >
            <Link to="/" className="flex items-center gap-2">
              <div className="grid h-6 w-6 place-items-center rounded-md bg-foreground text-background">
                <span className="font-serif text-sm leading-none">R</span>
              </div>
              <span className="font-serif text-base tracking-tight">Regulariza</span>
            </Link>
          </motion.div>

          {/* Divisor entre logo e links (some ao separar) */}
          <motion.div
            layout
            animate={{ opacity: split ? 0 : 1, scaleX: split ? 0 : 1 }}
            transition={SPRING}
            className="hidden h-4 w-px shrink-0 bg-foreground/12 md:block"
          />

          {/* ── Island 2: Links de navegação ── */}
          <motion.div
            layout
            transition={SPRING}
            style={
              split
                ? { ...GLASS_LIGHT, borderRadius: "9999px" }
                : { borderRadius: "0" }
            }
            className="hidden items-center gap-0.5 px-2 py-2 md:flex"
          >
            <a
              href="/#produto"
              className="rounded-full px-3.5 py-1.5 text-sm text-ink-soft transition-colors hover:bg-foreground/6 hover:text-foreground"
            >
              Produto
            </a>
            <a
              href="/#como-funciona"
              className="rounded-full px-3.5 py-1.5 text-sm text-ink-soft transition-colors hover:bg-foreground/6 hover:text-foreground"
            >
              Como funciona
            </a>

            {/* Dropdown */}
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-sm text-ink-soft transition-colors hover:bg-foreground/6 hover:text-foreground"
              >
                Para quem
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                />
              </button>
              {open && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.18, ease: EASE }}
                  className="absolute left-1/2 top-full z-[60] mt-3 w-64 -translate-x-1/2
                             rounded-2xl border border-border bg-background p-2
                             shadow-[0_24px_60px_-20px_oklch(0.16_0.01_60_/_0.35)]"
                >
                  {PARA_QUEM.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-surface"
                    >
                      <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-lg bg-surface ring-1 ring-border">
                        <item.icon className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-medium">{item.label}</span>
                        <span className="block text-xs text-ink-soft">{item.desc}</span>
                      </span>
                    </Link>
                  ))}
                </motion.div>
              )}
            </div>

            <Link
              to="/precos"
              className="rounded-full px-3.5 py-1.5 text-sm text-ink-soft transition-colors hover:bg-foreground/6 hover:text-foreground"
            >
              Preços
            </Link>
          </motion.div>

          {/* Divisor entre links e CTAs (some ao separar) */}
          <motion.div
            layout
            animate={{ opacity: split ? 0 : 1, scaleX: split ? 0 : 1 }}
            transition={SPRING}
            className="hidden h-4 w-px shrink-0 bg-foreground/12 md:block"
          />

          {/* ── Island 3: CTAs ── */}
          <motion.div
            layout
            transition={SPRING}
            style={
              split
                ? { ...GLASS_LIGHT, borderRadius: "9999px" }
                : { borderRadius: "0 9999px 9999px 0" }
            }
            className="flex items-center gap-2 px-3 py-2"
          >
            <Link
              to="/entrar"
              className="hidden rounded-full px-3.5 py-1.5 text-sm text-ink-soft transition-colors hover:bg-foreground/6 hover:text-foreground sm:inline-flex"
            >
              Entrar
            </Link>
            <Link
              to="/precos"
              className="group inline-flex items-center gap-1.5 rounded-full bg-foreground py-1.5 pl-4 pr-1.5 text-sm text-background transition-all hover:bg-foreground/90"
            >
              Começar agora
              <span className="grid h-6 w-6 place-items-center rounded-full bg-accent transition-transform group-hover:rotate-12">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </motion.div>

        </motion.div>
      </LayoutGroup>
    </motion.header>
  );
}
