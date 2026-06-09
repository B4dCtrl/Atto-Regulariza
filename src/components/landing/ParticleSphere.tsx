import { useEffect, useRef } from "react";
import * as THREE from "three";

/* ─── Constantes ─────────────────────────────────────────────────────────── */
const N         = 6000;   // partículas totais
const HOLD_MS   = 3000;   // ms que cada forma fica estática
const MORPH_MS  = 1400;   // ms de cada transição
const CYCLE_MS  = (HOLD_MS + MORPH_MS) * 4; // ciclo completo (4 fases)

/* ─── Easing ─────────────────────────────────────────────────────────────── */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/* ─── Distribuição uniforme de N pontos ao longo de segmentos de reta ─────
 * segs: [[x1,y1, x2,y2], ...]
 * Cada segmento recebe pontos proporcional ao seu comprimento.
 * zJitter: variação aleatória em Z para dar profundidade sutil.       */
function sampleLines(segs: number[][], n: number, zJitter = 0.07): Float32Array {
  const lens   = segs.map(([x1, y1, x2, y2]) => Math.hypot(x2 - x1, y2 - y1));
  const cumLen = [0];
  for (const l of lens) cumLen.push(cumLen[cumLen.length - 1] + l);
  const total = cumLen[cumLen.length - 1];
  const out   = new Float32Array(n * 3);

  for (let i = 0; i < n; i++) {
    const r  = Math.random() * total;
    // busca binária do segmento
    let lo = 0, hi = segs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumLen[mid + 1] < r) lo = mid + 1;
      else hi = mid;
    }
    const [x1, y1, x2, y2] = segs[lo];
    const t = lens[lo] > 1e-6 ? Math.min((r - cumLen[lo]) / lens[lo], 1) : 0;
    out[i * 3]     = x1 + t * (x2 - x1) + (Math.random() - 0.5) * 0.04;
    out[i * 3 + 1] = y1 + t * (y2 - y1) + (Math.random() - 0.5) * 0.04;
    out[i * 3 + 2] = (Math.random() - 0.5) * zJitter;
  }
  return out;
}

/* ─── Shape builders ─────────────────────────────────────────────────────── */

function buildSphere(n: number): Float32Array {
  const out  = new Float32Array(n * 3);
  const SURF = Math.floor(n * 0.76); // 76% na casca, 24% na névoa
  for (let i = 0; i < n; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = i < SURF
      ? 2.0 + (Math.random() - 0.5) * 0.18  // casca
      : 2.1 + Math.random() * 2.2;           // névoa
    out[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    out[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    out[i * 3 + 2] = r * Math.cos(phi);
  }
  return out;
}

function buildHouse(n: number): Float32Array {
  // Baseado na imagem: ícone de casa com linhas grossas —
  // telhado triangular com beiral, chaminé, paredes e porta em U.
  return sampleLines([
    // Telhado — dois planos diagonais
    [-1.6,  0.05,   0.0,  1.78],   // rampa esquerda
    [ 0.0,  1.78,   1.6,  0.05],   // rampa direita
    // Chaminé — três lados (aberta na base onde encontra o telhado)
    [ 0.65, 1.15,   0.65, 1.88],   // lado esquerdo
    [ 0.65, 1.88,   1.05, 1.88],   // topo
    [ 1.05, 1.88,   1.05, 1.02],   // lado direito
    // Paredes
    [-1.3,  0.05,  -1.3, -1.85],   // parede esquerda
    [-1.3, -1.85,   1.3, -1.85],   // base
    [ 1.3, -1.85,   1.3,  0.05],   // parede direita
    // Porta — abertura em U invertido
    [-0.44,-1.85,  -0.44,-0.82],   // lateral esquerda
    [-0.44,-0.82,   0.44,-0.82],   // topo da porta
    [ 0.44,-0.82,   0.44,-1.85],   // lateral direita
  ], n, 0.06);
}

function buildDocument(n: number): Float32Array {
  // Baseado na imagem: folha com canto superior-direito dobrado
  // e linhas de texto internas.
  return sampleLines([
    // Corpo da folha
    [-1.1,  1.55,  -1.1, -1.72],   // lateral esquerda
    [-1.1, -1.72,   1.1, -1.72],   // base
    [ 1.1, -1.72,   1.1,  1.05],   // lateral direita (até o vinco)
    [-1.1,  1.55,   0.58, 1.55],   // topo (até o canto dobrado)
    // Canto dobrado (dog-ear)
    [ 0.58, 1.55,   1.1,  1.05],   // corte diagonal
    [ 0.58, 1.55,   0.58, 1.05],   // vinco vertical
    [ 0.58, 1.05,   1.1,  1.05],   // vinco horizontal
    // Linhas de texto (6 linhas)
    [-0.75, 0.82,   0.75, 0.82],
    [-0.75, 0.42,   0.75, 0.42],
    [-0.75, 0.02,   0.75, 0.02],
    [-0.75,-0.38,   0.75,-0.38],
    [-0.75,-0.78,   0.75,-0.78],
    [-0.75,-1.18,   0.42,-1.18],   // última linha mais curta
  ], n, 0.06);
}

function buildCheck(n: number): Float32Array {
  // Baseado na imagem: círculo com ✓ no centro.
  const R       = 1.72;
  const nCircle = Math.round(n * 0.58); // 58% no círculo
  const nMark   = n - nCircle;          // 42% no checkmark
  const out     = new Float32Array(n * 3);

  // Círculo
  for (let i = 0; i < nCircle; i++) {
    const a        = Math.random() * Math.PI * 2;
    out[i * 3]     = Math.cos(a) * R + (Math.random() - 0.5) * 0.04;
    out[i * 3 + 1] = Math.sin(a) * R + (Math.random() - 0.5) * 0.04;
    out[i * 3 + 2] = (Math.random() - 0.5) * 0.08;
  }

  // Checkmark — traço curto (esq→baixo) + traço longo (baixo→dir cima)
  const markPart = sampleLines([
    [-0.88, -0.12,  -0.14, -0.88],  // traço esquerdo curto
    [-0.14, -0.88,   0.88,  0.68],  // traço direito longo
  ], nMark, 0.09);
  out.set(markPart, nCircle * 3);

  return out;
}

/* ─── Componente ─────────────────────────────────────────────────────────── */
export function ParticleSphere() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    /* Pré-computa todas as posições uma única vez no mount */
    const phases = [
      buildSphere(N),
      buildHouse(N),
      buildDocument(N),
      buildCheck(N),
    ] as const;

    /* Buffer mutável — a BufferAttribute aponta para o mesmo Float32Array */
    const workBuf = phases[0].slice();

    /* ── Renderer ── */
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;";
    container.appendChild(renderer.domElement);

    /* ── Cena ── */
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.z = 7;

    /* ── Geometria ── */
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(workBuf, 3));
    const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;

    /* ── Shader ── */
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */`
        varying float vFade;
        void main() {
          float dist = length(position);
          // Esfera: fade nas partículas de névoa (dist 2→4.8)
          // Ícones 2D: dist ≤ 2, vFade ≈ 1.0 → totalmente opacos
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
          // Marrom-escuro — oklch(0.13 0.03 55)
          vec3 col = vec3(0.130, 0.102, 0.071);
          gl_FragColor = vec4(col, vFade * 0.85);
        }
      `,
      transparent: true,
      depthWrite: false,
    });

    const points = new THREE.Points(geo, mat);
    points.position.x = 1.4; // deslocado à direita como no Tailark
    scene.add(points);

    /* ── Loop de animação ── */
    let lastT  = performance.now();
    let totalT = 0;  // segundos acumulados
    let rotY   = 0;  // rotação Y acumulada
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
      const dt  = Math.min((now - lastT) / 1000, 0.05); // cap 50ms
      lastT   = now;
      totalT += dt;

      /* ── Fase e progresso de morphing ── */
      const elapsed  = totalT * 1000;             // ms
      const cycleT   = elapsed % CYCLE_MS;
      const phaseIdx = Math.min(
        Math.floor(cycleT / (HOLD_MS + MORPH_MS)),
        phases.length - 1,
      );
      const phaseT = cycleT - phaseIdx * (HOLD_MS + MORPH_MS);
      const morphT = phaseT > HOLD_MS
        ? easeInOutCubic(Math.min((phaseT - HOLD_MS) / MORPH_MS, 1))
        : 0;

      /* ── Interpola posições ── */
      const fromPos = phases[phaseIdx];
      const toPos   = phases[(phaseIdx + 1) % phases.length];
      for (let i = 0; i < N * 3; i++) {
        workBuf[i] = fromPos[i] + (toPos[i] - fromPos[i]) * morphT;
      }
      posAttr.needsUpdate = true;

      /* ── Rotação adaptativa ──
       * Esfera: gira rápido, desacelera ao sair.
       * Ícones 2D: quase estático (0.004 rad/s).
       * Retorno à esfera: acelera novamente.  */
      const isSpherePhase = phaseIdx === 0;
      const isLastPhase   = phaseIdx === phases.length - 1;
      const rotSpd =
        isSpherePhase ? 0.05 * (1 - morphT * 0.92)            :
        isLastPhase   ? 0.004 + morphT * 0.044                 :
        /* flat */       0.004;

      rotY           += dt * rotSpd;
      points.rotation.y = rotY;
      // Balanço no eixo X — só durante a fase esfera
      points.rotation.x = isSpherePhase
        ? Math.sin(totalT * 0.035) * 0.07 * (1 - morphT)
        : 0;

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
