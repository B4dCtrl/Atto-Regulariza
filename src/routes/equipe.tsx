import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe — Ato Regulariza" },
      { name: "description", content: "Conheça a equipe por trás da Ato Regulariza." },
    ],
  }),
  component: EquipePage,
});

function EquipePage() {
  /* Carrega o script do LinkedIn uma vez */
  useEffect(() => {
    const existing = document.querySelector('script[src*="linkedin.com/badges"]');
    if (!existing) {
      const s = document.createElement("script");
      s.src = "https://platform.linkedin.com/badges/js/profile.js";
      s.async = true;
      s.defer = true;
      document.body.appendChild(s);
    } else {
      /* Se o script já existe, re-renderiza os badges */
      (window as unknown as Record<string, () => void>).LI?.init?.();
    }
  }, []);

  return (
    <div className="min-h-screen bg-surface/40 text-foreground">
      {/* Nav simples */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-4 px-6">
          <Link to="/" className="flex items-center gap-1.5">
            <img src="/logo-ato.png" alt="Ato Regulariza" className="h-7 w-7 rounded-md object-contain" />
            <span className="font-arsenica text-xl leading-none text-accent">ato</span>
          </Link>
          <div className="h-5 w-px bg-border" />
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm text-ink-soft hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-20">
        {/* Título */}
        <div className="mb-16 text-center">
          <div className="mb-3 text-[11px] uppercase tracking-widest text-ink-soft">As pessoas</div>
          <h1 className="font-serif text-5xl tracking-tight">Nossa equipe</h1>
          <p className="mt-4 text-base text-ink-soft max-w-md mx-auto leading-relaxed">
            Profissionais que acreditam que regularizar imóvel pode ser simples, transparente e humano.
          </p>
        </div>

        {/* Cards */}
        <div className="grid gap-6 sm:grid-cols-2">

          {/* Gabriel */}
          <div className="rounded-3xl bg-background ring-1 ring-border p-8 flex flex-col items-start gap-6">
            <div className="w-full overflow-hidden rounded-2xl">
              <div
                className="badge-base LI-profile-badge"
                data-locale="pt_BR"
                data-size="large"
                data-theme="light"
                data-type="HORIZONTAL"
                data-vanity="gabrielzanchet"
                data-version="v1"
              >
                <a
                  className="badge-base__link LI-simple-link"
                  href="https://br.linkedin.com/in/gabrielzanchet?trk=profile-badge"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Gabriel Zanchet
                </a>
              </div>
            </div>
            <div>
              <div className="text-xs text-ink-soft uppercase tracking-widest mb-1">Fundador</div>
              <p className="text-sm text-ink-soft leading-relaxed">
                Arquiteto e urbanista, especialista em regularização imobiliária. Criou a Ato Regulariza para tornar o processo acessível a qualquer proprietário.
              </p>
            </div>
          </div>

          {/* Taís */}
          <div className="rounded-3xl bg-background ring-1 ring-border p-8 flex flex-col items-start gap-6">
            <div className="w-full overflow-hidden rounded-2xl">
              <div
                className="badge-base LI-profile-badge"
                data-locale="pt_BR"
                data-size="large"
                data-theme="light"
                data-type="HORIZONTAL"
                data-vanity="tais-pilato"
                data-version="v1"
              >
                <a
                  className="badge-base__link LI-simple-link"
                  href="https://br.linkedin.com/in/tais-pilato?trk=profile-badge"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Taís Carolina Pilato
                </a>
              </div>
            </div>
            <div>
              <div className="text-xs text-ink-soft uppercase tracking-widest mb-1">Especialista</div>
              <p className="text-sm text-ink-soft leading-relaxed">
                Profissional com experiência em processos de regularização fundiária e documentação imobiliária, garantindo precisão em cada etapa.
              </p>
            </div>
          </div>

        </div>

        {/* Rodapé da página */}
        <div className="mt-20 text-center">
          <p className="text-sm text-ink-soft">
            Quer fazer parte?{" "}
            <a href="mailto:contato@atoregulariza.com" className="text-accent hover:underline">
              Entre em contato
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
