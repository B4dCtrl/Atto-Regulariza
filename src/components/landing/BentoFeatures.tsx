import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ArrowRight, Sparkles, FileCheck2, Clock } from "lucide-react";
import { NumberTicker } from "@/components/ui/number-ticker";

function Block({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-3xl ring-1 ring-border/70 ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function BentoFeatures() {
  const progressRef = useRef<HTMLDivElement>(null);
  const progressInView = useInView(progressRef, { once: true });

  return (
    <section className="px-6 pb-32">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-14 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-ink-soft">
            Por que escolher
          </div>
          <h2 className="font-serif text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.05] tracking-tight text-balance">
            Tudo o que você precisa.
            <br />
            <span className="text-ink-soft italic">Nada do que te dá ansiedade.</span>
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {/* Card escuro — imóveis organizados */}
          <Block
            className="bg-foreground text-background p-6 md:col-span-1 md:row-span-2"
            delay={0}
          >
            <div className="flex h-full flex-col">
              <div className="mb-5 grid grid-cols-3 gap-3 border-b border-white/10 pb-4 text-[11px] uppercase tracking-wider text-background/60">
                <div>
                  <div className="text-background/40">Cliente</div>
                  <div className="mt-1 text-sm text-background normal-case tracking-normal">
                    M. Silva
                  </div>
                </div>
                <div>
                  <div className="text-background/40">Imóveis</div>
                  <div className="mt-1 text-sm text-background normal-case tracking-normal">3</div>
                </div>
                <div>
                  <div className="text-background/40">Etapas</div>
                  <div className="mt-1 text-sm text-background normal-case tracking-normal">12</div>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { label: "Apto Vila Madalena", active: false },
                  { label: "Casa Granja Viana", active: true },
                  { label: "Sala comercial Itaim", active: false },
                ].map((r, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.15 + i * 0.08 }}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-4 ${
                      r.active
                        ? "bg-accent text-accent-foreground"
                        : "bg-white text-foreground"
                    }`}
                  >
                    <span className="flex-1 text-lg font-medium leading-tight">{r.label}</span>
                    <span
                      className={`grid h-9 w-9 place-items-center rounded-full ${
                        r.active ? "bg-white text-foreground" : "bg-accent text-accent-foreground"
                      }`}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </motion.div>
                ))}
              </div>

              <div className="mt-auto pt-8">
                <h3 className="font-serif text-3xl leading-tight">
                  Espaços organizados por imóvel
                </h3>
                <p className="mt-2 text-sm text-background/70">
                  Cada imóvel ganha seu próprio espaço — documentos, etapas e responsáveis
                  num só lugar.
                </p>
              </div>
            </div>
          </Block>

          {/* Stat — 3,2× mais rápido */}
          <Block className="bg-surface-elevated p-6 md:col-span-1" delay={0.05}>
            <div className="flex h-full flex-col">
              <p className="text-sm text-ink-soft">Mais rápido que o processo tradicional</p>
              <div className="mt-3 font-serif text-7xl text-accent leading-none tabular-nums">
                <NumberTicker value={3.2} suffix="×" decimals={1} separator="," duration={1600} />
              </div>
              <p className="mt-auto pt-6 text-xs text-ink-soft">
                Média de tempo até entrega da matrícula regularizada.
              </p>
            </div>
          </Block>

          {/* IA de orientação */}
          <Block className="bg-surface-elevated p-6 md:col-span-1" delay={0.1}>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs text-accent">
              <Sparkles className="h-3 w-3" /> IA de orientação
            </div>
            <p className="text-sm leading-relaxed">
              <span className="text-ink-soft">
                "Sua certidão de matrícula está com mais de 30 dias. Para a próxima etapa,
                precisamos de uma atualizada — posso solicitar agora?"
              </span>
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="rounded-full bg-foreground px-4 py-1.5 text-xs text-background"
              >
                Solicitar
              </button>
              <button
                type="button"
                className="rounded-full bg-surface px-4 py-1.5 text-xs"
              >
                Depois
              </button>
            </div>
          </Block>

          {/* Checklist inteligente */}
          <Block className="bg-surface-elevated p-6 md:col-span-1" delay={0.15}>
            <div className="mb-4 flex items-center gap-2 text-xs text-ink-soft">
              <FileCheck2 className="h-3.5 w-3.5" /> Checklist inteligente
            </div>
            <ul className="space-y-2.5 text-sm">
              {[
                { l: "RG e CPF do proprietário", d: true },
                { l: "Matrícula atualizada", d: true },
                { l: "Habite-se", d: false },
                { l: "Certidão negativa de débitos", d: false },
              ].map((it, i) => (
                <motion.li
                  key={i}
                  className="flex items-center gap-2.5"
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.2 + i * 0.07 }}
                >
                  <span
                    className={`grid h-4 w-4 place-items-center rounded-[5px] ${
                      it.d ? "bg-accent text-accent-foreground" : "border border-border"
                    }`}
                  >
                    {it.d && <span className="text-[9px]">✓</span>}
                  </span>
                  <span className={it.d ? "text-ink-soft line-through" : ""}>{it.l}</span>
                </motion.li>
              ))}
            </ul>
          </Block>

          {/* SLA / prazo estimado */}
          <Block className="bg-surface-elevated p-6 md:col-span-1" delay={0.2}>
            <div className="mb-4 flex items-center gap-2 text-xs text-ink-soft">
              <Clock className="h-3.5 w-3.5" /> Prazo estimado
            </div>
            <div ref={progressRef} className="font-serif text-5xl leading-none">
              <NumberTicker value={42} suffix=" dias" duration={1200} />
            </div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface">
              <motion.div
                initial={{ width: 0 }}
                animate={progressInView ? { width: "68%" } : { width: 0 }}
                transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                className="h-full rounded-full bg-accent"
              />
            </div>
            <p className="mt-3 text-xs text-ink-soft">68% concluído · sem atrasos</p>
          </Block>
        </div>
      </div>
    </section>
  );
}
