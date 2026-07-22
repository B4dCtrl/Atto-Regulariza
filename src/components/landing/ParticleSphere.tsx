import { useEffect, useRef } from "react";
import * as THREE from "three";

/* ─── Constantes ─────────────────────────────────────────────────────────── */
const N        = 6000;
const HOLD_MS  = 2500;  // ms estático em cada shape
const MORPH_MS = 900;   // ~1 s de transição

/* ─── Easing ─────────────────────────────────────────────────────────────── */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/* ─── Distribui N pontos uniformemente ao longo de segmentos de reta ────── */
function sampleLines(segs: number[][], n: number, zJitter = 0.04): Float32Array {
  const lens   = segs.map(([x1, y1, x2, y2]) => Math.hypot(x2 - x1, y2 - y1));
  const cumLen = [0];
  for (const l of lens) cumLen.push(cumLen[cumLen.length - 1] + l);
  const total = cumLen[cumLen.length - 1];
  const out   = new Float32Array(n * 3);

  for (let i = 0; i < n; i++) {
    const r  = Math.random() * total;
    let lo = 0, hi = segs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumLen[mid + 1] < r) lo = mid + 1;
      else hi = mid;
    }
    const [x1, y1, x2, y2] = segs[lo];
    const t = lens[lo] > 1e-6 ? Math.min((r - cumLen[lo]) / lens[lo], 1) : 0;
    out[i * 3]     = x1 + t * (x2 - x1) + (Math.random() - 0.5) * 0.025;
    out[i * 3 + 1] = y1 + t * (y2 - y1) + (Math.random() - 0.5) * 0.025;
    out[i * 3 + 2] = (Math.random() - 0.5) * zJitter;
  }
  return out;
}

/* ─── Shape builders ─────────────────────────────────────────────────────── */

/** Esfera 3D com névoa — 76% casca + 24% nuvem dispersa */
function buildSphere(n: number): Float32Array {
  const out  = new Float32Array(n * 3);
  const SURF = Math.floor(n * 0.76);
  for (let i = 0; i < n; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = i < SURF
      ? 2.0 + (Math.random() - 0.5) * 0.18
      : 2.1 + Math.random() * 2.2;
    out[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    out[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    out[i * 3 + 2] = r * Math.cos(phi);
  }
  return out;
}

/** Casa elaborada — telhado, chaminé, paredes, porta e duas janelas com grade */
function buildHouse(n: number): Float32Array {
  return sampleLines([
    [-1.6,  0.05,   0.0,  1.78],   // telhado esq
    [ 0.0,  1.78,   1.6,  0.05],   // telhado dir
    [ 0.65, 1.15,   0.65, 1.88],   // chaminé esq
    [ 0.65, 1.88,   1.05, 1.88],   // chaminé topo
    [ 1.05, 1.88,   1.05, 1.02],   // chaminé dir
    [-1.3,  0.05,  -1.3, -1.85],   // parede esq
    [-1.3, -1.85,   1.3, -1.85],   // base
    [ 1.3, -1.85,   1.3,  0.05],   // parede dir
    [-0.44,-1.85,  -0.44,-0.82],   // porta esq
    [-0.44,-0.82,   0.44,-0.82],   // porta topo
    [ 0.44,-0.82,   0.44,-1.85],   // porta dir
    // janela esquerda (com cruzeta)
    [-1.05,-0.15,  -0.55,-0.15],
    [-0.55,-0.15,  -0.55, 0.35],
    [-0.55, 0.35,  -1.05, 0.35],
    [-1.05, 0.35,  -1.05,-0.15],
    [-0.80,-0.15,  -0.80, 0.35],
    [-1.05, 0.10,  -0.55, 0.10],
    // janela direita (com cruzeta)
    [ 0.55,-0.15,   1.05,-0.15],
    [ 1.05,-0.15,   1.05, 0.35],
    [ 1.05, 0.35,   0.55, 0.35],
    [ 0.55, 0.35,   0.55,-0.15],
    [ 0.80,-0.15,   0.80, 0.35],
    [ 0.55, 0.10,   1.05, 0.10],
  ], n, 0.04);
}

/** Loteamento — perímetro, área verde no topo, rua central e lotes divididos */
function buildLoteamento(n: number): Float32Array {
  return sampleLines([
    // perímetro externo
    [-1.6, -2.0,  -1.6,  1.85],
    [-1.6,  1.85,  1.6,  1.85],
    [ 1.6,  1.85,  1.6, -2.0],
    [-1.6, -2.0,   1.6, -2.0],
    // área verde (faixa no topo)
    [-1.6,  1.85, -1.6,  2.2],
    [-1.6,  2.2,   1.6,  2.2],
    [ 1.6,  2.2,   1.6,  1.85],
    // rua central (formato de pista)
    [-0.32, 1.35,  0.0,  1.6],
    [ 0.0,  1.6,   0.32, 1.35],
    [ 0.32, 1.35,  0.32,-1.35],
    [ 0.32,-1.35,  0.0, -1.6],
    [ 0.0, -1.6,  -0.32,-1.35],
    [-0.32,-1.35, -0.32, 1.35],
    // divisões de lotes — esquerda
    [-1.6,  1.35, -0.32, 1.35],
    [-1.6,  0.65, -0.32, 0.65],
    [-1.6, -0.05, -0.32,-0.05],
    [-1.6, -0.75, -0.32,-0.75],
    [-1.6, -1.45, -0.32,-1.45],
    // divisões de lotes — direita
    [ 0.32,  1.35,  1.6,  1.35],
    [ 0.32,  0.65,  1.6,  0.65],
    [ 0.32, -0.05,  1.6, -0.05],
    [ 0.32, -0.75,  1.6, -0.75],
    [ 0.32, -1.45,  1.6, -1.45],
  ], n, 0.04);
}

/** Documento — todas as 6000 partículas nos traçados */
function buildDocument(n: number): Float32Array {
  return sampleLines([
    [-1.1,  1.55,  -1.1, -1.72],   // lateral esq
    [-1.1, -1.72,   1.1, -1.72],   // base
    [ 1.1, -1.72,   1.1,  1.05],   // lateral dir
    [-1.1,  1.55,   0.58, 1.55],   // topo
    [ 0.58, 1.55,   1.1,  1.05],   // corte diagonal
    [ 0.58, 1.55,   0.58, 1.05],   // vinco vertical
    [ 0.58, 1.05,   1.1,  1.05],   // vinco horizontal
    [-0.75, 0.82,   0.75, 0.82],   // texto 1
    [-0.75, 0.42,   0.75, 0.42],   // texto 2
    [-0.75, 0.02,   0.75, 0.02],   // texto 3
    [-0.75,-0.38,   0.75,-0.38],   // texto 4
    [-0.75,-0.78,   0.75,-0.78],   // texto 5
    [-0.75,-1.18,   0.42,-1.18],   // texto 6
  ], n, 0.04);
}

/** Amostra um texto renderizado em canvas — pixels opacos viram partículas */
function sampleText(text: string, n: number): Float32Array {
  const W = 1000, H = 200;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 90px Georgia, 'Times New Roman', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, H / 2);

  const img = ctx.getImageData(0, 0, W, H).data;
  const candidates: [number, number][] = [];
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      if (img[(y * W + x) * 4 + 3] > 128) candidates.push([x, y]);
    }
  }

  const out = new Float32Array(n * 3);
  const scale = 4.6 / W;
  for (let i = 0; i < n; i++) {
    const [cx, cy] = candidates.length
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : [W / 2, H / 2];
    out[i * 3]     = (cx - W / 2) * scale + (Math.random() - 0.5) * 0.02;
    out[i * 3 + 1] = -(cy - H / 2) * scale + (Math.random() - 0.5) * 0.02;
    out[i * 3 + 2] = (Math.random() - 0.5) * 0.04;
  }
  return out;
}

/* ─── Componente ─────────────────────────────────────────────────────────── */
export function ParticleSphere() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const phases = [
      buildSphere(N),
      buildLoteamento(N),
      buildHouse(N),
      buildDocument(N),
      sampleText("Um ato regulariza.", N),
    ] as const;
    const CYCLE_MS = (HOLD_MS + MORPH_MS) * phases.length;

    const workBuf = phases[0].slice();

    /* Renderer */
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;";
    container.appendChild(renderer.domElement);

    /* Cena */
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.z = 7;

    /* Geometria */
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(workBuf, 3));
    const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;

    /* Shader */
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */`
        varying float vFade;
        void main() {
          float dist = length(position);
          // Esfera: névoa some gradualmente (dist 2→4.8)
          // Ícones 2D: dist ≤ 2 → vFade ≈ 1 → totalmente opacos
          vFade = 1.0 - smoothstep(2.0, 4.8, dist);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float sz = 260.0 / -mv.z;
          gl_PointSize = clamp(sz * mix(0.4, 1.0, vFade), 0.3, 3.2);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */`
        varying float vFade;
        void main() {
          vec2 c = 2.0 * gl_PointCoord - 1.0;
          if (dot(c, c) > 1.0) discard;
          vec3 col = vec3(0.130, 0.102, 0.071);
          gl_FragColor = vec4(col, vFade * 0.90);
        }
      `,
      transparent: true,
      depthWrite: false,
    });

    const points = new THREE.Points(geo, mat);
    points.position.x = 2.50;      // deslocado para a direita
    points.scale.setScalar(0.9);   // 10% menor
    scene.add(points);

    /* Loop */
    let lastT  = performance.now();
    let totalT = 0;
    let rotY   = 0; // acumulador de rotação da esfera
    let raf: number;

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);

      const now = performance.now();
      const dt  = Math.min((now - lastT) / 1000, 0.05);
      lastT   = now;
      totalT += dt;

      /* Fase e progresso */
      const elapsed  = totalT * 1000;
      const cycleT   = elapsed % CYCLE_MS;
      const phaseIdx = Math.min(
        Math.floor(cycleT / (HOLD_MS + MORPH_MS)),
        phases.length - 1,
      );
      const phaseT = cycleT - phaseIdx * (HOLD_MS + MORPH_MS);
      const morphT = phaseT > HOLD_MS
        ? easeInOutCubic(Math.min((phaseT - HOLD_MS) / MORPH_MS, 1))
        : 0;

      /* Lerp posições */
      const fromPos = phases[phaseIdx];
      const toPos   = phases[(phaseIdx + 1) % phases.length];
      for (let i = 0; i < N * 3; i++) {
        workBuf[i] = fromPos[i] + (toPos[i] - fromPos[i]) * morphT;
      }
      posAttr.needsUpdate = true;

      /* ── Rotação ──────────────────────────────────────────────────────────
       * APENAS a esfera (fase 0) gira.
       * Durante morph esfera→loteamento: a rotação suaviza para 0 (× 1 - morphT²).
       * Demais fases (ícones planos): rotation.y = 0, acumulador zerado.
       * Retorno texto→esfera: acelera com ease-in quadrático.              */
      if (phaseIdx === 0) {
        // Esfera: acumula rotação, desacelera durante morph de saída
        rotY += dt * 0.05 * (1 - morphT * 0.95);
        // Suaviza para 0 ao terminar o morph (quadrático)
        points.rotation.y = rotY * (1 - morphT * morphT);
        points.rotation.x = Math.sin(totalT * 0.035) * 0.07 * (1 - morphT);
      } else if (phaseIdx === phases.length - 1 && morphT > 0) {
        // Última fase (texto) → Esfera: começa a acumular de novo com ease-in
        rotY += dt * morphT * morphT * 0.05;
        points.rotation.y = rotY;
        points.rotation.x = 0;
      } else {
        // Ícones 2D durante hold: completamente parados
        rotY = 0;
        points.rotation.y = 0;
        points.rotation.x = 0;
      }

      renderer.render(scene, camera);
    };

    resize();
    loop();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (container.contains(renderer.domElement))
        container.removeChild(renderer.domElement);
      renderer.dispose();
      geo.dispose();
      mat.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      aria-hidden
      className="absolute inset-0 pointer-events-none"
    />
  );
}
