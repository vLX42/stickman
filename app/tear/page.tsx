"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const COLS = 90;
const ROWS = 90;
const ITER = 4;
const GRAVITY = -3.2;
const TORN_GRAVITY_MULT = 2.6;
const DAMPING = 0.985;
const TEAR_RADIUS = 0.18;
const IMPULSE = 1.2;
const DISSOLVE_SPEED = 0.9;
const SPREAD_PER_SEC = 9.0;

interface SceneState {
  dispose: () => void;
  reset: () => void;
}

function makeDefaultDataUrl(): string {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 1024;
  const ctx = c.getContext("2d")!;

  const grad = ctx.createLinearGradient(0, 0, 1024, 1024);
  grad.addColorStop(0, "#1d2b53");
  grad.addColorStop(0.5, "#7e2553");
  grad.addColorStop(1, "#ff004d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);

  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 16; i++) {
    const p = (i / 16) * 1024;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, 1024);
    ctx.moveTo(0, p);
    ctx.lineTo(1024, p);
    ctx.stroke();
  }

  for (let i = 0; i < 60; i++) {
    const r = 20 + Math.random() * 80;
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    ctx.fillStyle = `hsla(${Math.random() * 360}, 80%, 65%, 0.18)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "bold 96px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("CLICK TO TEAR", 512, 480);
  ctx.font = "32px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("upload your own image →", 512, 560);

  return c.toDataURL("image/png");
}

function buildScene(
  container: HTMLDivElement,
  texture: THREE.Texture,
  imgAspect: number,
): SceneState {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = "none";
  renderer.domElement.style.cursor = "crosshair";

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    100,
  );
  camera.position.set(0, 0, 4.2);

  const planeH = 2.2;
  const planeW = planeH * imgAspect;

  // Particle data
  const nVerts = (COLS + 1) * (ROWS + 1);
  const pos = new Float32Array(nVerts * 3);
  const prev = new Float32Array(nVerts * 3);
  const pinned = new Uint8Array(nVerts);
  const torn = new Uint8Array(nVerts);
  const dissolveStart = new Float32Array(nVerts);

  const initParticles = () => {
    for (let i = 0; i <= ROWS; i++) {
      for (let j = 0; j <= COLS; j++) {
        const idx = i * (COLS + 1) + j;
        const x = (j / COLS - 0.5) * planeW;
        const y = (0.5 - i / ROWS) * planeH;
        const z = (Math.random() - 0.5) * 0.002;
        pos[idx * 3] = x;
        pos[idx * 3 + 1] = y;
        pos[idx * 3 + 2] = z;
        prev[idx * 3] = x;
        prev[idx * 3 + 1] = y;
        prev[idx * 3 + 2] = z;
        // Pin top row at discrete points (like thumbtacks) so the cloth
        // sags naturally between them instead of forming a perfectly
        // straight edge.
        const isPin =
          i === 0 && (j % 10 === 0 || j === COLS);
        pinned[idx] = isPin ? 1 : 0;
        torn[idx] = 0;
        dissolveStart[idx] = 1e9;
      }
    }
  };
  initParticles();

  // Constraints
  interface Constraint {
    a: number;
    b: number;
    rest: number;
    broken: boolean;
  }
  let constraints: Constraint[] = [];
  const buildConstraints = () => {
    constraints = [];
    const add = (a: number, b: number) => {
      const dx = pos[a * 3] - pos[b * 3];
      const dy = pos[a * 3 + 1] - pos[b * 3 + 1];
      const dz = pos[a * 3 + 2] - pos[b * 3 + 2];
      constraints.push({
        a,
        b,
        rest: Math.sqrt(dx * dx + dy * dy + dz * dz),
        broken: false,
      });
    };
    for (let i = 0; i <= ROWS; i++) {
      for (let j = 0; j <= COLS; j++) {
        const idx = i * (COLS + 1) + j;
        if (j < COLS) add(idx, idx + 1);
        if (i < ROWS) add(idx, idx + (COLS + 1));
        // shear (diagonals) for stability
        if (i < ROWS && j < COLS) add(idx, idx + (COLS + 1) + 1);
        if (i < ROWS && j > 0) add(idx, idx + (COLS + 1) - 1);
      }
    }
  };
  buildConstraints();

  // Geometry
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(pos);
  const uvs = new Float32Array(nVerts * 2);
  const aDissolveStart = new Float32Array(nVerts);
  for (let i = 0; i <= ROWS; i++) {
    for (let j = 0; j <= COLS; j++) {
      const idx = i * (COLS + 1) + j;
      uvs[idx * 2] = j / COLS;
      uvs[idx * 2 + 1] = 1 - i / ROWS;
      aDissolveStart[idx] = 1e9;
    }
  }
  const indices: number[] = [];
  for (let i = 0; i < ROWS; i++) {
    for (let j = 0; j < COLS; j++) {
      const a = i * (COLS + 1) + j;
      const b = a + 1;
      const c = a + (COLS + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const posAttr = new THREE.BufferAttribute(positions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", posAttr);
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  const dsAttr = new THREE.BufferAttribute(aDissolveStart, 1);
  dsAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("aDissolveStart", dsAttr);
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uTime: { value: 0 },
      uDissolveSpeed: { value: DISSOLVE_SPEED },
      uEdgeColor: { value: new THREE.Color(0xff7a2a) },
    },
    transparent: true,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute float aDissolveStart;
      varying vec2 vUv;
      varying float vDissolveStart;
      void main() {
        vUv = uv;
        vDissolveStart = aDissolveStart;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D uMap;
      uniform float uTime;
      uniform float uDissolveSpeed;
      uniform vec3 uEdgeColor;
      varying vec2 vUv;
      varying float vDissolveStart;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 4; i++) {
          v += amp * vnoise(p);
          p *= 2.07;
          amp *= 0.5;
        }
        return v;
      }

      void main() {
        vec4 base = texture2D(uMap, vUv);

        float t = max(0.0, uTime - vDissolveStart) * uDissolveSpeed;
        float n = fbm(vUv * 10.0);
        // Add a swirling streak so the dissolve looks organic
        n = mix(n, fbm(vUv * 22.0 + vec2(uTime * 0.05, 0.0)), 0.35);

        float a = t - n;
        if (a > 0.0) discard;

        // Edge glow
        float edge = smoothstep(-0.12, 0.0, a);
        vec3 col = mix(base.rgb, uEdgeColor, edge);
        // Slight darkening at the very near-edge for embers
        col += uEdgeColor * pow(edge, 4.0) * 1.5;

        gl_FragColor = vec4(col, base.a);
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // Subtle backdrop
  const bgGeo = new THREE.PlaneGeometry(20, 20);
  const bgMat = new THREE.MeshBasicMaterial({ color: 0x0b0d12 });
  const bg = new THREE.Mesh(bgGeo, bgMat);
  bg.position.z = -3;
  scene.add(bg);

  // Interaction
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let dissolveTriggered = false;

  // Wind gusts triggered by impacts (traveling ripple + lingering flutter)
  interface Gust {
    x: number;
    y: number;
    t0: number;
    strength: number;
  }
  const gusts: Gust[] = [];
  const WAVE_SPEED = 1.6;
  const GUST_LIFE = 3.0;

  const tearAt = (worldPoint: THREE.Vector3) => {
    dissolveTriggered = true;
    const r2 = TEAR_RADIUS * TEAR_RADIUS;
    const cx = worldPoint.x;
    const cy = worldPoint.y;

    for (let v = 0; v < nVerts; v++) {
      const dx = pos[v * 3] - cx;
      const dy = pos[v * 3 + 1] - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r2) {
        // outward impulse
        const d = Math.sqrt(d2) + 1e-5;
        const nx = dx / d;
        const ny = dy / d;
        const fall = 1 - d / TEAR_RADIUS;
        prev[v * 3] = pos[v * 3] - nx * IMPULSE * fall * 0.02;
        prev[v * 3 + 1] = pos[v * 3 + 1] - ny * IMPULSE * fall * 0.02;
        prev[v * 3 + 2] = pos[v * 3 + 2] - (Math.random() - 0.5) * 0.04;
        pinned[v] = 0;
        torn[v] = 1;
        if (aDissolveStart[v] > clock.elapsed) {
          aDissolveStart[v] = clock.elapsed + 0.1 * (1 - fall);
        }
      }
    }
    // Break constraints whose midpoint is in radius
    for (let k = 0; k < constraints.length; k++) {
      const c = constraints[k];
      if (c.broken) continue;
      const mx = (pos[c.a * 3] + pos[c.b * 3]) * 0.5 - cx;
      const my = (pos[c.a * 3 + 1] + pos[c.b * 3 + 1]) * 0.5 - cy;
      if (mx * mx + my * my < r2 * 1.1) {
        c.broken = true;
        torn[c.a] = 1;
        torn[c.b] = 1;
      }
    }
    dsAttr.needsUpdate = true;

    gusts.push({
      x: cx,
      y: cy,
      t0: clock.elapsed,
      strength: 1.0,
    });
  };

  const onPointer = (e: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObject(mesh, false);
    if (hits.length) {
      tearAt(hits[0].point);
    }
  };
  renderer.domElement.addEventListener("pointerdown", onPointer);

  // Simulation loop
  const clock = { elapsed: 0 };
  const threeClock = new THREE.Clock();
  const fixedDt = 1 / 60;
  let acc = 0;

  const step = (dt: number) => {
    const now = clock.elapsed;

    // Cull expired gusts
    for (let g = gusts.length - 1; g >= 0; g--) {
      if (now - gusts[g].t0 > GUST_LIFE) gusts.splice(g, 1);
    }

    // Ambient breeze
    const ambient =
      Math.sin(now * 1.3) * 0.05 + Math.sin(now * 0.7 + 1.2) * 0.04;

    // Verlet integration with wind & gust shockwave
    const dt2 = dt * dt;
    for (let v = 0; v < nVerts; v++) {
      if (pinned[v]) continue;
      const ix = v * 3;
      const iy = ix + 1;
      const iz = ix + 2;
      const vx = (pos[ix] - prev[ix]) * DAMPING;
      const vy = (pos[iy] - prev[iy]) * DAMPING;
      const vz = (pos[iz] - prev[iz]) * DAMPING;

      // Wind accumulators (in acceleration units)
      let ax = 0;
      let az = ambient;

      for (let gi = 0; gi < gusts.length; gi++) {
        const g = gusts[gi];
        const age = now - g.t0;
        const fade = Math.exp(-age * 1.0);
        const dx = pos[ix] - g.x;
        const dy = pos[iy] - g.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        // Traveling shockwave: gaussian pulse around wavefront
        const front = d - age * WAVE_SPEED;
        const pulse =
          Math.exp(-(front * front) * 35) * Math.cos(front * 18);
        // Push primarily out of plane (Z) so cloth visibly waves
        az += g.strength * fade * pulse * 18;
        // Lingering flutter — gentle sustained breeze that decays
        const flutter =
          Math.sin(now * 6.0 + d * 9) * Math.exp(-age * 0.7) * 0.25;
        az += g.strength * flutter;
        ax += g.strength * flutter * 0.4;
      }

      const gMult = torn[v] ? TORN_GRAVITY_MULT : 1.0;

      prev[ix] = pos[ix];
      prev[iy] = pos[iy];
      prev[iz] = pos[iz];
      pos[ix] += vx + ax * dt2;
      pos[iy] += vy + GRAVITY * gMult * dt2;
      pos[iz] += vz + az * dt2;
    }

    // Constraint relaxation
    for (let it = 0; it < ITER; it++) {
      for (let k = 0; k < constraints.length; k++) {
        const c = constraints[k];
        if (c.broken) continue;
        const ai = c.a * 3;
        const bi = c.b * 3;
        const dx = pos[bi] - pos[ai];
        const dy = pos[bi + 1] - pos[ai + 1];
        const dz = pos[bi + 2] - pos[ai + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-8;
        // Break if overstretched
        if (d > c.rest * 2.2) {
          c.broken = true;
          torn[c.a] = 1;
          torn[c.b] = 1;
          continue;
        }
        const diff = (d - c.rest) / d;
        const offX = dx * 0.5 * diff;
        const offY = dy * 0.5 * diff;
        const offZ = dz * 0.5 * diff;
        const ap = pinned[c.a];
        const bp = pinned[c.b];
        if (!ap && !bp) {
          pos[ai] += offX;
          pos[ai + 1] += offY;
          pos[ai + 2] += offZ;
          pos[bi] -= offX;
          pos[bi + 1] -= offY;
          pos[bi + 2] -= offZ;
        } else if (ap && !bp) {
          pos[bi] -= offX * 2;
          pos[bi + 1] -= offY * 2;
          pos[bi + 2] -= offZ * 2;
        } else if (!ap && bp) {
          pos[ai] += offX * 2;
          pos[ai + 1] += offY * 2;
          pos[ai + 2] += offZ * 2;
        }
      }
    }
  };

  const spreadDissolve = (dt: number) => {
    // Propagate dissolve to neighbors of already-dissolving particles
    const now = clock.elapsed;
    const reach = SPREAD_PER_SEC * dt;
    for (let i = 0; i <= ROWS; i++) {
      for (let j = 0; j <= COLS; j++) {
        const idx = i * (COLS + 1) + j;
        const ds = aDissolveStart[idx];
        if (ds > now) continue;
        // This vertex is dissolving — propagate
        const propTime = now - reach * 0.03;
        const tryProp = (n: number) => {
          if (aDissolveStart[n] > propTime + 0.15) {
            aDissolveStart[n] = propTime + 0.15 + Math.random() * 0.1;
          }
        };
        if (j > 0) tryProp(idx - 1);
        if (j < COLS) tryProp(idx + 1);
        if (i > 0) tryProp(idx - (COLS + 1));
        if (i < ROWS) tryProp(idx + (COLS + 1));
      }
    }
    dsAttr.needsUpdate = true;
  };

  // After first tear, also flag a global slow burn so even untouched cloth dissolves eventually
  let globalBurnStart = -1;
  let rafId = 0;
  const tick = () => {
    rafId = requestAnimationFrame(tick);
    const dt = Math.min(threeClock.getDelta(), 0.05);
    clock.elapsed += dt;
    acc += dt;
    while (acc >= fixedDt) {
      step(fixedDt);
      acc -= fixedDt;
    }

    if (dissolveTriggered) {
      if (globalBurnStart < 0) globalBurnStart = clock.elapsed + 1.2;
      if (clock.elapsed > globalBurnStart) {
        // Slowly seed dissolve on edges so it consumes the rest
        const seed = clock.elapsed + (clock.elapsed - globalBurnStart) * 0.3;
        for (let s = 0; s < 6; s++) {
          const i = Math.random() < 0.5 ? 0 : ROWS;
          const j = Math.floor(Math.random() * (COLS + 1));
          const idx = i * (COLS + 1) + j;
          if (aDissolveStart[idx] > seed) aDissolveStart[idx] = seed;
        }
      }
      spreadDissolve(dt);
    }

    posAttr.needsUpdate = true;
    material.uniforms.uTime.value = clock.elapsed;
    renderer.render(scene, camera);
  };
  tick();

  // Resize
  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", onResize);

  const reset = () => {
    initParticles();
    buildConstraints();
    for (let v = 0; v < nVerts; v++) {
      aDissolveStart[v] = 1e9;
      torn[v] = 0;
    }
    gusts.length = 0;
    positions.set(pos);
    posAttr.needsUpdate = true;
    dsAttr.needsUpdate = true;
    dissolveTriggered = false;
    globalBurnStart = -1;
  };

  return {
    dispose: () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointerdown", onPointer);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      texture.dispose();
      bgGeo.dispose();
      bgMat.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    },
    reset,
  };
}

export default function TearPage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneState | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(() =>
    typeof window === "undefined" ? null : makeDefaultDataUrl(),
  );
  const [hasTorn, setHasTorn] = useState(false);

  useEffect(() => {
    if (!mountRef.current || !imageUrl) return;
    const mount = mountRef.current;

    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.load(imageUrl, (texture) => {
      if (cancelled) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      const img = texture.image as HTMLImageElement;
      const aspect = img.width / img.height || 1;
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
      sceneRef.current = buildScene(mount, texture, aspect);
    });

    return () => {
      cancelled = true;
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
    };
  }, [imageUrl]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageUrl(reader.result);
        setHasTorn(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const onReset = () => {
    sceneRef.current?.reset();
    setHasTorn(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background:
          "radial-gradient(circle at 50% 40%, #1a1d28 0%, #07080c 70%)",
        color: "#fff",
        overflow: "hidden",
      }}
    >
      <div
        ref={mountRef}
        onPointerDown={() => setHasTorn(true)}
        style={{ position: "absolute", inset: 0 }}
      />

      <div
        style={{
          position: "absolute",
          top: 24,
          left: 24,
          right: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          pointerEvents: "none",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ pointerEvents: "auto" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>
            Cloth Tear & Dissolve
          </h1>
          <p
            style={{
              fontSize: 13,
              opacity: 0.65,
              marginTop: 4,
              maxWidth: 360,
            }}
          >
            Click anywhere on the image to rip the fabric. The rest will
            slowly dissolve away.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            pointerEvents: "auto",
          }}
        >
          <label
            style={{
              padding: "8px 14px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8,
              fontSize: 13,
              cursor: "pointer",
              backdropFilter: "blur(8px)",
            }}
          >
            Upload image
            <input
              type="file"
              accept="image/*"
              onChange={onFile}
              style={{ display: "none" }}
            />
          </label>
          <button
            onClick={onReset}
            style={{
              padding: "8px 14px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8,
              fontSize: 13,
              cursor: "pointer",
              color: "inherit",
              backdropFilter: "blur(8px)",
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {!hasTorn && (
        <div
          style={{
            position: "absolute",
            bottom: 32,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 13,
            opacity: 0.5,
            pointerEvents: "none",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          ⟶ click the cloth
        </div>
      )}
    </div>
  );
}
