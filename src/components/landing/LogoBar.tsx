import { BookOpen, Compass, Cpu, Gavel, ShieldCheck, Landmark } from "lucide-react";

const logos = [
  { name: "RI Digital", full: "Registro de Imóveis Digital", Icon: BookOpen, color: "#1a4a8a" },
  { name: "CAU/BR", full: "Conselho de Arquitetura e Urbanismo", Icon: Compass, color: "#005c4b" },
  { name: "CREA", full: "Conselho de Engenharia", Icon: Cpu, color: "#b03800" },
  { name: "OAB", full: "Ordem dos Advogados do Brasil", Icon: Gavel, color: "#1a3a6a" },
  { name: "Receita Federal", full: "Receita Federal do Brasil", Icon: ShieldCheck, color: "#1a5c2a" },
  { name: "Prefeitura Digital", full: "Serviços Municipais Online", Icon: Landmark, color: "#5a1a4a" },
];

export function LogoBar() {
  return (
    <section className="bg-background py-12">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="mb-8 flex flex-col items-center gap-4 md:flex-row md:gap-6">
          <div className="text-center md:text-left">
            <p className="text-sm text-ink-soft">Integração com</p>
            <h2 className="font-serif text-2xl tracking-tight">Diversos parceiros</h2>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-3 lg:gap-4">
            {logos.map((logo) => (
              <div
                key={logo.name}
                className="group relative rounded-2xl border border-border/50 bg-surface/30 px-4 py-3 backdrop-blur-sm transition-all hover:border-border hover:bg-surface/60 lg:px-5 lg:py-4"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors lg:h-10 lg:w-10"
                    style={{ backgroundColor: `${logo.color}20` }}
                  >
                    <logo.Icon
                      className="h-4 w-4 lg:h-5 lg:w-5"
                      style={{ color: logo.color }}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-foreground lg:text-sm">
                      {logo.name}
                    </div>
                    <div className="hidden text-[10px] text-ink-soft truncate group-hover:line-clamp-2 sm:block">
                      {logo.full}
                    </div>
                  </div>
                </div>

                <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded-md bg-foreground px-2.5 py-1 text-[11px] text-background opacity-0 transition-opacity group-hover:opacity-100">
                  {logo.full}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>
    </section>
  );
}
