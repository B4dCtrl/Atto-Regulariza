"use client";

import { useState, useEffect, useRef } from "react";
import { motion, LayoutGroup, AnimatePresence } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ChevronDown, Home, Building2, Briefcase } from "lucide-react";

/* ─── Glass CSS ─────────────────────────────────────────────────────────── */

/**
 * MERGED — sobre a hero escura.
 * Highlights brancos visíveis sobre fundo escuro.
 */
const GLASS_DARK: React.CSSProperties = {
  backdropFilter:       "blur(18.5px) saturate(175%) brightness(1.16)",
  WebkitBackdropFilter: "blur(18.5px) saturate(175%) brightness(1.16)",
  backgroundColor:      "color-mix(in srgb, white 16%, transparent)",
  borderRadius:         "9999px",
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
 * Background semi-opaco + borda escura sutil.
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

const SPRING = { type: "spring" as const, stiffness: 340, damping: 28, mass: 0.9 };
const EASE   = [0.22, 1, 0.36, 1] as const;

const PARA_QUEM = [
  { label: "Pessoa física",  desc: "Proprietários e compradores",          to: "/" as const,              icon: Home      },
  { label: "Profissionais",  desc: "Arquitetos, engenheiros, advogados",   to: "/profissionais" as const, icon: Briefcase },
  { label: "Institucional",  desc: "Imobiliárias, construtoras e órgãos", to: "/institucional" as const, icon: Building2 },
];

export function Nav() {
  const [split, setSplit] = useState(false);
  const [revealed, setRevealed] = useState(false); // menu só aparece após o 1º scroll
  const [open,  setOpen]  = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /* Antes do scroll: só a logo centralizada. Após rolar: menu (+ split na hero). */
  useEffect(() => {
    const apply = () => {
      const y = document.documentElement.scrollTop || window.scrollY || 0;
      setSplit(y > window.innerHeight * 0.90);
      setRevealed(y > 8);
    };
    apply();
    window.addEventListener("scroll", apply, { passive: true });
    window.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
    };
  }, []);

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
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.65, ease: EASE }}
      className="fixed left-0 right-0 top-0 z-50 px-5 py-4"
    >
      <LayoutGroup id="nav">
        {/* ── Intro: só a logo centralizada, antes do 1º scroll ── */}
        {!revealed && (
          <div className="relative flex justify-center pt-6">
            <Link to="/" aria-label="Ato Regulariza">
              <motion.div layoutId="ato-brand" transition={SPRING} className="flex items-center gap-3">
                <img src="/ato-icon.png" alt="" className="h-20 w-20 object-contain" />
                <img src="/ato-wordmark.png" alt="Ato Regulariza" className="h-14 w-auto object-contain" />
              </motion.div>
            </Link>

            {/* Entrar antes do primeiro scroll.
                Quem já é cliente ou profissional chega ao site para acessar o
                painel, não para ler a página — e até aqui precisava rolar a
                hero inteira para achar a porta.
                O `layoutId` é o mesmo do "Entrar" dentro do menu: o framer-motion
                trata os dois como o MESMO elemento e faz a viagem até o lugar
                dele, igual ao logo. Por isso o de baixo perde o texto próprio e
                passa a hospedar este. */}
            <Link
              to="/entrar"
              className="absolute right-1 top-6 sm:right-4"
              aria-label="Entrar na minha conta"
            >
              <motion.div
                layoutId="ato-entrar"
                transition={SPRING}
                className="rounded-full px-4 py-2 text-sm font-medium text-white/90"
                style={GLASS_DARK}
              >
                Entrar
              </motion.div>
            </Link>
          </div>
        )}

        {/*
         * O wrapper é apenas um container de layout — SEM glass.
         * O glass do estado merged vive como filho absoluto (AnimatePresence)
         * e só aparece com delay de 160ms, depois que os islands já convergiram.
         * Assim nunca aparece um pill largo com conteúdo espalhado.
         */}
        {revealed && (
        <motion.div
          layout
          transition={SPRING}
          className={
            split
              ? "relative mx-auto flex w-full max-w-7xl items-center justify-between gap-3"
              : "relative mx-auto flex w-fit items-center gap-0"
          }
        >

          {/* ── Glass merged: aparece COM DELAY quando items já convergiram ── */}
          <AnimatePresence>
            {!split && (
              <motion.div
                key="merged-glass"
                className="pointer-events-none absolute inset-0 -z-10"
                style={GLASS_DARK}
                initial={{ opacity: 0 }}
                animate={{
                  opacity: 1,
                  transition: { duration: 0.18, delay: 0.30, ease: EASE },
                }}
                exit={{
                  opacity: 0,
                  transition: { duration: 0.08 },
                }}
              />
            )}
          </AnimatePresence>

          {/* ── Island 1: Logo ── */}
          <motion.div
            layout
            transition={SPRING}
            style={
              split
                ? { ...GLASS_LIGHT, borderRadius: "9999px", transition: "background-color 0.18s ease, box-shadow 0.18s ease" }
                : { borderRadius: "9999px 0 0 9999px", backgroundColor: "transparent", backdropFilter: "none", WebkitBackdropFilter: "none", boxShadow: "none", transition: "background-color 0.12s ease, box-shadow 0.12s ease" }
            }
            className="flex items-center px-4 py-2.5"
          >
            <Link to="/" className="flex items-center">
              <motion.div layoutId="ato-brand" transition={SPRING} className="flex items-center gap-2">
                <img src="/ato-icon.png" alt="" className="h-9 w-9 object-contain" />
                <img src="/ato-wordmark.png" alt="Ato Regulariza" className="h-7 w-auto object-contain" />
              </motion.div>
            </Link>
          </motion.div>

          {/* Divisor logo → links (some ao separar) */}
          <motion.div
            layout
            animate={{ opacity: split ? 0 : 1, scaleX: split ? 0 : 1 }}
            transition={SPRING}
            className="hidden h-4 w-px shrink-0 bg-foreground/12 md:block"
          />

          {/* ── Island 2: Links ── */}
          <motion.div
            layout
            transition={SPRING}
            style={
              split
                ? { ...GLASS_LIGHT, borderRadius: "9999px", transition: "background-color 0.18s ease, box-shadow 0.18s ease" }
                : { borderRadius: "0", backgroundColor: "transparent", backdropFilter: "none", WebkitBackdropFilter: "none", boxShadow: "none", transition: "background-color 0.12s ease, box-shadow 0.12s ease" }
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
            <Link
              to="/equipe"
              className="rounded-full px-3.5 py-1.5 text-sm text-ink-soft transition-colors hover:bg-foreground/6 hover:text-foreground"
            >
              Equipe
            </Link>
          </motion.div>

          {/* Divisor links → CTAs (some ao separar) */}
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
                ? { ...GLASS_LIGHT, borderRadius: "9999px", transition: "background-color 0.18s ease, box-shadow 0.18s ease" }
                : { borderRadius: "0 9999px 9999px 0", backgroundColor: "transparent", backdropFilter: "none", WebkitBackdropFilter: "none", boxShadow: "none", transition: "background-color 0.12s ease, box-shadow 0.12s ease" }
            }
            className="flex items-center gap-2 px-3 py-2"
          >
            {/* Destino do "Entrar" da intro — mesmo layoutId, ver acima. */}
            {/* Visível também no celular: sem isto o "Entrar" da intro não tinha
                destino em tela estreita e sumia ao rolar em vez de viajar. */}
            <Link to="/entrar" className="inline-flex">
              <motion.div
                layoutId="ato-entrar"
                transition={SPRING}
                className="rounded-full px-3.5 py-1.5 text-sm text-ink-soft transition-colors hover:bg-foreground/6 hover:text-foreground"
              >
                Entrar
              </motion.div>
            </Link>
            <Link
              to="/cadastrar"
              className="group inline-flex items-center gap-1.5 rounded-full bg-foreground py-1.5 pl-4 pr-1.5 text-sm text-background transition-all hover:bg-foreground/90"
            >
              Começar agora
              <span className="grid h-6 w-6 place-items-center rounded-full bg-accent transition-transform group-hover:rotate-12">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </motion.div>

        </motion.div>
        )}
      </LayoutGroup>
    </motion.header>
  );
}
