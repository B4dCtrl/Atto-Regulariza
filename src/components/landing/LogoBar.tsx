import { BookOpen, Compass, Cpu, Gavel, ShieldCheck, Landmark } from "lucide-react";

const logos = [
  { name: "RI Digital",         full: "Registro de Imóveis Digital",        Icon: BookOpen,    color: "#1a4a8a" },
  { name: "CAU/BR",             full: "Conselho de Arquitetura e Urbanismo", Icon: Compass,     color: "#005c4b" },
  { name: "CREA",               full: "Conselho de Engenharia",              Icon: Cpu,         color: "#b03800" },
  { name: "OAB",                full: "Ordem dos Advogados do Brasil",       Icon: Gavel,       color: "#1a3a6a" },
  { name: "Receita Federal",    full: "Receita Federal do Brasil",           Icon: ShieldCheck, color: "#1a5c2a" },
  { name: "Prefeitura Digital", full: "Serviços Municipais Online",          Icon: Landmark,    color: "#5a1a4a" },
];

function LogoCard({ logo }: { logo: (typeof logos)[number] }) {
  return (
    <div
      className="flex shrink-0 items-center gap-2.5 rounded-xl border border-border/50 bg-surface/30 px-4 py-2.5 backdrop-blur-sm transition-all hover:border-border hover:bg-surface/60"
      style={{ minWidth: "168px" }}
    >
      <div
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
        style={{ backgroundColor: `${logo.color}22` }}
      >
        <logo.Icon className="h-4 w-4" style={{ color: logo.color }} />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-foreground truncate">{logo.name}</div>
        <div className="text-[10px] text-ink-soft truncate">
          {logo.full.split(" ").slice(0, 3).join(" ")}
        </div>
      </div>
    </div>
  );
}

/* Efeito portal: blur + fade de cor nas bordas */
function PortalEdge({ side }: { side: "left" | "right" }) {
  const dir = side === "left" ? "to right" : "to left";
  return (
    <>
      {/* Camada 1: fade de cor (itens somem na cor do fundo) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 z-20 w-40"
        style={{
          [side]: 0,
          background: `linear-gradient(${dir}, var(--background) 25%, transparent 100%)`,
        }}
      />
      {/* Camada 2: blur crescente na borda (efeito portal) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 z-20 w-28"
        style={{
          [side]: 0,
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          maskImage: `linear-gradient(${dir}, black 30%, transparent 100%)`,
          WebkitMaskImage: `linear-gradient(${dir}, black 30%, transparent 100%)`,
        }}
      />
    </>
  );
}

const row2 = [...logos].reverse();

export function LogoBar() {
  return (
    <section className="overflow-hidden bg-background py-10">
      <style>{`
        @keyframes marquee-left {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes marquee-right {
          from { transform: translateX(-50%); }
          to   { transform: translateX(0); }
        }
        .marquee-left  { animation: marquee-left  30s linear infinite; }
        .marquee-right { animation: marquee-right 24s linear infinite; }
        .marquee-left:hover,
        .marquee-right:hover { animation-play-state: paused; }
      `}</style>

      {/* Cabeçalho */}
      <div className="mx-auto mb-7 max-w-7xl px-6 text-center lg:px-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-soft">
          INTEGRAÇÃO
        </p>
        <p className="mt-0.5 text-sm text-ink-soft">com diversos parceiros</p>
      </div>

      {/* Fileira 1 — desliza para a esquerda */}
      <div className="relative flex overflow-hidden py-1">
        <PortalEdge side="left" />
        <PortalEdge side="right" />
        <div className="marquee-left flex gap-3 px-3">
          {[...logos, ...logos].map((logo, i) => (
            <LogoCard key={i} logo={logo} />
          ))}
        </div>
      </div>

      {/* Fileira 2 — desliza para a direita */}
      <div className="relative mt-3 flex overflow-hidden py-1">
        <PortalEdge side="left" />
        <PortalEdge side="right" />
        <div className="marquee-right flex gap-3 px-3">
          {[...row2, ...row2].map((logo, i) => (
            <LogoCard key={i} logo={logo} />
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-auto mt-8 max-w-7xl px-6 lg:px-12">
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>
    </section>
  );
}
