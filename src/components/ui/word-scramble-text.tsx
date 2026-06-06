"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

const SCRAMBLE_CHARS = "abcdefghijklmnopqrstuvwxyz";
const randChar = () =>
  SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
const randStr = (n: number) =>
  Array.from({ length: n }, randChar).join("");

interface WordScrambleTextProps {
  /** Palavras na ordem em que aparecem; a ÚLTIMA é o estado final. */
  words: string[];
  className?: string;
  /** ms por frame de embaralhamento. */
  frame?: number;
  /** ms embaralhando até travar cada palavra. */
  scrambleTime?: number;
  /** ms segurando a palavra revelada antes da próxima. */
  hold?: number;
  /** ms de espera antes de iniciar. */
  startDelay?: number;
  /** Repetir em loop infinito. Default: para na última palavra. */
  loop?: boolean;
  /** Anima só quando entra na viewport (uma vez). */
  whenInView?: boolean;
}

/**
 * Escreve palavras de mesmo significado em sequência, com leve scramble de
 * letras entre elas (ex.: dias → meses → anos). Reserva a largura da maior
 * palavra para o texto seguinte (o ".") não "pular".
 */
export function WordScrambleText({
  words,
  className = "",
  frame = 45,
  scrambleTime = 380,
  hold = 850,
  startDelay = 600,
  loop = false,
  whenInView = false,
}: WordScrambleTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const shouldStart = whenInView ? inView : true;

  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), "");
  const finalWord = words[words.length - 1] ?? "";
  const [display, setDisplay] = useState(finalWord);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!shouldStart || startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const schedule = (fn: () => void, ms: number) => {
      timers.push(setTimeout(fn, ms));
    };

    const animateWord = (idx: number) => {
      if (cancelled) return;
      const target = words[idx];
      const totalFrames = Math.max(1, Math.round(scrambleTime / frame));
      let f = 0;

      const tick = () => {
        if (cancelled) return;
        if (f < totalFrames) {
          // trava da esquerda p/ direita enquanto embaralha o resto
          const locked = Math.floor((f / totalFrames) * target.length);
          setDisplay(target.slice(0, locked) + randStr(target.length - locked));
          f += 1;
          schedule(tick, frame);
        } else {
          setDisplay(target);
          const isLast = idx === words.length - 1;
          if (isLast && !loop) return;
          schedule(() => animateWord((idx + 1) % words.length), hold);
        }
      };

      tick();
    };

    schedule(() => animateWord(0), startDelay);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [shouldStart, words, frame, scrambleTime, hold, startDelay, loop]);

  return (
    <span ref={ref} className={`relative inline-block ${className}`}>
      {/* Reserva de largura (maior palavra) — evita o "." pular */}
      <span aria-hidden className="invisible whitespace-pre">
        {longest}
      </span>
      <span className="absolute inset-0 whitespace-pre">{display}</span>
    </span>
  );
}
