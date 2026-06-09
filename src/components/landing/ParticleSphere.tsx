import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Esfera de partículas 3D — estilo Tailark, na paleta quente do Regulariza.
 * Areia dourada contra fundo marrom-escuro. Rotação lenta contínua.
 */
export function ParticleSphere() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;";
    container.appendChild(renderer.domElement);

    // ── Cena ──
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.z = 7;

    // ── Geometria de partículas ──
    const SURFACE = 16000; // na superfície da esfera
    const CLOUD = 5000;    // nuvem ao redor
    const TOTAL = SURFACE + CLOUD;
    const positions = new Float32Array(TOTAL * 3);

    for (let i = 0; i < TOTAL; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      // Superfície concentrada + cauda dispersa
      const r =
        i < SURFACE
          ? 2.0 + (Math.random() - 0.5) * 0.18
          : 2.1 + Math.random() * 2.2;
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    // ── Shader Material — cor areia quente do site ──
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */`
        varying float vFade;
        void main() {
          float dist = length(position);
          // partículas na superfície são maiores e mais opacas
          vFade = 1.0 - smoothstep(2.0, 4.8, dist);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float sz = 260.0 / -mv.z;
          gl_PointSize = clamp(sz * mix(0.4, 1.0, vFade), 0.3, 3.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */`
        varying float vFade;
        void main() {
          // Círculo limpo
          vec2 c = 2.0 * gl_PointCoord - 1.0;
          if (dot(c, c) > 1.0) discard;
          // Cor: marrom-escuro — oklch(0.13 0.03 55) ≈ #211a12
          vec3 col = vec3(0.130, 0.102, 0.071);
          gl_FragColor = vec4(col, vFade * 0.85);
        }
      `,
      transparent: true,
      depthWrite: false,
    });

    const points = new THREE.Points(geo, mat);
    // Deslocado para a direita, como no Tailark
    points.position.x = 1.4;
    scene.add(points);

    // ── Loop ──
    const clock = new THREE.Clock();
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
      const t = clock.getElapsedTime();
      points.rotation.y = t * 0.05;
      points.rotation.x = Math.sin(t * 0.035) * 0.07;
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
