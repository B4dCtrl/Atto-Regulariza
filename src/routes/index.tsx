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

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main className="w-full overflow-x-hidden">
        <Hero />
        <LogoBar />
        <BlurHeadline />
        <BentoFeatures />

        <Environments />
        <HowItWorks />
        <Audiences />
        <Testimonial />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
