import React from 'react';
import {AbsoluteFill, Audio, Easing, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

const CREAM = '#FBF9F6', INK = '#15100C', ORANGE = '#EA6134', LINE = 'rgba(21,16,12,0.55)';
const FONT = `
@font-face{font-family:'Instrument Serif';src:url(${staticFile('fonts/InstrumentSerif-Regular.woff2')}) format('woff2');}
@font-face{font-family:'Inter';src:url(${staticFile('fonts/Inter-Regular.woff2')}) format('woff2');font-weight:100 900;}
`;

// ---- mapa cadastral (determinístico) ----
const rnd = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const COLS = 4, ROWS = 5, BW = 232, BH = 196, ST = 34, X0 = 24, Y0 = 40;
type Lot = {id: number; pts: [number, number][]; cx: number; cy: number; d: number; hero: boolean};
const lots: Lot[] = [];
const HERO_BLOCK = {c: 1, r: 2};
let id = 0;
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
  const bx = X0 + c * (BW + ST), by = Y0 + r * (BH + ST);
  const split = 0.42 + rnd(r * 9 + c) * 0.18;
  const sx = bx + BW * split;
  const j = (k: number) => (rnd(id * 7 + k) - 0.5) * 12;
  const mk = (x1: number, x2: number): [number, number][] => [
    [x1 + j(1), by + j(2)], [x2 + j(3), by + j(4)], [x2 + j(5), by + BH + j(6)], [x1 + j(7), by + BH + j(8)]];
  [[bx, sx - 4], [sx + 4, bx + BW]].forEach(([a, b], k) => {
    const pts = mk(a, b);
    const cx = (a + b) / 2, cy = by + BH / 2;
    lots.push({id: id++, pts, cx, cy, d: 0, hero: c === HERO_BLOCK.c && r === HERO_BLOCK.r && k === 1});
  });
}
const hero = lots.find(l => l.hero)!;
lots.forEach(l => (l.d = Math.hypot(l.cx - hero.cx, l.cy - hero.cy)));

const MAP_Y = 90;       // offset do mapa na tela
const toPath = (p: [number, number][]) => 'M' + p.map(q => q.join(',')).join('L') + 'Z';

const MapLayer: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  // lotes desenham do centro para fora
  const heroFill = spring({frame: f - 22, fps, config: {damping: 14, stiffness: 120}});
  const ring = (k: number) => {
    const t = ((f - 24 - k * 10) / 26);
    return t < 0 || t > 1 ? null : t;
  };
  const tagIn = spring({frame: f - 34, fps, config: {damping: 11, stiffness: 150, mass: 0.7}});
  const tagRot = interpolate(tagIn, [0, 1], [-14, -3]);
  const lineDraw = interpolate(f, [30, 40], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const tx = hero.cx - 300, ty = hero.cy - 175;
  return (
    <svg width={1080} height={1300} viewBox="0 0 1080 1300" style={{overflow: 'visible'}}>
      <g transform={`translate(0 ${MAP_Y})`}>
        {lots.map(l => {
          const start = 2 + (l.d / 60);
          const p = interpolate(f, [start, start + 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
          const dim = l.hero ? 1 : interpolate(f, [26, 44], [1, 0.6], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          return (
            <g key={l.id} opacity={dim}>
              {l.hero && <path d={toPath(l.pts)} fill={ORANGE} opacity={heroFill * 0.92} />}
              <path d={toPath(l.pts)} fill="none" stroke={l.hero && heroFill > 0.3 ? ORANGE : LINE} strokeWidth={l.hero ? 5 : 2.5}
                pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} strokeLinejoin="round" />
            </g>
          );
        })}
        {/* ondas de pulso no lote */}
        {[0, 1, 2].map(k => {
          const t = ring(k); if (t === null) return null;
          const e = Easing.out(Easing.cubic)(t);
          return <circle key={k} cx={hero.cx} cy={hero.cy} r={40 + e * 230} fill="none" stroke={ORANGE} strokeWidth={5 * (1 - e) + 0.5} opacity={1 - t} />;
        })}
        {/* cota do lote */}
        <circle cx={hero.cx} cy={hero.cy} r={9 * heroFill} fill={CREAM} />
        {/* linha-guia + etiqueta */}
        <line x1={hero.cx} y1={hero.cy} x2={hero.cx + (tx + 300 - hero.cx) * lineDraw} y2={hero.cy + (ty + 76 - hero.cy) * lineDraw} stroke={INK} strokeWidth={3} />
        <g transform={`translate(${tx} ${ty + (1 - tagIn) * 70}) rotate(${tagRot})`} opacity={Math.min(1, tagIn * 3)}>
          <rect x={0} y={0} width={440} height={76} rx={8} fill={INK} />
          <text x={26} y={50} fontFamily="Inter" fontWeight={700} fontSize={27} letterSpacing={3} fill={CREAM}>MATRÍCULA: <tspan fill={ORANGE}>PENDENTE</tspan></text>
        </g>
      </g>
    </svg>
  );
};

// linha de texto com máscara (sobe de baixo, como motion de título)
const Line: React.FC<{start: number; children: React.ReactNode}> = ({start, children}) => {
  const f = useCurrentFrame(); const {fps} = useVideoConfig();
  const s = spring({frame: f - start, fps, config: {damping: 15, stiffness: 140, mass: 0.8}});
  return (
    <div style={{overflow: 'hidden', paddingTop: 6, paddingBottom: 14, marginBottom: -26}}>
      <div style={{transform: `translateY(${(1 - s) * 125}%) skewY(${(1 - s) * 5}deg)`, transformOrigin: 'left bottom'}}>{children}</div>
    </div>
  );
};

export const Cena1: React.FC = () => {
  const f = useCurrentFrame(); const {fps} = useVideoConfig();
  // câmera: push-in lento + deriva (parallax: mapa e texto se movem em taxas diferentes)
  const push = interpolate(f, [0, 114], [1.15, 1.42], {easing: Easing.inOut(Easing.quad)});
  const drift = interpolate(f, [0, 114], [0, -40]);
  const SLAM = 58;
  const kick = f >= SLAM ? Math.exp(-(f - SLAM) / 4) : 0;
  const shakeX = Math.sin((f - SLAM) * 2.7) * 16 * kick;
  const shakeY = Math.cos((f - SLAM) * 3.3) * 12 * kick;
  const naoS = spring({frame: f - SLAM, fps, config: {damping: 8, stiffness: 220, mass: 0.6}});
  const naoScale = interpolate(naoS, [0, 1], [2.3, 1]);
  const naoOp = interpolate(f, [SLAM, SLAM + 2], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const under = interpolate(f, [SLAM + 5, SLAM + 16], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.exp)});
  const textPush = interpolate(f, [0, 114], [1, 1.03]);
  const exitY = interpolate(f, [104, 113], [0, -30], {extrapolateLeft: 'clamp', easing: Easing.in(Easing.cubic)});

  return (
    <AbsoluteFill style={{background: CREAM, fontFamily: 'Inter', overflow: 'hidden'}}>
      <style>{FONT}</style>
      <Audio src={staticFile('music/bed.mp3')} volume={(fr) => interpolate(fr, [0, 24], [0, 0.16], {extrapolateRight: 'clamp'})} />
      <Sequence from={6}><Audio src={staticFile('vo/a1.wav')} volume={1} /></Sequence>

      {/* grade de fundo sutil */}
      <AbsoluteFill style={{backgroundImage: `linear-gradient(rgba(21,16,12,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(21,16,12,0.05) 1px, transparent 1px)`, backgroundSize: '90px 90px', transform: `translate(${drift * 0.2}px, ${drift * 0.2}px)`}} />

      {/* camada do mapa (fundo, mais lenta) */}
      <div style={{position: 'absolute', left: 0, top: 40, width: 1080, height: 1100, transformOrigin: `${hero.cx}px ${hero.cy + MAP_Y}px`,
        transform: `translate(${shakeX * 0.5}px, ${shakeY * 0.5 + drift * 0.4}px) scale(${push}) rotate(${interpolate(f, [0, 114], [-1.2, 0.6])}deg)`}}>
        <MapLayer />
      </div>

      {/* véu para legibilidade do texto */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 1000, bottom: 0, background: `linear-gradient(to bottom, rgba(251,249,246,0) 0%, ${CREAM} 22%)`}} />

      {/* camada do texto (frente) */}
      <div style={{position: 'absolute', left: 70, right: 40, top: 1040, color: INK, fontFamily: 'Instrument Serif',
        fontSize: 214, lineHeight: 0.92, letterSpacing: -4,
        transform: `translate(${shakeX}px, ${shakeY + exitY}px) scale(${textPush})`, transformOrigin: 'left top'}}>
        <Line start={40}>Seu imóvel</Line>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 40, whiteSpace: 'nowrap', position: 'relative'}}>
          <span style={{display: 'inline-block', color: ORANGE, fontStyle: 'italic', transform: `scale(${naoScale})`, transformOrigin: '30% 80%', opacity: naoOp, paddingRight: 16, position: 'relative'}}>
            NÃO
            <span style={{position: 'absolute', left: 0, right: 0, bottom: 8, height: 12, background: ORANGE, transformOrigin: 'left', transform: `scaleX(${under})`, opacity: 0.9}} />
          </span>
          <Line start={52}><span>está no</span></Line>
        </div>
        <Line start={66}>seu nome?</Line>
      </div>

      {/* grão leve de papel */}
      <AbsoluteFill style={{opacity: 0.07, mixBlendMode: 'multiply'}}>
        <svg width="100%" height="100%"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={f % 4} /></filter><rect width="100%" height="100%" filter="url(#n)" /></svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
