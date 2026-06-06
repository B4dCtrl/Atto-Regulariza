import { BlurReveal } from "./BlurReveal";
import { User, Briefcase, Building } from "lucide-react";

const envs = [
  {
    tag: "Área do Cliente",
    icon: User,
    title: "Tranquilidade em forma de painel.",
    desc: "O cliente vê seu imóvel, sua timeline e seus próximos passos — sem termos técnicos, sem ansiedade.",
    bullets: ["Timeline visual da regularização", "Central de documentos", "IA que explica em linguagem humana"],
    mock: (
      <div className="space-y-3">
        <div className="rounded-2xl bg-surface-elevated p-4 ring-1 ring-border">
          <div className="text-xs text-ink-soft">Status atual</div>
          <div className="mt-1 font-serif text-2xl">Em prefeitura</div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface">
            <div className="h-full w-[55%] rounded-full bg-accent" />
          </div>
          <div className="mt-2 text-xs text-ink-soft">3 de 6 etapas · próxima em ~7 dias</div>
        </div>
        <div className="rounded-2xl bg-surface-elevated p-4 ring-1 ring-border">
          <div className="text-xs text-ink-soft">Responsável agora</div>
          <div className="mt-2 flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-background text-sm">CR</div>
            <div>
              <div className="text-sm font-medium">Carla Rocha</div>
              <div className="text-xs text-ink-soft">Arquiteta · CAU 12345</div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    tag: "Área do Profissional",
    icon: Briefcase,
    title: "Operação premium, com inteligência embarcada.",
    desc: "Arquitetos, engenheiros, advogados e despachantes acessam um kanban claro, instruções por cidade e suporte direto.",
    bullets: ["Kanban de processos ativos", "Instruções por prefeitura e cartório", "Assistente operacional com IA"],
    mock: (
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        {[
          { t: "A fazer", n: 4, items: ["Coletar matrícula", "Conferir ITBI"] },
          { t: "Em curso", n: 2, items: ["Protocolo prefeitura", "Análise cartório"], hi: true },
          { t: "Concluídos", n: 6, items: ["Habite-se", "ART/RRT"] },
        ].map((col, i) => (
          <div key={i} className="rounded-2xl bg-surface-elevated p-3 ring-1 ring-border">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium">{col.t}</span>
              <span className="text-ink-soft">{col.n}</span>
            </div>
            <div className="space-y-1.5">
              {col.items.map((it, j) => (
                <div
                  key={j}
                  className={`rounded-lg px-2 py-1.5 ${col.hi && j === 0 ? "bg-accent text-accent-foreground" : "bg-surface"}`}
                >
                  {it}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    tag: "Central da Empresa",
    icon: Building,
    title: "Uma torre de controle para toda a operação.",
    desc: "Monitore todos os processos, profissionais e SLAs em tempo real. Detecte gargalos antes que virem problema.",
    bullets: ["Métricas e SLAs em tempo real", "Validação central de documentos", "Automação de etapas e alertas"],
    mock: (
      <div className="grid grid-cols-2 gap-3">
        {[
          { l: "Processos ativos", v: "1.284" },
          { l: "SLA no prazo", v: "97,2%" },
          { l: "Profissionais", v: "342" },
          { l: "Cidades atendidas", v: "118" },
        ].map((m, i) => (
          <div key={i} className="rounded-2xl bg-surface-elevated p-4 ring-1 ring-border">
            <div className="text-xs text-ink-soft">{m.l}</div>
            <div className="mt-1 font-serif text-2xl">{m.v}</div>
          </div>
        ))}
        <div className="col-span-2 rounded-2xl bg-foreground p-4 text-background">
          <div className="text-xs text-background/60">Alerta inteligente</div>
          <div className="mt-1 text-sm">3 processos em risco de SLA na regional Campinas</div>
        </div>
      </div>
    ),
  },
];

export function Environments() {
  return (
    <section className="px-6 pb-32">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-ink-soft">
            Uma plataforma, três visões
          </div>
          <h2 className="font-serif text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.05] tracking-tight text-balance">
            Pensado para todos os lados
            <br />
            <span className="italic text-ink-soft">do mesmo processo.</span>
          </h2>
        </div>

        <div className="space-y-20">
          {envs.map((e, i) => (
            <BlurReveal
              key={e.tag}
              className={`grid items-center gap-10 md:grid-cols-2 ${i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""}`}
            >
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs text-accent">
                  <e.icon className="h-3 w-3" /> {e.tag}
                </div>
                <h3 className="font-serif text-4xl leading-tight tracking-tight">{e.title}</h3>
                <p className="mt-4 max-w-md text-base leading-relaxed text-ink-soft">{e.desc}</p>
                <ul className="mt-6 space-y-2">
                  {e.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-sm">
                      <span className="mt-1.5 h-1 w-4 rounded-full bg-accent" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[28px] border border-border bg-surface/60 p-5 shadow-[0_30px_80px_-40px_oklch(0.16_0.01_60_/_0.4)]">
                {e.mock}
              </div>
            </BlurReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
