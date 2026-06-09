/**
 * LogoBar — faixa de integrações com marquee infinito.
 * Duas fileiras em direções opostas para visual rico.
 * SVG inline — sem dependências externas.
 */

interface Logo {
  name: string;
  abbr: string;
  bg: string;
}

const row1: Logo[] = [
  { name: "RI Digital",        abbr: "RI",  bg: "#1a4a7a" },
  { name: "CAU/BR",            abbr: "CAU", bg: "#005c4b" },
  { name: "CREA",              abbr: "CREA",bg: "#c04a00" },
  { name: "OAB",               abbr: "OAB", bg: "#1a3a6a" },
  { name: "Receita Federal",   abbr: "RF",  bg: "#1a5c2a" },
  { name: "Prefeitura Digital",abbr: "PD",  bg: "#6a1a4a" },
];

const row2: Logo[] = [
  { name: "Prefeitura Digital",abbr: "PD",  bg: "#6a1a4a" },
  { name: "Receita Federal",   abbr: "RF",  bg: "#1a5c2a" },
  { name: "OAB",               abbr: "OAB", bg: "#1a3a6a" },
  { name: "CREA",              abbr: "CREA",bg: "#c04a00" },
  { name: "CAU/BR",            abbr: "CAU", bg: "#005c4b" },
  { name: "RI Digital",        abbr: "RI",  bg: "#1a4a7a" },
];

function LogoChip({ logo }: { logo: Logo }) {
  return (
    <div className="flex shrink-0 items-center gap-2.5 rounded-2xl border border-border bg-surface-elevated px-4 py-2.5 shadow-sm">
      {/* Ícone quadrado arredondado com cor de marca */}
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-bold text-white"
        style={{ background: logo.bg }}
      >
        {logo.abbr.slice(0, 2)}
      </span>
      <span className="whitespace-nowrap text-sm font-medium text-foreground">
        {logo.name}
      </span>
    </div>
  );
}

function MarqueeRow({
  logos,
  reverse = false,
  duration = "38s",
}: {
  logos: Logo[];
  reverse?: boolean;
  duration?: string;
}) {
  // Duplicar para loop contínuo sem lacuna
  const items = [...logos, ...logos, ...logos];

  return (
    <div className="group flex overflow-hidden">
      <div
        className="flex gap-3"
        style={{
          animation: `marquee-${reverse ? "reverse" : "forward"} ${duration} linear infinite`,
        }}
      >
        {items.map((logo, i) => (
          <LogoChip key={`${logo.name}-${i}`} logo={logo} />
        ))}
      </div>
    </div>
  );
}

export function LogoBar() {
  return (
    <section className="border-y border-border/60 bg-surface/40 py-10 overflow-hidden">
      {/* Estilos de animação embutidos — evita Tailwind arbitrário */}
      <style>{`
        @keyframes marquee-forward {
          from { transform: translateX(0); }
          to   { transform: translateX(-33.333%); }
        }
        @keyframes marquee-reverse {
          from { transform: translateX(-33.333%); }
          to   { transform: translateX(0); }
        }
      `}</style>

      <p className="mb-6 text-center text-xs uppercase tracking-[0.2em] text-ink-soft">
        Integrado com órgãos e profissionais em todo o Brasil
      </p>

      <div className="space-y-3">
        <MarqueeRow logos={row1} duration="36s" />
        <MarqueeRow logos={row2} reverse duration="42s" />
      </div>
    </section>
  );
}
