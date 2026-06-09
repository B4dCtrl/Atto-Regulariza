import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ChevronDown, Home, Building2, Briefcase } from "lucide-react";
import { LiquidGlassSurface } from "@/components/ui/liquid-glass-surface";

const GLASS = {
  glassColor: "oklch(from var(--background) l c h / 0%)",
  blur: 1.2,
  saturate: 175,
  brightness: 1.16,
  refraction: 0,
} as const;

const paraQuemLinks = [
  { label: "Pessoa física",  desc: "Proprietários e compradores",          to: "/" as const,              icon: Home      },
  { label: "Profissionais",  desc: "Arquitetos, engenheiros, advogados",   to: "/profissionais" as const, icon: Briefcase },
  { label: "Institucional",  desc: "Imobiliárias, construtoras e órgãos", to: "/institucional" as const, icon: Building2 },
];

const EASE = [0.22, 1, 0.36, 1] as const;

export function Nav() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">

        {/* ── Island 1: Logo ── */}
        <LiquidGlassSurface
          {...GLASS}
          className="rounded-full"
          contentClassName="flex items-center gap-2.5 px-4 py-2.5"
        >
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-6 w-6 place-items-center rounded-md bg-foreground text-background">
              <span className="font-serif text-sm leading-none">R</span>
            </div>
            <span className="font-serif text-base tracking-tight">Regulariza</span>
          </Link>
        </LiquidGlassSurface>

        {/* ── Island 2: Links centrais (oculto em mobile) ── */}
        <LiquidGlassSurface
          {...GLASS}
          className="hidden rounded-full md:block"
          contentClassName="flex items-center gap-1 px-3 py-2"
        >
          <a
            href="/#produto"
            className="rounded-full px-3.5 py-1.5 text-sm text-ink-soft transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            Produto
          </a>
          <a
            href="/#como-funciona"
            className="rounded-full px-3.5 py-1.5 text-sm text-ink-soft transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            Como funciona
          </a>

          {/* Dropdown Para quem */}
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-sm text-ink-soft transition-colors hover:bg-foreground/5 hover:text-foreground"
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
                {paraQuemLinks.map((item) => (
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
            className="rounded-full px-3.5 py-1.5 text-sm text-ink-soft transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            Preços
          </Link>
        </LiquidGlassSurface>

        {/* ── Island 3: CTAs ── */}
        <LiquidGlassSurface
          {...GLASS}
          className="rounded-full"
          contentClassName="flex items-center gap-2 px-3 py-2"
        >
          <Link
            to="/entrar"
            className="hidden rounded-full px-3.5 py-1.5 text-sm text-ink-soft transition-colors hover:bg-foreground/5 hover:text-foreground sm:inline-flex"
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
        </LiquidGlassSurface>

      </div>
    </motion.header>
  );
}
