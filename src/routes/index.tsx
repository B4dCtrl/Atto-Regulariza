import { createFileRoute } from "@tanstack/react-router";
import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { LogoBar } from "@/components/landing/LogoBar";
import { BlurHeadline } from "@/components/landing/BlurHeadline";
import { BentoFeatures } from "@/components/landing/BentoFeatures";
import { Environments } from "@/components/landing/Environments";

import { HowItWorks } from "@/components/landing/HowItWorks";
import { Audiences } from "@/components/landing/Audiences";
import { Testimonial } from "@/components/landing/Testimonial";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Regulariza — Um portal para cada imóvel, cliente e processo" },
      {
        name: "description",
        content:
          "Plataforma brasileira que transforma o caos da regularização imobiliária em um fluxo claro, moderno e acompanhável. Cliente, profissional e empresa, conectados.",
      },
      { property: "og:title", content: "Regulariza — Regularização imobiliária, finalmente clara" },
      {
        property: "og:description",
        content:
          "Acompanhe cada etapa da regularização do seu imóvel em tempo real. Sem juridiquês, sem planilhas, sem ansiedade.",
      },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&display=swap",
      },
    ],
  }),
  component: Index,
});

// Fundo "seção por trás" — radial ancorado no topo/centro (atrás da logo):
// claro atrás da logo → escurece forte para os cantos/extremos.
// Raio horizontal curto (65%) para a transição acontecer DENTRO da faixa do topo.
const BG_GRADIENT =
  "radial-gradient(65% 400% at 50% 0%, #35788d 0%, #185f77 38%, #0d4a5e 66%, #082832 100%)";

function Index() {
  return (
    <div className="min-h-screen" style={{ background: BG_GRADIENT }}>
      {/* pt maior: espaço para a logo ficar sozinha no topo antes de virar menu */}
      <div className="mx-auto max-w-[1900px] px-0 pb-1 pt-28 sm:px-0 sm:pb-2 sm:pt-36">
        {/* Painel do site "flutuando" sobre o fundo, com sombra */}
        <div className="overflow-hidden rounded-[1.5rem] bg-background text-foreground shadow-[0_50px_140px_-30px_rgba(6,26,28,0.75)] sm:rounded-[2.5rem]">
          <Nav />
          <main className="w-full overflow-x-hidden">
            <Hero />
            <HowItWorks />
            <BlurHeadline />
            <BentoFeatures />

            <Environments />
            <Audiences />
            <Testimonial />
            <FinalCTA />
            <LogoBar />
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
}
