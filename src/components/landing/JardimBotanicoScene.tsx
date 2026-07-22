import { useEffect, useRef } from "react";
import { gsap } from "gsap";

/*
 * Cena animada da Hero — storyboard "hero nova" (Jardim Botânico de Curitiba).
 * Toca em LOOP: segura o quadro final (casa ATO + "Um ato. Regulariza!")
 * por alguns segundos e recomeça.
 *
 * viewBox 1440×810 (proporção do PDF). REGRA DE LAYOUT: todos os elementos da
 * cena vivem dentro do "quadro" à direita — x ∈ [575, 1420] — para nunca
 * invadirem o texto da esquerda. A única exceção é a linha laranja de
 * abertura, que por design nasce na logo "ato" (mapeada via getScreenCTM).
 *
 * Narrativa: linha do ato → cidade SURGE → anéis → tipos de regularização
 * (surgem e somem um a um) → docs (esqueletos) → análise 0–100% → pendências
 * (vermelho ❗) → Rebbeca surge, linha suave conecta ao card → pendências
 * resolvidas ✓ uma a uma → portfólio de cidades → casa ATO + "Regulariza.".
 */

const TEAL = "#153A40";
const ORANGE = "#E86030";
const RED = "#D00909";
const GREEN = "#2F8F57";
const CARD = "#FBF6EE";
const INK = "#2C2A22";

/* Tudo vive à direita, longe do texto. A cidade surge centrada no MESMO
 * ponto onde a casinha ATO aparece no final (x=985) — continuidade visual. */
const C = { x: 985, y: 415 }; // centro da cidade
const CITY = { x: 835, y: 324, w: 300, h: 182 };

const TYPES = [
  { label: "Unificação", cx: 815, cy: 282 },
  { label: "Retificação", cx: 955, cy: 140 },
  { label: "Habite-se", cx: 1230, cy: 242 },
  { label: "Subdivisão", cx: 1300, cy: 372 },
  { label: "Abrir matrícula", cx: 1200, cy: 592 },
  { label: "Reurb", cx: 800, cy: 643 },
];

const TASKS = ["Diligência detectada", "Avisar profissional", "Preparar documentos"];
// PRO termina em y=208 (150+58); gap real de 30 até a 1ª pendência, e 16
// entre elas — respiro consistente, sem sombras se fundindo
const TASK = { x: 1113, y: 238, w: 236, h: 40, gap: 16 };

// documentos flutuando — distribuídos em volta da cidade, SEM invadir a
// zona dos cards (profissional + pendências, x≈1095–1367 / y≈150–364)
const SKELS = [
  { x: 705, y: 150, w: 150, h: 40 },
  { x: 662, y: 300, w: 66, h: 44 },
  { x: 700, y: 472, w: 158, h: 22 },
  { x: 878, y: 642, w: 150, h: 40 },
  { x: 1112, y: 476, w: 120, h: 86 },
  { x: 1180, y: 612, w: 156, h: 18 },
  { x: 772, y: 104, w: 100, h: 16 },
];

const PORT = [
  { city: "curitiba", label: "Curitiba", cx: 1025, cy: 166, r: 82 },
  { city: "saopaulo", label: "São Paulo", cx: 805, cy: 296, r: 82 },
  { city: "rio", label: "Rio de Janeiro", cx: 1230, cy: 296, r: 82 },
  { city: "brasilia", label: "Brasília", cx: 910, cy: 522, r: 82 },
  { city: "salvador", label: "Salvador", cx: 1165, cy: 500, r: 82 },
];

function pillWidth(label: string) {
  return Math.max(label.length * 12 + 52, 130);
}

/* Mini line-art dos pontos turísticos de cada cidade (para o portfólio). */
function CityMini({ name, cx, cy }: { name: string; cx: number; cy: number }) {
  const s = {
    fill: "none",
    stroke: TEAL,
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const g = cy + 28; // chão

  if (name === "saopaulo") {
    // Ponte Estaiada Octávio Frias
    return (
      <g {...s}>
        <line x1={cx - 50} y1={g} x2={cx + 50} y2={g} />
        <line x1={cx - 44} y1={cy + 12} x2={cx + 44} y2={cy + 12} />
        <line x1={cx + 5} y1={cy + 12} x2={cx + 5} y2={cy - 26} />
        <path d={`M${cx - 3} ${cy - 30} L${cx + 5} ${cy - 24} L${cx + 13} ${cy - 30}`} />
        <line x1={cx + 5} y1={cy - 20} x2={cx - 30} y2={cy + 12} />
        <line x1={cx + 5} y1={cy - 20} x2={cx - 12} y2={cy + 12} />
        <line x1={cx + 5} y1={cy - 20} x2={cx + 22} y2={cy + 12} />
        <line x1={cx + 5} y1={cy - 20} x2={cx + 36} y2={cy + 12} />
        <path d={`M${cx - 46} ${g} L${cx - 46} ${cy + 4} L${cx - 38} ${cy + 4} L${cx - 38} ${g}`} />
        <path d={`M${cx + 38} ${g} L${cx + 38} ${cy} L${cx + 46} ${cy} L${cx + 46} ${g}`} />
      </g>
    );
  }
  if (name === "rio") {
    // Cristo Redentor + Pão de Açúcar
    return (
      <g {...s}>
        <line x1={cx - 50} y1={g} x2={cx + 50} y2={g} />
        <path d={`M${cx + 8} ${g} C${cx + 10} ${cy + 2} ${cx + 22} ${cy + 2} ${cx + 24} ${g}`} />
        <path d={`M${cx + 24} ${g} C${cx + 27} ${cy - 14} ${cx + 45} ${cy - 14} ${cx + 48} ${g}`} />
        <line x1={cx + 16} y1={cy} x2={cx + 38} y2={cy - 8} />
        <path d={`M${cx - 48} ${g} L${cx - 30} ${cy - 12} L${cx - 12} ${g}`} />
        <line x1={cx - 30} y1={cy - 12} x2={cx - 30} y2={cy - 24} />
        <line x1={cx - 38} y1={cy - 20} x2={cx - 22} y2={cy - 20} />
        <circle cx={cx - 30} cy={cy - 27} r="2.6" />
      </g>
    );
  }
  if (name === "brasilia") {
    // Congresso Nacional (cúpula + cuia + torres)
    return (
      <g {...s}>
        <line x1={cx - 50} y1={g} x2={cx + 50} y2={g} />
        <line x1={cx - 4} y1={g} x2={cx - 4} y2={cy - 26} />
        <line x1={cx + 4} y1={g} x2={cx + 4} y2={cy - 26} />
        <path d={`M${cx - 44} ${g} Q${cx - 29} ${cy - 18} ${cx - 14} ${g}`} />
        <path d={`M${cx + 14} ${cy - 2} Q${cx + 29} ${cy + 18} ${cx + 44} ${cy - 2}`} />
      </g>
    );
  }
  if (name === "salvador") {
    // Farol da Barra
    return (
      <g {...s}>
        <line x1={cx - 50} y1={g} x2={cx + 50} y2={g} />
        <path d={`M${cx - 22} ${g} L${cx - 22} ${cy + 8} L${cx + 22} ${cy + 8} L${cx + 22} ${g}`} />
        <path d={`M${cx - 9} ${cy + 8} L${cx - 6} ${cy - 16} L${cx + 6} ${cy - 16} L${cx + 9} ${cy + 8}`} />
        <path d={`M${cx - 7} ${cy - 16} L${cx - 7} ${cy - 24} L${cx + 7} ${cy - 24} L${cx + 7} ${cy - 16}`} />
        <path d={`M${cx - 9} ${cy - 24} L${cx} ${cy - 30} L${cx + 9} ${cy - 24}`} />
        <line x1={cx - 7} y1={cy - 6} x2={cx + 7} y2={cy - 6} />
        <line x1={cx - 8} y1={cy + 1} x2={cx + 8} y2={cy + 1} />
      </g>
    );
  }
  // curitiba — Jardim Botânico (estufa) + torre
  return (
    <g {...s}>
      <line x1={cx - 50} y1={g} x2={cx + 50} y2={g} />
      <path d={`M${cx - 24} ${g} L${cx - 24} ${cy + 4} C${cx - 24} ${cy - 14} ${cx + 24} ${cy - 14} ${cx + 24} ${cy + 4} L${cx + 24} ${g}`} />
      <path d={`M${cx - 46} ${g} L${cx - 46} ${cy + 2} L${cx - 32} ${cy + 2} L${cx - 32} ${g}`} />
      <path d={`M${cx + 30} ${g} L${cx + 30} ${cy + 2} L${cx + 44} ${cy + 2} L${cx + 44} ${g}`} />
      <line x1={cx - 39} y1={cy + 2} x2={cx - 39} y2={cy - 10} />
      <circle cx={cx - 39} cy={cy - 12} r="2.4" />
      <line x1={cx - 8} y1={cy - 8} x2={cx - 8} y2={g} />
      <line x1={cx + 8} y1={cy - 8} x2={cx + 8} y2={g} />
    </g>
  );
}

export function JardimBotanicoScene() {
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const canvas = canvasRef.current;
    if (!svg || !canvas) return;

    const q = <T extends Element>(sel: string) => Array.from(svg.querySelectorAll<T>(sel));
    const q1 = <T extends Element>(sel: string) => svg.querySelector<T>(sel)!;

    const rings = q1<SVGGElement>(".jb-rings");
    const radials = q<SVGLineElement>(".jb-radial");
    const dots = q<SVGCircleElement>(".jb-dot");
    const types = q<SVGGElement>(".jb-type");
    const skels = q1<SVGGElement>(".jb-skels");
    const tasks = q<SVGGElement>(".jb-task"); // grupos internos (translate fica no pai)
    const load = q1<SVGGElement>(".jb-load");
    const loadArc = q1<SVGCircleElement>(".jb-load-arc");
    const loadSub = q1<SVGTextElement>(".jb-load-sub");
    const pct = q1<SVGTextElement>(".jb-pct");
    const pro = q1<SVGGElement>(".jb-pro");
    const ports = q<SVGGElement>(".jb-port");
    const portTitle = q1<SVGTextElement>(".jb-port-title");
    const finalG = q1<SVGGElement>(".jb-final");
    const conn = q1<SVGPathElement>(".jb-conn");
    const connDot = q1<SVGCircleElement>(".jb-conn-dot");

    // ── CIDADE EM PARTÍCULAS (estética do site atual, grão menor) ──
    // Amostra o desenho do Jardim Botânico e vira cada pixel numa partícula.
    // A timeline controla assemble (0→1 monta a cidade) e disperse (dissolve).
    const ctx2d = canvas.getContext("2d")!;
    const pState = { assemble: 0, disperse: 0 };
    type Particle = {
      tx: number; ty: number; sx: number; sy: number;
      d: number; ph: number; amp: number; r: number; a: number;
    };
    let parts: Particle[] = [];

    const img = new Image();
    img.src = "/cwb.png?v=3";
    img.onload = () => {
      const ow = img.naturalWidth;
      const oh = img.naturalHeight;
      const oc = document.createElement("canvas");
      oc.width = ow;
      oc.height = oh;
      const octx = oc.getContext("2d")!;
      octx.drawImage(img, 0, 0);
      const data = octx.getImageData(0, 0, ow, oh).data;
      const step = 4; // amostragem mais leve (perf — antes 2)
      const out: Particle[] = [];
      for (let y = 0; y < oh; y += step) {
        for (let x = 0; x < ow; x += step) {
          const alpha = data[(y * ow + x) * 4 + 3];
          if (alpha > 90 && Math.random() < 0.38) {
            const ix = CITY.x + (x / ow) * CITY.w;
            const iy = CITY.y + (y / oh) * CITY.h;
            // aplica o transform do grupo da cena (translate + scale 0.9)
            const tx = 98.5 + 0.9 * ix;
            const ty = 75.5 + 0.9 * iy;
            const ang = Math.random() * Math.PI * 2;
            const dist = 60 + Math.random() * 170;
            out.push({
              tx, ty,
              sx: tx + Math.cos(ang) * dist,
              sy: ty + Math.sin(ang) * dist + 90,
              d: Math.random() * 0.45,
              ph: Math.random() * Math.PI * 2,
              amp: 0.5 + Math.random() * 1.1,
              r: 0.8 + Math.random() * 0.9, // partícula pequena
              a: 0.45 + Math.random() * 0.5,
            });
          }
        }
      }
      parts = out;
    };

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const render = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const bw = Math.round(w * dpr);
      const bh = Math.round(h * dpr);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx2d.clearRect(0, 0, w, h);
      if (!parts.length || pState.assemble <= 0 || pState.disperse >= 1) return;
      // mapeamento viewBox 1440×810 → canvas (preserveAspectRatio slice)
      const s = Math.max(w / 1440, h / 810);
      const ox = (w - 1440 * s) / 2;
      const oy = (h - 810 * s) / 2;
      const t = performance.now() / 1000;
      const gy = -6 - 6 * Math.sin((t / 3) * Math.PI * 2); // flutuação global
      ctx2d.fillStyle = TEAL;
      const dsp = pState.disperse;
      for (const p of parts) {
        const lp = Math.min(1, Math.max(0, (pState.assemble - p.d) / (1 - p.d)));
        if (lp <= 0) continue;
        const e = easeOutCubic(lp);
        let x = p.sx + (p.tx - p.sx) * e;
        let y = p.sy + (p.ty - p.sy) * e + gy * e;
        x += Math.sin(t * 1.3 + p.ph) * p.amp;
        y += Math.cos(t * 1.1 + p.ph) * p.amp;
        if (dsp > 0) {
          x += (p.sx - p.tx) * 0.4 * dsp;
          y += (p.sy - p.ty) * 0.4 * dsp - 24 * dsp;
        }
        const al = p.a * e * (1 - dsp);
        if (al <= 0.01) continue;
        ctx2d.globalAlpha = al;
        const r = Math.max(p.r * s, 0.8);
        ctx2d.fillRect(ox + x * s - r / 2, oy + y * s - r / 2, r, r);
      }
      ctx2d.globalAlpha = 1;
    };
    gsap.ticker.add(render);

    const ctx = gsap.context(() => {
      const arcLen = 2 * Math.PI * 55;
      loadArc.style.strokeDasharray = `${arcLen}`;

      // estados iniciais
      gsap.set([rings, skels, load, pro, portTitle, finalG, ...types, ...tasks, ...ports], { opacity: 0 });
      gsap.set([...radials, ...dots], { opacity: 0 });
      gsap.set(loadArc, { strokeDashoffset: arcLen });
      gsap.set(loadSub, { opacity: 0 });
      gsap.set(".jb-check", { opacity: 0 });
      pct.textContent = "0%";

      const counter = { v: 0 };

      // ── camada de respiração: nada fica parado (estilo Mosey) ──
      const breathe = (els: Element[], amp: number, base: number) => {
        els.forEach((el, i) => {
          gsap.to(el, {
            y: `+=${i % 2 ? -amp : amp}`,
            duration: base + (i % 3) * 0.45,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
            delay: (i % 4) * 0.35,
          });
        });
      };
      breathe(types, 5, 2.4);
      breathe(tasks, 4, 2.2);
      breathe(Array.from(skels.children), 6, 3.0);
      breathe(ports, 5, 2.8);
      breathe([pro], 4, 2.6);
      breathe([finalG], 5, 3.4);
      // anéis pulsando: crescem e diminuem, um levemente atrás do outro
      gsap.fromTo(
        Array.from(rings.children),
        { scale: 0.94, svgOrigin: "985 415" },
        {
          scale: 1.06,
          svgOrigin: "985 415",
          duration: 1.9,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          stagger: 0.55,
        }
      );
      // pontilhados "andam" continuamente
      gsap.to([...radials, ...q<SVGPathElement>(".jb-march")], {
        strokeDashoffset: -18,
        duration: 1.6,
        repeat: -1,
        ease: "none",
      });

      // loop: ao terminar em "Um ato. Regulariza!", segura o quadro e volta
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 3.2, defaults: { ease: "power2.out" } });

      // ── resets de loop: devolve tudo ao estado inicial a cada volta ──
      tl.set([conn, connDot], { opacity: 0 }, 0);
      tl.set(pState, { assemble: 0, disperse: 0 }, 0);
      tl.set(portTitle, { scale: 1 }, 0);
      tl.set(".jb-task-txt", { fill: RED }, 0);
      tl.set(".jb-bang", { opacity: 1 }, 0);
      tl.set(".jb-check", { opacity: 0 }, 0);
      tl.set(loadArc, { strokeDashoffset: arcLen }, 0);
      tl.set(loadSub, { opacity: 0 }, 0);
      tl.call(() => { pct.textContent = "0%"; }, undefined, 0);
      tl.to(finalG, { opacity: 0, duration: 0.7 }, 0);

      // ── Cena 1: a cidade SURGE — milhares de partículas convergem ──
      tl.to(pState, { assemble: 1, duration: 1.7, ease: "power2.out" }, 0.4);

      // ── Cena 2: os anéis nascem em volta — protagonistas por um instante ──
      tl.fromTo(rings, { opacity: 0, scale: 0.86, svgOrigin: "985 415" }, { opacity: 1, scale: 1, duration: 0.9 }, 1.35);
      // assim que os cards começam a ocupar a cena, os anéis recuam para o
      // fundo (evita a linha do anel cruzar por trás dos cards)
      tl.to(rings, { opacity: 0.32, duration: 0.6 }, 2.3);

      // ── Cena 3: tipos SURGEM (tracejado suave → bolinha → pop 3D) e SOMEM ──
      TYPES.forEach((t, i) => {
        const at = 2.35 + i * 0.28;
        tl.fromTo(
          radials[i],
          { opacity: 0, attr: { x2: C.x, y2: C.y } },
          { opacity: 1, attr: { x2: t.cx, y2: t.cy }, duration: 0.55 },
          at
        );
        tl.set(dots[i], { opacity: 1, attr: { cx: C.x, cy: C.y } }, at + 0.1);
        tl.to(dots[i], { attr: { cx: t.cx, cy: t.cy }, duration: 0.6, ease: "power1.inOut" }, at + 0.1);
        tl.to(dots[i], { opacity: 0, duration: 0.25 }, at + 0.62);
        tl.fromTo(
          types[i],
          { opacity: 0, scale: 0.85, rotation: -4, transformOrigin: "center center" },
          { opacity: 1, scale: 1, rotation: 0, duration: 0.5, ease: "back.out(1.7)" },
          at + 0.55
        );
      });
      tl.to(types, { opacity: 0, scale: 0.9, duration: 0.45, stagger: 0.08, ease: "power2.in" }, 6.2);
      tl.to([...radials, ...dots], { opacity: 0, duration: 0.5 }, 6.25);

      // ── Cena 4: docs (esqueletos) entram sobrepostos ──
      tl.fromTo(skels, { opacity: 0 }, { opacity: 1, duration: 0.8 }, 6.4);

      // ── Cena 5: análise 0→100% entre os anéis ──
      tl.fromTo(load, { opacity: 0, scale: 0.8, svgOrigin: "985 222" }, { opacity: 1, scale: 1, duration: 0.55, ease: "back.out(1.7)" }, 6.9);
      tl.to(loadArc, { strokeDashoffset: 0, duration: 2.0, ease: "power1.inOut" }, 7.25);
      tl.fromTo(
        counter,
        { v: 0 },
        { v: 100, duration: 2.0, ease: "power1.inOut", onUpdate: () => { pct.textContent = `${Math.round(counter.v)}%`; } },
        7.25
      );
      tl.to(loadSub, { opacity: 1, duration: 0.35 }, 9.15);
      tl.to(load, { opacity: 0, scale: 0.9, duration: 0.5 }, 9.9);

      // ── Cena 6: pendências aparecem DEPOIS do 100% (vermelho ❗) ──
      tl.fromTo(tasks, { opacity: 0, x: 36 }, { opacity: 1, x: 0, duration: 0.5, stagger: 0.14 }, 10.0);

      // ── Cena 7: Rebbeca surge; conexão curva à direita + bolinha laranja ──
      tl.fromTo(pro, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7 }, 10.9);
      tl.to(conn, { opacity: 1, duration: 0.4 }, 11.6);
      const cdraw = { p: 0 };
      tl.set(connDot, { opacity: 1 }, 11.7);
      tl.to(
        cdraw,
        {
          p: 1,
          duration: 0.75,
          ease: "power1.inOut",
          onUpdate: () => {
            const L = conn.getTotalLength();
            const pt = conn.getPointAtLength(L * cdraw.p);
            connDot.setAttribute("cx", `${pt.x}`);
            connDot.setAttribute("cy", `${pt.y}`);
          },
        },
        11.7
      );
      tl.to(connDot, { opacity: 0, duration: 0.2 }, 12.4);

      // ── Cena 8: com a conexão feita, as pendências são resolvidas uma a uma ──
      tasks.forEach((tk, i) => {
        const at = 12.7 + i * 0.42;
        tl.to(tk.querySelector(".jb-task-txt"), { fill: GREEN, duration: 0.3 }, at);
        tl.to(tk.querySelector(".jb-bang"), { opacity: 0, duration: 0.25 }, at);
        tl.to(tk.querySelector(".jb-check"), { opacity: 1, duration: 0.35, ease: "back.out(2)" }, at + 0.05);
      });

      // ── Cena 9: portfólio — a cidade cede o palco ──
      tl.to([pro, skels, ...tasks], { opacity: 0, duration: 0.6 }, 14.5);
      tl.to(rings, { opacity: 0, scale: 0.94, svgOrigin: "985 415", duration: 0.8 }, 14.65);
      tl.to(pState, { disperse: 1, duration: 0.9, ease: "power2.in" }, 14.65);
      tl.fromTo(portTitle, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7 }, 15.0);
      tl.fromTo(
        ports,
        { opacity: 0, scale: 0.8, transformOrigin: "center center" },
        { opacity: 1, scale: 1, duration: 0.6, stagger: 0.14, ease: "back.out(1.5)" },
        15.2
      );
      tl.to([...ports, portTitle], { opacity: 0, scale: 0.92, duration: 0.5, stagger: 0.07, ease: "power2.in" }, 17.6);

      // ── Cena 10: final — casa ATO + "Um ato. Regulariza!" (sem linha) ──
      tl.fromTo(finalG, { opacity: 0, scale: 0.6, svgOrigin: "985 380" }, { opacity: 1, scale: 1, duration: 0.8, ease: "back.out(1.6)" }, 18.2);

      // cadência geral: mais lenta e respirada
      tl.timeScale(0.78);
    }, svg);

    return () => {
      gsap.ticker.remove(render);
      ctx.revert();
    };
  }, []);

  return (
    <>
    {/* cidade em partículas — mesma linguagem do site atual */}
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
    <svg
      ref={svgRef}
      viewBox="0 0 1440 810"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <defs>
        {/* sombra suave = efeito 3D leve dos cards */}
        <filter id="jbShadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#2a2012" floodOpacity="0.14" />
        </filter>
      </defs>

      {/* cena inteira: 90% do tamanho e um pouco mais baixa */}
      <g transform="translate(98.5 75.5) scale(0.9)">

      {/* anéis concêntricos (aura) */}
      <g className="jb-rings" opacity="0">
        <circle cx={C.x} cy={C.y} r="236" fill="none" stroke="#6f7d6e" strokeOpacity="0.4" strokeWidth="1.5" />
        <circle cx={C.x} cy={C.y} r="152" fill="none" stroke="#6f7d6e" strokeOpacity="0.4" strokeWidth="1.5" />
      </g>

      {/* linhas pontilhadas radiais */}
      <g>
        {TYPES.map((t) => (
          <line
            key={t.label}
            className="jb-radial"
            x1={C.x}
            y1={C.y}
            x2={t.cx}
            y2={t.cy}
            stroke="#8a8478"
            strokeOpacity="0.28"
            strokeWidth="1"
            strokeDasharray="1.5 9"
            strokeLinecap="round"
            opacity="0"
          />
        ))}
      </g>

      {/* bolinhas que saem da cidade até o card */}
      <g>
        {TYPES.map((t) => (
          <circle key={t.label} className="jb-dot" cx={C.x} cy={C.y} r="5" fill={ORANGE} opacity="0" />
        ))}
      </g>

      {/* cards de tipos */}
      {TYPES.map((t) => {
        const w = pillWidth(t.label);
        return (
          <g key={t.label} className="jb-type" opacity="0">
            <rect x={t.cx - w / 2} y={t.cy - 23} width={w} height={46} rx={23} fill={CARD} stroke="rgba(36,40,34,.12)" filter="url(#jbShadow)" />
            <text x={t.cx} y={t.cy + 6} textAnchor="middle" fontSize="18" fontWeight="500" fill={TEAL} fontFamily="system-ui, sans-serif" letterSpacing="0.5">
              {t.label}
            </text>
          </g>
        );
      })}

      {/* esqueletos de documentos */}
      <g className="jb-skels" opacity="0">
        {SKELS.map((s, i) => (
          <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={Math.min(s.h / 2, 12)} fill="rgba(36,40,34,.16)" />
        ))}
      </g>

      {/* pendências (vermelho ❗ → verde ✓). translate fica no grupo externo:
          o interno anima x/y sem perder a posição. */}
      {TASKS.map((label, i) => {
        const y = TASK.y + i * (TASK.h + TASK.gap);
        return (
          <g key={label} transform={`translate(${TASK.x} ${y})`}>
            <g className="jb-task" opacity="0">
              <rect width={TASK.w} height={TASK.h} rx={10} fill="#fff" stroke="rgba(36,40,34,.10)" filter="url(#jbShadow)" />
              <text className="jb-task-txt" x={18} y={TASK.h / 2 + 5} fontSize="15" fill={RED} fontFamily="system-ui, sans-serif">
                {label}
              </text>
              <g className="jb-bang">
                <rect x={TASK.w - 30} y={9} width={20} height={20} rx={5} fill={RED} />
                <text x={TASK.w - 20} y={24} textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">!</text>
              </g>
              <path className="jb-check" d={`M${TASK.w - 28} 19 l5 5 l9 -10`} fill="none" stroke={GREEN} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" opacity="0" />
            </g>
          </g>
        );
      })}

      {/* análise — entre os dois anéis, textos dentro do círculo */}
      <g className="jb-load" opacity="0">
        <circle cx="985" cy="222" r="62" fill={TEAL} />
        <circle className="jb-load-arc" cx="985" cy="222" r="55" fill="none" stroke={ORANGE} strokeWidth="4" strokeLinecap="round" transform="rotate(-90 985 222)" />
        <text x="985" y="202" textAnchor="middle" fontSize="11" fill="rgba(255,255,255,.7)" fontFamily="system-ui, sans-serif">Analisando</text>
        <text className="jb-pct" x="985" y="232" textAnchor="middle" fontSize="26" fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">0%</text>
        <text className="jb-load-sub" x="985" y="252" textAnchor="middle" fontSize="8.5" fill="rgba(255,255,255,.7)" fontFamily="system-ui, sans-serif" opacity="0">análise concluída</text>
      </g>

      {/* Profissional + conexão curva à DIREITA com bolinha laranja */}
      <g className="jb-pro" opacity="0">
        <rect x="1095" y="150" width="272" height="58" rx="16" fill={TEAL} filter="url(#jbShadow)" />
        <circle cx="1126" cy="179" r="18" fill={ORANGE} />
        <text x="1126" y="185" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">MS</text>
        <text x="1156" y="175" fontSize="17" fontWeight="600" fill="#fff" fontFamily="system-ui, sans-serif">Mariana Silva</text>
        <text x="1156" y="196" fontSize="12" fill="rgba(255,255,255,.6)" fontFamily="system-ui, sans-serif">Arquiteta e Urbanista</text>
        {/* nasce no centro-base do card da profissional e TOCA o topo da
            1ª pendência — mesma lógica da 1ª conexão (curva + bolinha) */}
        <path
          className="jb-conn jb-march"
          d="M 1231 208 C 1281 215, 1281 231, 1231 238"
          fill="none"
          stroke="#6f6a5e"
          strokeOpacity="0.4"
          strokeWidth="1.2"
          strokeDasharray="2 8"
          strokeLinecap="round"
          opacity="0"
        />
        <circle className="jb-conn-dot" r="4.5" fill={ORANGE} opacity="0" />
      </g>

      {/* portfólio — título central + cidades (pontos turísticos) */}
      <text className="jb-port-title" x="1017" y="322" textAnchor="middle" fill={TEAL} fontFamily="'Instrument Serif', Georgia, serif" opacity="0">
        <tspan x="1017" fontSize="30">Presente em</tspan>
        <tspan x="1017" dy="42" fontSize="40" fill={ORANGE}>todo o Brasil.</tspan>
      </text>
      {PORT.map((p) => (
        <g key={p.city} className="jb-port" opacity="0">
          <circle cx={p.cx} cy={p.cy} r={p.r} fill="none" stroke="#6f7d6e" strokeOpacity="0.45" strokeWidth="1.5" />
          <CityMini name={p.city} cx={p.cx} cy={p.cy - 8} />
          <text x={p.cx} y={p.cy + 56} textAnchor="middle" fontSize="15" fontWeight="500" fill={TEAL} fontFamily="system-ui, sans-serif">
            {p.label}
          </text>
        </g>
      ))}

      {/* final: casa ATO + "Um [logo ato]. Regulariza!" */}
      <g className="jb-final" opacity="0">
        <image href="/casa-ato.png" x="875" y="262" width="220" height="209" />
        <foreignObject x="700" y="496" width="570" height="96">
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              gap: "12px",
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: "54px",
              lineHeight: 1,
              color: TEAL,
            }}
          >
            <span>Um</span>
            <span style={{ display: "inline-flex", alignItems: "flex-end" }}>
              <img src="/ato-wordmark.png" alt="ato" style={{ height: "58px", width: "auto" }} />
              <span style={{ color: ORANGE }}>.</span>
            </span>
            <span>Regulariza!</span>
          </div>
        </foreignObject>
      </g>

      </g>
    </svg>
    </>
  );
}
