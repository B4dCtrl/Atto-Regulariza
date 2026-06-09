import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ChevronDown, Home, Building2, Briefcase } from "lucide-react";
import { LiquidGlassSurface } from "@/components/ui/liquid-glass-surface";

const anchorLinks = [
  { label: "Produto",       href: "/#produto" },
  { label: "Como funciona", href: "/#como-funciona" },
];

const paraQuemLinks = [
  { label: "Pessoa física",   desc: "Proprietários e compradores",          to: "/" as const,               icon: Home      },
  { label: "Profissionais",   desc: "Arquitetos, engenheiros, advogados",   to: "/profissionais" as const,  icon: Briefcase },
  { label: "Institucional",   desc: "Imobiliárias, construtoras e órgãos", to: "/institucional" as const,  icon: Building2 },
];

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
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0,   opacity: 1 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      className="fixed left-0 right-0 top-0 z-50 px-6 py-4"
    >
      {/*
       * Pílula flutuante com vidro líquido real (backdrop-filter + mapa SVG).
       * Refrata o que estiver atrás dela (os orbs coloridos do topo da hero).
       */}
      <LiquidGlassSurface
        className="mx-auto max-w-7xl rounded-full"
        glassColor="oklch(from var(--background) l c h / 5%)"
        blur={3.5}
        saturate={150}
        brightness={0.97}
        refraction={0}
        contentClassName="flex items-center justify-between px-5 py-2.5"
      >
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-foreground text-background">
            <span className="font-serif text-lg leading-none">R</span>
          </div>
          <span className="font-serif text-xl tracking-tight">Regulariza</span>
        </Link>

        {/* Links centrais */}
        <nav className="hidden items-center gap-6 md:flex">
          {anchorLinks.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="link-underline text-sm text-ink-soft transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}

          {/* Dropdown Para quem */}
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-sm text-ink-soft transition-colors hover:text-foreground"
            >
              Para quem
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
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

          <Link to="/precos"              className="link-underline text-sm text-ink-soft transition-colors hover:text-foreground">Preços</Link>
          <Link to="/precos/institucional" className="link-underline text-sm text-ink-soft transition-colors hover:text-foreground">Preços B2B</Link>
        </nav>

        {/* CTAs */}
        <div className="flex items-center gap-2">
          <Link to="/entrar" className="hidden text-sm text-ink-soft transition-colors hover:text-foreground sm:inline">
            Entrar
          </Link>
          <Link
            to="/precos"
            data-cursor="expand"
            className="group inline-flex items-center gap-2 rounded-full bg-foreground
                       py-2 pl-4 pr-2 text-sm text-background transition-all hover:bg-foreground/90"
          >
            Começar agora
            <span className="grid h-7 w-7 place-items-center rounded-full bg-accent transition-transform group-hover:rotate-12">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </Link>
        </div>
      </LiquidGlassSurface>
    </motion.header>
  );
}
