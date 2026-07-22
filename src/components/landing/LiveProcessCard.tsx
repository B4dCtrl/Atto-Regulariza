import { Upload, Search, Clock, TrendingUp, Layers, MessageSquare } from "lucide-react";

const STAGES = ["Cadastro", "Análise", "Profissional", "Tramitação", "Entrega"];
const ACTIVE_STAGE = 2; // "Profissional" — processo já com especialista, andando

/**
 * Mock "vivo" do painel — mesmos cards do back office/painel do cliente,
 * mostrando um processo em andamento com profissional já designado.
 * Usado como visual à direita da Hero, no lugar da esfera de partículas.
 */
export function LiveProcessCard() {
  return (
    <div className="w-full max-w-[440px] rounded-[1.5rem] bg-background/95 p-3 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] backdrop-blur-sm sm:p-4">
      {/* Card topo: imóvel */}
      <div className="rounded-2xl bg-surface/70 p-4 ring-1 ring-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-foreground text-background">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-ink-soft">Imóvel em regularização</div>
              <div className="text-sm font-medium">Gustavo Marques — outro</div>
              <div className="text-[11px] text-ink-soft">Curitiba · PR</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-[10px] text-accent">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            Em andamento
          </span>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface">
          <div className="h-full w-[45%] rounded-full bg-accent" />
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-background/70 p-3 text-[11px] leading-relaxed text-ink-soft">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-foreground text-[10px] font-medium text-background">
            AL
          </div>
          <div>
            <span className="font-medium text-foreground">Ana Lima</span> está com seu caso —
            protocolou a documentação e aguarda retorno da prefeitura.
          </div>
        </div>
      </div>

      {/* Card etapas */}
      <div className="mt-3 rounded-2xl bg-surface/70 p-4 ring-1 ring-border">
        <div className="text-[10px] uppercase tracking-widest text-ink-soft">Etapas</div>
        <div className="mb-4 font-serif text-lg">Onde sua regularização está</div>
        <div className="flex items-start justify-between">
          {STAGES.map((label, i) => {
            const done = i < ACTIVE_STAGE;
            const active = i === ACTIVE_STAGE;
            return (
              <div key={label} className="flex flex-1 flex-col items-center gap-1.5 text-center">
                <div
                  className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${
                    active ? "bg-accent text-white" : done ? "bg-foreground text-background" : "bg-background text-ink-soft ring-1 ring-border"
                  }`}
                >
                  {i + 1}
                </div>
                <div className="text-[10px] font-medium text-foreground">{label}</div>
                <div className="text-[9px] text-ink-soft">{done ? "Concluído" : active ? "Em andamento" : "Aguardando"}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat + stats */}
      <div className="mt-3 grid gap-3 sm:grid-cols-[1.3fr_1fr]">
        <div className="rounded-2xl bg-surface/70 p-4 ring-1 ring-border">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-ink-soft">
            <MessageSquare className="h-3 w-3" /> Mensagens
          </div>
          <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-background/80 px-3 py-2 text-[11px]">
            Protocolei na prefeitura hoje. Retorno estimado até sexta.
          </div>
          <div className="mt-1.5 flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3 py-2 text-[11px] text-accent-foreground">
              Perfeito, obrigado! ✓
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Clock, v: "12", l: "Dias" },
              { icon: TrendingUp, v: "45%", l: "Concluído" },
              { icon: Layers, v: "3", l: "Etapa" },
            ].map((s) => (
              <div key={s.l} className="rounded-xl bg-surface/70 p-2 text-center ring-1 ring-border">
                <s.icon className="mx-auto h-3 w-3 text-ink-soft" />
                <div className="mt-0.5 text-sm font-medium">{s.v}</div>
                <div className="text-[9px] text-ink-soft">{s.l}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-1 items-center gap-2 rounded-xl bg-surface/70 p-3 ring-1 ring-border">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
              <Upload className="h-3.5 w-3.5" />
            </div>
            <div className="text-[10px] leading-tight text-ink-soft">
              <span className="font-medium text-foreground">3 documentos</span> enviados e aprovados
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-surface/70 px-4 py-3 ring-1 ring-border">
        <div className="grid h-7 w-7 place-items-center rounded-full bg-accent/10 text-accent">
          <Search className="h-3.5 w-3.5" />
        </div>
        <div>
          <div className="text-xs font-medium">Em tramitação na prefeitura</div>
          <div className="text-[10px] text-ink-soft">Atualizado agora</div>
        </div>
      </div>
    </div>
  );
}
