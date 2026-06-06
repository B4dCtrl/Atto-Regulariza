import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { HERO_VIDEO_FALLBACK, HERO_VIDEO_LOCAL } from "@/lib/brand";

type HeroVideoPanelProps = {
  sectionRef: React.RefObject<HTMLElement | null>;
};

export function HeroVideoPanel({ sectionRef }: HeroVideoPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const durationRef = useRef(0);
  const [src, setSrc] = useState(HERO_VIDEO_LOCAL);
  const [ready, setReady] = useState(false);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const rotateY = useTransform(scrollYProgress, [0, 1], [6, -4]);
  const rotateX = useTransform(scrollYProgress, [0, 1], [2, -3]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1, 1.02, 0.98]);

  const onVideoError = useCallback(() => {
    if (src !== HERO_VIDEO_FALLBACK) setSrc(HERO_VIDEO_FALLBACK);
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onMeta = () => {
      durationRef.current = video.duration || 0;
      setReady(true);
    };

    video.addEventListener("loadedmetadata", onMeta);
    if (video.readyState >= 1) onMeta();
    return () => video.removeEventListener("loadedmetadata", onMeta);
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !ready) return;

    return scrollYProgress.on("change", (v) => {
      const d = durationRef.current;
      if (!d || !Number.isFinite(d)) return;
      const t = Math.min(Math.max(v * d, 0), Math.max(d - 0.05, 0));
      if (Math.abs(video.currentTime - t) > 0.06) video.currentTime = t;
    });
  }, [scrollYProgress, ready]);

  return (
    <div className="relative h-full min-h-[inherit] w-full overflow-hidden bg-ink">
      <motion.div
        className="absolute inset-0 origin-center will-change-transform"
        style={{
          rotateX,
          rotateY,
          scale,
          transformPerspective: 1200,
        }}
      >
        <video
          ref={videoRef}
          key={src}
          className="h-full w-full object-cover"
          src={src}
          muted
          playsInline
          autoPlay
          loop
          preload="auto"
          onError={onVideoError}
          aria-label="Demonstração da plataforma Regulariza"
        />
      </motion.div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-background/25 lg:to-background/40"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/30 via-transparent to-background/10 lg:hidden"
      />
    </div>
  );
}
