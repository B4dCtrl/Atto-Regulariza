import { useRef, useState, useCallback } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, MessageCircle, ShieldCheck, Clock, Star } from "lucide-react";
import { WHATSAPP } from "@/lib/brand";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { HeroVideoPanel } from "@/components/landing/HeroVideoPanel";

gsap.registerPlugin(ScrollTrigger);

// Helper to ensure values stay within range
function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

const proofs = [
  { icon: ShieldCheck, label: "Cartórios e prefeituras integrados" },
  { icon: Clock, label: "Até 3,2× mais rápido" },
  { icon: Star, label: "4,9/5 com proprietários" },
];

export function PremiumHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoWrapRef = useRef<HTMLDivElement>(null);
  const durationRef = useRef(0);
  const [videoSrc, setVideoSrc] = useState("/flutuando-reg.mp4");

  const handleVideoError = useCallback(() => {
    setVideoSrc("https://videos.pexels.com/video-files/7578602/7578602-uhd_2560_1440_25fps.mp4");
  }, []);

  useGSAP(
    () => {
      const section = sectionRef.current;
      const video = videoRef.current;
      if (!section || !video) return;

      // Initialize video duration
      const onMeta = () => {
        durationRef.current = video.duration || 0;
      };
      if (video.readyState >= 1) onMeta();
      video.addEventListener("loadedmetadata", onMeta);

      // Main Scroll Animation
      // end: "+=300vh" - Higher value = slower scroll/scrub
      const st = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "+=300vh", 
        pin: true,
        scrub: 1.5, // Higher value = smoother "catch up" animation
        anticipatePin: 1,
        onUpdate: (self) => {
          const p = self.progress;

          // 1. Video scrub
          const d = durationRef.current;
          if (d && Number.isFinite(d)) {
            const t = clamp(p * d, 0, d - 0.05);
            if (Math.abs(video.currentTime - t) > 0.05) {
              video.currentTime = t;
            }
          }

          // 2. Subtle 3D rotation to the video container for depth
          const rY = 6 - p * 10;
          const rX = 2 - p * 5;
          const s = 1 + p * 0.02;
          gsap.set(videoWrapRef.current, {
            rotateY: rY,
            rotateX: rX,
            scale: s,
          });
        },
      });

      return () => {
        video.removeEventListener("loadedmetadata", onMeta);
        st.kill();
      };
    },
    { scope: sectionRef },
  );

  return (
    <section
      ref={sectionRef}
      className="relative w-full overflow-hidden bg-background"
    >
      <ContainerScroll
        titleComponent={
          <>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-ink-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Disponível em 118 cidades
            </div>

            <h1 className="font-serif text-left text-[clamp(2.5rem,5vw,4.5rem)] leading-[1.05] tracking-tight text-foreground text-balance">
              Regularize seu imóvel
              <br />
              <em className="italic text-ink-soft">em semanas, não em anos.</em>
            </h1>

            <p className="mt-6 max-w-md text-left text-balance text-base leading-relaxed text-ink-soft sm:text-lg">
              A plataforma que cuida da regularização do começo ao fim — 
              com especialistas dedicados, prazos claros e tudo 
              acompanhável em tempo real.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to="/precos"
                className="group inline-flex items-center gap-2 rounded-full bg-foreground py-3 pl-6 pr-2 text-base text-background shadow-lg transition-all hover:scale-[1.02]"
              >
                Começar agora
                <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-white transition-transform group-hover:rotate-12">
                  <ArrowUpRight className="h-5 w-5" />
                </span>
              </Link>
              <a
                href={WHATSAPP.avaliacaoGratuita}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-6 py-3 text-base text-foreground transition-all hover:bg-surface"
              >
                <MessageCircle className="h-4 w-4" />
                Avaliação gratuita
              </a>
            </div>

            <div className="mt-12 flex flex-wrap gap-x-8 gap-y-4 border-t border-border pt-8">
              {proofs.map((c) => (
                <div key={c.label} className="flex items-center gap-2 text-sm text-ink-soft">
                  <c.icon className="h-4 w-4 text-accent" />
                  {c.label}
                </div>
              ))}
            </div>
          </>
        }
      >
        <HeroVideoPanel sectionRef={sectionRef} />
      </ContainerScroll>
    </section>
  );
}
