import {
  BookOpen,
  Compass,
  Cpu,
  Gavel,
  ShieldCheck,
  Landmark,
  type LucideIcon,
} from "lucide-react";

interface Logo {
  name: string;
  full: string;
  Icon: LucideIcon;
  color: string;
  bg: string;
}

const logos: Logo[] = [
  {
    name: "RI Digital",
    full: "Registro de Imóveis Digital",
    Icon: BookOpen,
    color: "#1a4a8a",
    bg: "#eef3fc",
  },
  {
    name: "CAU/BR",
    full: "Conselho de Arquitetura e Urbanismo",
    Icon: Compass,
    color: "#005c4b",
    bg: "#e6f5f2",
  },
  {
    name: "CREA",
    full: "Conselho de Engenharia",
    Icon: Cpu,
    color: "#b03800",
    bg: "#fdf0e6",
  },
  {
    name: "OAB",
    full: "Ordem dos Advogados do Brasil",
    Icon: Gavel,
    color: "#1a3a6a",
    bg: "#eaeff8",
  },
  {
    name: "Receita Federal",
    full: "Receita Federal do Brasil",
    Icon: ShieldCheck,
    color: "#1a5c2a",
    bg: "#e8f5ec",
  },
  {
    name: "Prefeitura Digital",
    full: "Serviços Municipais Online",
    Icon: Landmark,
    color: "#5a1a4a",
    bg: "#f5e8f2",
  },
];

function LogoChip({ logo }: { logo: Logo }) {
  return (
    <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-border/50 bg-background px-5 py-3 shadow-sm">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
        style={{ background: logo.bg, color: logo.color }}
      >
        <logo.Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
      </span>
      <div className="flex flex-col justify-center">
        <span className="whitespace-nowrap text-sm font-semibold leading-tight text-foreground">
          {logo.name}
        </span>
        <span className="whitespace-nowrap text-[10px] leading-tight text-ink-soft">
          {logo.full}
        </span>
      </div>
    </div>
  );
}

interface RowProps {
  logos: Logo[];
  reverse?: boolean;
  duration?: string;
}

function MarqueeRow({ logos: list, reverse = false, duration = "42s" }: RowProps) {
  /* Duplicar uma vez — animar 50% = exatamente uma cópia ↔ loop sem costura */
  const items = [...list, ...list];
  const animName = reverse ? "marquee-bwd" : "marquee-fwd";

  return (
    <div
      className="flex overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
      }}
    >
      <div
        className="flex gap-3"
        style={{
          animation: `${animName} ${duration} linear infinite`,
          willChange: "transform",
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
      <style>{`
        @keyframes marquee-fwd {
          from { transform: translate3d(0, 0, 0); }
          to   { transform: translate3d(-50%, 0, 0); }
        }
        @keyframes marquee-bwd {
          from { transform: translate3d(-50%, 0, 0); }
          to   { transform: translate3d(0, 0, 0); }
        }
      `}</style>

      <p className="mb-6 text-center text-xs uppercase tracking-[0.2em] text-ink-soft">
        Integrado com órgãos e profissionais em todo o Brasil
      </p>

      <div className="space-y-3">
        <MarqueeRow logos={logos}        duration="40s" />
        <MarqueeRow logos={[...logos].reverse()} reverse duration="52s" />
      </div>
    </section>
  );
}
