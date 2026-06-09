import { BlurReveal } from "./BlurReveal";
import { User } from "lucide-react";

/**
 * Environments — Exibe apenas a Área do Cliente.
 * Área do Profissional e Central da Empresa foram movidas para /profissionais.
 */
export function Environments() {
  return (
    <section className="px-6 pb-32">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-ink-soft">
            Área do Cliente
          </div>
          <h2 className="font-serif text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.05] tracking-tight text-balance">
            Seu imóvel,
            <br />
            <span className="italic text-ink-soft">acompanhado de perto.</span>
          </h2>
        </div>

        <BlurReveal className="grid items-center gap-10 md:grid-cols-2">
          {/* Texto */}
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs text-accent">
              <User className="h-3 w-3" /> Área do Cliente
            </div>
            <h3 className="font-serif text-4xl leading-tight tracking-tight">
              Tranquilidade em forma de painel.
            </h3>
            <p className="mt-4 max-w-md text-base leading-relaxed text-ink-soft">
              O cliente vê seu imóvel, sua timeline e seus próximos passos —
              sem termos técnicos, sem ansiedade.
            </p>
            <ul className="mt-6 space-y-2">
              {[
                "Timeline visual da regularização",
                "Central de documentos",
                "IA que explica em linguagem humana",
              ].map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-1.5 h-1 w-4 rounded-full bg-accent" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Mockup */}
          <div className="rounded-[28px] border border-border bg-surface/60 p-5 shadow-[0_30px_80px_-40px_oklch(0.16_0.01_60_/_0.4)]">
            <div className="space-y-3">
              <div className="rounded-2xl bg-surface-elevated p-4 ring-1 ring-border">
                <div className="text-xs text-ink-soft">Status atual</div>
                <div className="mt-1 font-serif text-2xl">Em prefeitura</div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface">
                  <div className="h-full w-[55%] rounded-full bg-accent" />
                </div>
                <div className="mt-2 text-xs text-ink-soft">
                  3 de 6 etapas · próxima em ~7 dias
                </div>
              </div>
              <div className="rounded-2xl bg-surface-elevated p-4 ring-1 ring-border">
                <div className="text-xs text-ink-soft">Responsável agora</div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-background text-sm">
                    CR
                  </div>
                  <div>
                    <div className="text-sm font-medium">Carla Rocha</div>
                    <div className="text-xs text-ink-soft">Arquiteta · CAU 12345</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </BlurReveal>
      </div>
    </section>
  );
}
