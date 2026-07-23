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
 * Narrativa: cidade em LINHAS surge → anéis → tipos de regularização (surgem
 * e somem um a um) → problemas encontrados (cards vermelhos) → docs
 * (esqueletos) → análise 0–100% → pendências (vermelho ❗) → profissional
 * surge, UMA linha fluida conecta o card dela às 3 pendências → pendências
 * resolvidas ✓ em sequência, acompanhando a bolinha → mapa do Brasil com
 * mini-casas ATO pelos estados → casa ATO + "Um ato. Regulariza!".
 *
 * Tudo em SVG (sem canvas/partículas) — leve e responsivo.
 */

const TEAL = "#153A40";
const ORANGE = "#E86030";
const RED = "#D00909";
const GREEN = "#2F8F57";
const CARD = "#FBF6EE";

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

/* Problemas encontrados — segundo jogo de cards, logo após os tipos. */
const PROBLEMS = [
  { label: "Pendência no registro", cx: 850, cy: 195 },
  { label: "Débito de IPTU", cx: 1095, cy: 165 },
  { label: "Documentação incompleta", cx: 1255, cy: 330 },
  { label: "Divergência de área", cx: 890, cy: 490 },
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

/* Casinha ATO em miniatura — usada como marcador no mapa do Brasil. */
function MiniHouse({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="9" fill={CARD} stroke={ORANGE} strokeOpacity="0.35" strokeWidth="1" />
      <path
        d="M-4.5,1 L0,-4.6 L4.5,1"
        fill="none"
        stroke={ORANGE}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="-2.6" y="1" width="5.2" height="3.6" rx="0.8" fill={ORANGE} />
    </g>
  );
}

/* Marcadores pelo mapa (posições aproximadas das capitais, no espaço local
 * do <path> do Brasil abaixo — viewBox local 0 0 500 560). */
const BR_MARKERS = [
  { x: 70,  y: 140 }, // Manaus (AM)
  { x: 370, y: 50  }, // Fortaleza (CE)
  { x: 430, y: 140 }, // Recife (PE)
  { x: 400, y: 220 }, // Salvador (BA)
  { x: 250, y: 260 }, // Brasília (DF)
  { x: 370, y: 330 }, // Rio de Janeiro (RJ)
  { x: 330, y: 365 }, // São Paulo (SP)
  { x: 230, y: 480 }, // Porto Alegre (RS)
];

// Silhueta do Brasil — verificada renderizando os pontos antes de aplicar
// (espaço local ~540×620). Bico a nordeste, litoral suave, afunilamento
// no sul, saliência arredondada do Acre a oeste.
const BRAZIL_PATH =
  "M160,20 L220,12 L280,18 L330,28 " +
  "L365,42 L390,60 L410,80 " +
  "L470,95 " +
  "L425,125 " +
  "L410,160 L425,200 L415,245 " +
  "L395,285 L400,320 L375,355 " +
  "L345,385 L315,410 " +
  "L325,435 " +
  "L290,470 L260,505 L230,535 " +
  "L205,545 L180,538 " +
  "L160,510 L145,480 " +
  "L120,445 L100,405 L85,365 " +
  "L72,320 L65,275 " +
  "L60,240 " +
  "L30,205 L35,160 " +
  "L55,125 L50,90 " +
  "L75,55 L105,30 L135,20 Z";

function pillWidth(label: string) {
  return Math.max(label.length * 12 + 52, 130);
}

export function JardimBotanicoScene() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const q = <T extends Element>(sel: string) => Array.from(svg.querySelectorAll<T>(sel));
    const q1 = <T extends Element>(sel: string) => svg.querySelector<T>(sel)!;

    const city = q1<SVGGElement>(".jb-city");
    const rings = q1<SVGGElement>(".jb-rings");
    const radials = q<SVGLineElement>(".jb-radial");
    const dots = q<SVGCircleElement>(".jb-dot");
    const types = q<SVGGElement>(".jb-type");
    const problems = q<SVGGElement>(".jb-problem");
    const skels = q1<SVGGElement>(".jb-skels");
    const tasks = q<SVGGElement>(".jb-task"); // grupos internos (translate fica no pai)
    const load = q1<SVGGElement>(".jb-load");
    const loadArc = q1<SVGCircleElement>(".jb-load-arc");
    const loadSub = q1<SVGTextElement>(".jb-load-sub");
    const pct = q1<SVGTextElement>(".jb-pct");
    const pro = q1<SVGGElement>(".jb-pro");
    const brazilMap = q1<SVGGElement>(".jb-brazil");
    const bMarkers = q<SVGGElement>(".jb-bmarker");
    const portTitle = q1<SVGTextElement>(".jb-port-title");
    const finalG = q1<SVGGElement>(".jb-final");
    const conn = q1<SVGPathElement>(".jb-conn");
    const connDot = q1<SVGCircleElement>(".jb-conn-dot");

    const ctx = gsap.context(() => {
      const arcLen = 2 * Math.PI * 55;
      loadArc.style.strokeDasharray = `${arcLen}`;

      // estados iniciais
      gsap.set(
        [rings, skels, load, pro, portTitle, finalG, brazilMap, ...types, ...problems, ...tasks, ...bMarkers],
        { opacity: 0 }
      );
      gsap.set(city, { opacity: 0, y: 16 });
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
      breathe(problems, 4, 2.3);
      breathe(tasks, 4, 2.2);
      breathe(Array.from(skels.children), 6, 3.0);
      breathe(bMarkers, 3, 2.6);
      // OBS: [pro] (card da Mariana) NÃO respira — a animação contínua
      // brigava com a entrada dela (fromTo de y), causando o "pulo" brusco.
      breathe([finalG], 5, 3.4);
      breathe([city], 6, 3.6);
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
      tl.set(city, { opacity: 0, y: 16 }, 0);
      tl.set(portTitle, { scale: 1 }, 0);
      tl.set(".jb-task-txt", { fill: RED }, 0);
      tl.set(".jb-bang", { opacity: 1 }, 0);
      tl.set(".jb-check", { opacity: 0 }, 0);
      tl.set(loadArc, { strokeDashoffset: arcLen }, 0);
      tl.set(loadSub, { opacity: 0 }, 0);
      tl.call(() => { pct.textContent = "0%"; }, undefined, 0);
      tl.to(finalG, { opacity: 0, duration: 0.7 }, 0);

      // ── Cena 1: a cidade SURGE — traçado em linhas, leve ──
      tl.to(city, { opacity: 1, y: 0, duration: 1.1, ease: "power2.out" }, 0.4);

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

      // ── Cena 3b: PROBLEMAS ENCONTRADOS — segundo jogo de cards, vermelhos ──
      tl.fromTo(
        problems,
        { opacity: 0, scale: 0.85, y: 10 },
        { opacity: 1, scale: 1, y: 0, duration: 0.5, stagger: 0.12, ease: "back.out(1.6)" },
        6.6
      );
      // hold generoso: ~2s com os 4 cards já visíveis antes de sumirem
      tl.to(problems, { opacity: 0, scale: 0.92, y: -8, duration: 0.4, stagger: 0.08, ease: "power2.in" }, 9.4);

      // ── Cena 4: docs (esqueletos) entram sobrepostos ──
      tl.fromTo(skels, { opacity: 0 }, { opacity: 1, duration: 0.8 }, 10.3);

      // ── Cena 5: análise 0→100% entre os anéis ──
      tl.fromTo(load, { opacity: 0, scale: 0.8, svgOrigin: "985 222" }, { opacity: 1, scale: 1, duration: 0.55, ease: "back.out(1.7)" }, 10.8);
      tl.to(loadArc, { strokeDashoffset: 0, duration: 2.0, ease: "power1.inOut" }, 11.15);
      tl.fromTo(
        counter,
        { v: 0 },
        { v: 100, duration: 2.0, ease: "power1.inOut", onUpdate: () => { pct.textContent = `${Math.round(counter.v)}%`; } },
        11.15
      );
      tl.to(loadSub, { opacity: 1, duration: 0.35 }, 13.05);
      tl.to(load, { opacity: 0, scale: 0.9, duration: 0.5 }, 13.8);

      // ── Cena 6: pendências aparecem DEPOIS do 100% (vermelho ❗) ──
      tl.fromTo(tasks, { opacity: 0, x: 36 }, { opacity: 1, x: 0, duration: 0.5, stagger: 0.14 }, 13.9);

      // ── Cena 7: profissional surge (entrada suave, sem "pular") ──
      tl.fromTo(
        pro,
        { opacity: 0, y: 14, scale: 0.94, transformOrigin: "center center" },
        { opacity: 1, y: 0, scale: 1, duration: 0.85, ease: "power3.out" },
        14.8
      );
      // UMA linha fluida — nasce no card da profissional e desce tocando
      // as 3 pendências em sequência, com a bolinha percorrendo tudo
      tl.to(conn, { opacity: 1, duration: 0.4 }, 15.5);
      const cdraw = { p: 0 };
      tl.set(connDot, { opacity: 1 }, 15.6);
      tl.to(
        cdraw,
        {
          p: 1,
          duration: 1.5,
          ease: "power1.inOut",
          onUpdate: () => {
            const L = conn.getTotalLength();
            const pt = conn.getPointAtLength(L * cdraw.p);
            connDot.setAttribute("cx", `${pt.x}`);
            connDot.setAttribute("cy", `${pt.y}`);
          },
        },
        15.6
      );
      tl.to(connDot, { opacity: 0, duration: 0.2 }, 17.15);

      // ── Cena 8: pendências resolvidas em sequência, junto com a bolinha ──
      tasks.forEach((tk, i) => {
        const at = 16.6 + i * 0.5;
        tl.to(tk.querySelector(".jb-task-txt"), { fill: GREEN, duration: 0.3 }, at);
        tl.to(tk.querySelector(".jb-bang"), { opacity: 0, duration: 0.25 }, at);
        tl.to(tk.querySelector(".jb-check"), { opacity: 1, duration: 0.35, ease: "back.out(2)" }, at + 0.05);
      });

      // ── Cena 9: mapa do Brasil — a cidade cede o palco ──
      tl.to([pro, skels, ...tasks], { opacity: 0, duration: 0.6 }, 18.4);
      tl.to(rings, { opacity: 0, scale: 0.94, svgOrigin: "985 415", duration: 0.8 }, 18.55);
      tl.to(city, { opacity: 0, y: -14, duration: 0.9, ease: "power2.in" }, 18.55);
      tl.fromTo(portTitle, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7 }, 18.9);
      tl.fromTo(
        brazilMap,
        { opacity: 0, scale: 0.9, svgOrigin: "1015 350" },
        { opacity: 1, scale: 1, duration: 0.7 },
        19.1
      );
      tl.fromTo(
        bMarkers,
        { opacity: 0, scale: 0, transformOrigin: "center center" },
        { opacity: 1, scale: 1, duration: 0.4, stagger: 0.07, ease: "back.out(2)" },
        19.4
      );
      tl.to([brazilMap, ...bMarkers, portTitle], { opacity: 0, scale: 0.94, duration: 0.5, stagger: 0.02, ease: "power2.in" }, 21.5);

      // ── Cena 10: final — casa ATO + "Um ato. Regulariza!" (sem linha) ──
      tl.fromTo(finalG, { opacity: 0, scale: 0.6, svgOrigin: "985 380" }, { opacity: 1, scale: 1, duration: 0.8, ease: "back.out(1.6)" }, 22.1);

      // cadência geral: mais lenta e respirada
      tl.timeScale(0.78);
    }, svg);

    return () => {
      ctx.revert();
    };
  }, []);

  return (
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

      {/* cidade — o PNG do Jardim Botânico (leve: só uma imagem, sem canvas/JS por frame) */}
      <g className="jb-city" opacity="0">
        <image
          href="/cwb.png"
          x={CITY.x - 30}
          y={CITY.y - 10}
          width={CITY.w + 60}
          height={CITY.h + 40}
          preserveAspectRatio="xMidYMax meet"
        />
      </g>

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

      {/* problemas encontrados — segundo jogo de cards, vermelhos */}
      {PROBLEMS.map((p) => {
        const w = pillWidth(p.label) + 22;
        const left = p.cx - w / 2;
        return (
          <g key={p.label} className="jb-problem" opacity="0">
            <rect x={left} y={p.cy - 23} width={w} height={46} rx={23} fill={CARD} stroke={RED} strokeOpacity="0.4" filter="url(#jbShadow)" />
            <rect x={left + 12} y={p.cy - 11} width={22} height={22} rx={6} fill={RED} />
            <text x={left + 23} y={p.cy + 6} textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">!</text>
            <text x={left + 46} y={p.cy + 6} fontSize="16" fontWeight="500" fill={RED} fontFamily="system-ui, sans-serif">
              {p.label}
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

      {/* Profissional + UMA conexão fluida tocando as 3 pendências */}
      <g className="jb-pro" opacity="0">
        <rect x="1095" y="150" width="272" height="58" rx="16" fill={TEAL} filter="url(#jbShadow)" />
        <circle cx="1126" cy="179" r="18" fill={ORANGE} />
        <text x="1126" y="185" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">MS</text>
        <text x="1156" y="175" fontSize="17" fontWeight="600" fill="#fff" fontFamily="system-ui, sans-serif">Mariana Silva</text>
        <text x="1156" y="196" fontSize="12" fill="rgba(255,255,255,.6)" fontFamily="system-ui, sans-serif">Arquiteta e Urbanista</text>
        {/* nasce no card da profissional, curva suave até a 1ª pendência e
            desce reto (tangente vertical contínua) tocando as outras duas
            — sem quinas/emendas visíveis */}
        <path
          className="jb-conn jb-march"
          d="M 1231 208 C 1300 210, 1349 240, 1349 258 L 1349 314 L 1349 370"
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

      {/* mapa do Brasil — título ACIMA, mapa ABAIXO (sem sobrepor) */}
      <text className="jb-port-title" x="1017" y="150" textAnchor="middle" fill={TEAL} fontFamily="'Instrument Serif', Georgia, serif" opacity="0">
        <tspan x="1017" fontSize="30">Presente em</tspan>
        <tspan x="1017" dy="42" fontSize="40" fill={ORANGE}>todo o Brasil.</tspan>
      </text>
      <g className="jb-brazil" opacity="0" transform="translate(795 225) scale(0.6)">
        <path d={BRAZIL_PATH} fill={CARD} stroke={TEAL} strokeWidth="2.4" strokeOpacity="0.55" strokeLinejoin="round" />
        {BR_MARKERS.map((m, i) => (
          <g key={i} className="jb-bmarker" opacity="0">
            <MiniHouse x={m.x} y={m.y} />
          </g>
        ))}
      </g>

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
  );
}
