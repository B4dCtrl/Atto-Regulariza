import { useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

interface HouseData {
  lat: number;
  lng: number;
  type: "irregular" | "regular";
  sz: number;
}

// Cidades brasileiras com imóveis irregulares (posições no globo)
const HOUSES: HouseData[] = [
  { lat: -23.5, lng: -46.6, type: "regular", sz: 1.1 },
  { lat: -22.9, lng: -43.2, type: "irregular", sz: 1.0 },
  { lat: -15.8, lng: -47.9, type: "regular", sz: 0.9 },
  { lat: -12.9, lng: -38.3, type: "irregular", sz: 0.85 },
  { lat: -8.1,  lng: -34.9, type: "regular",   sz: 0.9 },
  { lat: -3.1,  lng: -60.0, type: "irregular", sz: 0.8 },
  { lat: -30.0, lng: -51.2, type: "regular",   sz: 0.9 },
  { lat: -19.9, lng: -43.9, type: "irregular", sz: 1.0 },
  { lat: -25.4, lng: -49.3, type: "regular",   sz: 0.85 },
  { lat: -3.7,  lng: -38.5, type: "irregular", sz: 0.9 },
  { lat: -2.5,  lng: -44.3, type: "regular",   sz: 0.8 },
  { lat: -16.7, lng: -49.3, type: "irregular", sz: 0.85 },
  { lat: -10.9, lng: -37.1, type: "regular",   sz: 0.8 },
  { lat: -7.2,  lng: -35.9, type: "irregular", sz: 0.82 },
];

function project(
  lat: number,
  lng: number,
  rotY: number,
  R: number,
  cx: number,
  cy: number
) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + rotY) * Math.PI) / 180;
  const x = R * Math.sin(phi) * Math.sin(theta);
  const y = R * Math.cos(phi);
  const z = R * Math.sin(phi) * Math.cos(theta);
  return {
    sx: cx + x,
    sy: cy - y,
    z,
    depth: (z + R) / (2 * R), // 0 = fundo, 1 = frente
  };
}

function drawIrregularHouse(
  ctx: CanvasRenderingContext2D,
  s: number
) {
  ctx.rotate(-0.24);

  // Corpo
  ctx.fillStyle = "rgba(210, 52, 52, 0.88)";
  ctx.fillRect(-s * 0.4, -s * 0.28, s * 0.8, s * 0.6);

  // Telhado
  ctx.beginPath();
  ctx.moveTo(-s * 0.53, -s * 0.28);
  ctx.lineTo(0, -s * 0.78);
  ctx.lineTo(s * 0.53, -s * 0.28);
  ctx.closePath();
  ctx.fillStyle = "rgba(170, 28, 28, 0.92)";
  ctx.fill();

  // Rachadura
  ctx.beginPath();
  ctx.moveTo(s * 0.08, -s * 0.2);
  ctx.lineTo(s * 0.02, -s * 0.02);
  ctx.lineTo(s * 0.13, s * 0.14);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1;
  ctx.lineJoin = "round";
  ctx.stroke();

  // Porta
  ctx.fillStyle = "rgba(140, 22, 22, 0.65)";
  ctx.fillRect(-s * 0.1, s * 0.08, s * 0.2, s * 0.24);
}

function drawRegularHouse(
  ctx: CanvasRenderingContext2D,
  s: number
) {
  // Corpo terracota
  ctx.fillStyle = "rgba(172, 104, 62, 0.9)";
  ctx.beginPath();
  // roundRect via manual path for compatibility
  const bx = -s * 0.38, by = -s * 0.27, bw = s * 0.76, bh = s * 0.58, br = 2;
  ctx.moveTo(bx + br, by);
  ctx.lineTo(bx + bw - br, by);
  ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
  ctx.lineTo(bx + bw, by + bh - br);
  ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
  ctx.lineTo(bx + br, by + bh);
  ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
  ctx.lineTo(bx, by + br);
  ctx.quadraticCurveTo(bx, by, bx + br, by);
  ctx.closePath();
  ctx.fill();

  // Telhado
  ctx.beginPath();
  ctx.moveTo(-s * 0.5, -s * 0.27);
  ctx.lineTo(0, -s * 0.76);
  ctx.lineTo(s * 0.5, -s * 0.27);
  ctx.closePath();
  ctx.fillStyle = "rgba(128, 66, 28, 0.94)";
  ctx.fill();

  // Porta
  ctx.fillStyle = "rgba(92, 48, 18, 0.72)";
  ctx.fillRect(-s * 0.1, s * 0.06, s * 0.2, s * 0.25);

  // Selo de aprovação (círculo branco + check)
  ctx.beginPath();
  ctx.arc(s * 0.32, -s * 0.5, s * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.97)";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(s * 0.21, -s * 0.5);
  ctx.lineTo(s * 0.30, -s * 0.40);
  ctx.lineTo(s * 0.45, -s * 0.59);
  ctx.strokeStyle = "rgba(128, 66, 28, 1)";
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

export function GlobeAnimation() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startTimeRef = useRef(Date.now());
  const rafRef = useRef(0);

  useGSAP(
    () => {
      gsap.from(wrapRef.current, {
        opacity: 0,
        scale: 0.86,
        duration: 1.5,
        ease: "power3.out",
        delay: 0.25,
      });
    },
    { scope: wrapRef }
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    if (!ctx) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const SIZE = 440;
    canvas.width = SIZE * DPR;
    canvas.height = SIZE * DPR;
    canvas.style.width = `${SIZE}px`;
    canvas.style.height = `${SIZE}px`;
    ctx.scale(DPR, DPR);

    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const R = SIZE * 0.41;

    function drawSphere() {
      // Gradiente principal (iluminação do canto superior esquerdo)
      const grad = ctx.createRadialGradient(
        cx - R * 0.33, cy - R * 0.33, R * 0.04,
        cx, cy, R
      );
      grad.addColorStop(0,    "oklch(0.98 0.004 78)");
      grad.addColorStop(0.42, "oklch(0.948 0.010 74)");
      grad.addColorStop(0.78, "oklch(0.912 0.017 70)");
      grad.addColorStop(1,    "oklch(0.868 0.022 66)");

      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Reflexo especular
      const shine = ctx.createRadialGradient(
        cx - R * 0.4, cy - R * 0.4, 0,
        cx - R * 0.28, cy - R * 0.28, R * 0.54
      );
      shine.addColorStop(0, "rgba(255,255,255,0.40)");
      shine.addColorStop(1, "rgba(255,255,255,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = shine;
      ctx.fill();

      // Borda glassmorphism
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.58)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    function drawGrid(rotY: number) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R - 1, 0, Math.PI * 2);
      ctx.clip();

      // Linhas de latitude
      for (const lat of [-60, -30, 0, 30, 60]) {
        const phi = ((90 - lat) * Math.PI) / 180;
        const ry = cy - R * Math.cos(phi);
        const rx = R * Math.sin(phi);
        ctx.beginPath();
        ctx.ellipse(cx, ry, rx, rx * 0.13, 0, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(110, 80, 50, 0.15)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // Linhas de longitude
      for (let lng = 0; lng < 180; lng += 45) {
        const angle = ((lng + rotY) * Math.PI) / 180;
        const cosA = Math.cos(angle);
        if (Math.abs(cosA) < 0.06) continue;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.abs(cosA) * R, R, 0, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(110, 80, 50, 0.09)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      ctx.restore();
    }

    function drawHouseAt(
      sx: number,
      sy: number,
      type: "irregular" | "regular",
      depth: number,
      sz: number
    ) {
      // fade in/out conforme chega à borda do globo
      const opacity = Math.max(0, Math.min(1, (depth - 0.30) / 0.26));
      if (opacity < 0.03) return;

      ctx.save();
      ctx.globalAlpha = opacity * 0.95;
      ctx.translate(sx, sy);

      // Escala com perspectiva (mais longe = menor)
      const s = sz * (0.55 + depth * 0.6) * 20;

      if (type === "irregular") {
        drawIrregularHouse(ctx, s);
      } else {
        drawRegularHouse(ctx, s);
      }

      ctx.restore();
    }

    function draw() {
      ctx.clearRect(0, 0, SIZE, SIZE);

      // Rotação baseada no tempo (uma volta completa a cada 40s)
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const rotY = 220 + (elapsed / 40) * 360;

      drawSphere();
      drawGrid(rotY);

      // Projetar e ordenar do fundo para a frente
      const pts = HOUSES
        .map((h) => ({ ...h, ...project(h.lat, h.lng, rotY, R, cx, cy) }))
        .filter((h) => h.depth > 0.27)
        .sort((a, b) => a.depth - b.depth);

      for (const h of pts) {
        drawHouseAt(h.sx, h.sy, h.type, h.depth, h.sz);
      }

      // Escurecimento das bordas (limb darkening)
      const limb = ctx.createRadialGradient(cx, cy, R * 0.60, cx, cy, R);
      limb.addColorStop(0, "rgba(0,0,0,0)");
      limb.addColorStop(1, "rgba(38, 22, 8, 0.22)");
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = limb;
      ctx.fill();

      rafRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative flex items-center justify-center"
      style={{
        filter: "drop-shadow(0 28px 70px oklch(0.50 0.12 50 / 0.26))",
      }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{ borderRadius: "50%", display: "block" }}
      />
    </div>
  );
}
