import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  ArrowRight, Building2, FileCheck2, Check,
  FileText, Stamp, KeyRound,
} from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

export function BlurHeadline() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <div className="mx-4 my-12 rounded-3xl sm:mx-8 sm:my-16">
      <div ref={ref} id="produto" className="px-6 pb-16 pt-16 sm:pb-20 sm:pt-20">

        {/* ── Headline ── */}
        <div className="mx-auto max-w-5xl text-center">

          <h2 className="font-serif text-[clamp(2rem,5.5vw,4.75rem)] leading-[1.05] tracking-tight text-balance">
            <motion.span
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
              className="inline"
            >
              Do caos dos cartórios
            </motion.span>{" "}
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
              className="inline-block text-ink-soft"
            >
              a um fluxo que você acompanha em tempo real.
            </motion.span>
          </h2>
        </div>

        {/* ── Cards (IntroCards) ── */}
        <div className="mx-auto mt-16 max-w-6xl sm:mt-20">
          <div className="grid gap-6 md:grid-cols-3">

            {/* Card 1 — Imóvel */}
            <div className="flex flex-col">
              <div className="rounded-3xl bg-surface-elevated p-6 ring-1 ring-border/70 shadow-[0_30px_60px_-30px_oklch(0.16_0.01_60_/_0.25)]">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-foreground text-background">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Apto 142 — Vila Madalena</p>
                      <p className="text-xs text-ink-soft">São Paulo · SP</p>
                    </div>
                  </div>
                  <span className="text-xs text-ink-soft">Pendências</span>
                </div>
                <div className="mt-4 space-y-3">
                  {[
                    { label: "Análise de matrícula", n: 3 },
                    { label: "Documentos do imóvel", n: 5 },
                    { label: "Tributos municipais", n: 2 },
                  ].map((r, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2.5">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-foreground">
                        <FileCheck2 className="h-4 w-4" />
                      </span>
                      <span className="flex-1 text-sm">{r.label}</span>
                      <span className="text-xs text-ink-soft">({r.n})</span>
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-foreground text-background">
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <h3 className="mt-6 font-serif text-3xl leading-tight">Tudo num só lugar.</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Documentos, prazos e responsáveis do seu imóvel — sempre à mão.
              </p>
            </div>

            {/* Card 2 — Timeline */}
            <div className="flex flex-col">
              <div className="rounded-3xl bg-surface-elevated p-6 ring-1 ring-border/70 shadow-[0_30px_60px_-30px_oklch(0.16_0.01_60_/_0.25)]">
                <div className="space-y-3">
                  {[
                    { icon: Check,    label: "Análise inicial concluída",  time: "há 3 dias", done: true  },
                    { icon: FileText, label: "Documentação enviada",        time: "há 1 dia",  done: true  },
                    { icon: Stamp,    label: "Em prefeitura",               time: "agora",     active: true },
                    { icon: KeyRound, label: "Cartório · entrega",          time: "estimado 12d"           },
                  ].map((s, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${s.active ? "bg-foreground text-background" : "bg-surface"}`}
                    >
                      <span className={`grid h-8 w-8 place-items-center rounded-lg ${s.active ? "bg-accent text-accent-foreground" : s.done ? "bg-foreground text-background" : "bg-border text-ink-soft"}`}>
                        <s.icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1 text-sm">{s.label}</span>
                      <span className={`text-xs ${s.active ? "text-background/70" : "text-ink-soft"}`}>
                        {s.time}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-xs text-ink-soft">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                  Atualizado agora
                </div>
              </div>
              <h3 className="mt-6 font-serif text-3xl leading-tight">Você sempre sabe onde está.</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Cada etapa visível em tempo real, com prazo e responsável.
              </p>
            </div>

            {/* Card 3 — Chat */}
            <div className="flex flex-col">
              <div className="rounded-3xl bg-surface-elevated p-6 ring-1 ring-border/70 shadow-[0_30px_60px_-30px_oklch(0.16_0.01_60_/_0.25)]">
                <div className="flex flex-col gap-3">
                  <div className="max-w-[80%] self-start rounded-2xl rounded-bl-md bg-surface px-4 py-2.5 text-sm">
                    Oi, Marina! Acabei de protocolar na prefeitura.{" "}
                    <br />
                    Devo ter retorno até sexta.
                    <div className="mt-1 text-[10px] text-ink-soft">14:32</div>
                  </div>
                  <div className="max-w-[80%] self-end rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm text-accent-foreground">
                    Perfeito, obrigada! Posso acompanhar pelo app?
                    <div className="mt-1 text-[10px] text-accent-foreground/70">14:34</div>
                  </div>
                  <div className="self-end rounded-2xl bg-surface px-3 py-2 text-xs text-ink-soft">
                    <span className="mr-1">✓</span> Etapa atualizada · Em prefeitura
                  </div>
                </div>
              </div>
              <h3 className="mt-6 font-serif text-3xl leading-tight">Um especialista só seu.</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Resposta humana no chat, sem juridiquês e sem espera.
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
