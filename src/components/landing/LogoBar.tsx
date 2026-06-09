import { BookOpen, Compass, Cpu, Gavel, ShieldCheck, Landmark } from "lucide-react";

const logos = [
  { name: "RI Digital",         full: "Registro de Imóveis Digital",        Icon: BookOpen,    color: "#1a4a8a" },
  { name: "CAU/BR",             full: "Conselho de Arquitetura e Urbanismo", Icon: Compass,     color: "#005c4b" },
  { name: "CREA",               full: "Conselho de Engenharia",              Icon: Cpu,         color: "#b03800" },
  { name: "OAB",                full: "Ordem dos Advogados do Brasil",       Icon: Gavel,       color: "#1a3a6a" },
  { name: "Receita Federal",    full: "Receita Federal do Brasil",           Icon: ShieldCheck, color: "#1a5c2a" },
  { name: "Prefeitura Digital", full: "Serviços Municipais Online",          Icon: Landmark,    color: "#5a1a4a" },
];

function LogoChip({ logo }: { logo: (typeof logos)[number] }) {
  return (
    <div
      className="flex shrink-0 items-center gap-2 rounded-xl border border-border/40 bg-surface/20 px-3.5 py-2 transition-all hover:border-border/70 hover:bg-surface/40"
      style={{ minWidth: "148px" }}
    >
      <div
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
        style={{ backgroundColor: `${logo.color}18` }}
      >
        <logo.Icon className="h-3.5 w-3.5" style={{ color: logo.color }} />
      </div>
      <span className="text-xs font-medium text-foreground/70 truncate">
        {logo.name}
      </span>
    </div>
  );
}

export function LogoBar() {
  return (
    <section className="bg-background py-9">
      <style>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .ticker-track {
          animation: ticker 28s linear infinite;
          will-change: transform;
        }
        .ticker-track:hover { animation-play-state: paused; }
      `}</style>

      {/* Layout Tailark: label à esquerda + marquee preenche o resto */}
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="flex items-center gap-8">

          {/* Label — esquerda, estático */}
          <div className="shrink-0 w-[130px] sm:w-[148px]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft leading-snug">
              INTEGRAÇÃO
            </p>
            <p className="text-[11px] text-ink-soft/70 leading-snug mt-0.5">
              com diversos parceiros
            </p>
          </div>

          {/* Separador vertical */}
          <div className="h-8 w-px shrink-0 bg-border/50" />

          {/* Marquee + portais de blur */}
          <div className="relative flex-1 overflow-hidden">

            {/* Portal esquerdo — blur + fade na cor do fundo */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24"
              style={{
                backdropFilter: "blur(5px)",
                WebkitBackdropFilter: "blur(5px)",
                maskImage: "linear-gradient(to right, black 25%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to right, black 25%, transparent 100%)",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-28"
              style={{
                background: "linear-gradient(to right, var(--background) 30%, transparent 100%)",
              }}
            />

            {/* Portal direito */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24"
              style={{
                backdropFilter: "blur(5px)",
                WebkitBackdropFilter: "blur(5px)",
                maskImage: "linear-gradient(to left, black 25%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to left, black 25%, transparent 100%)",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-28"
              style={{
                background: "linear-gradient(to left, var(--background) 30%, transparent 100%)",
              }}
            />

            {/* Faixa de logos em loop */}
            <div className="ticker-track flex gap-3 py-1">
              {[...logos, ...logos, ...logos].map((logo, i) => (
                <LogoChip key={i} logo={logo} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Divisor */}
      <div className="mx-auto mt-8 max-w-7xl px-6 lg:px-12">
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>
    </section>
  );
}
