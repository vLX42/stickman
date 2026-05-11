"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

// ---- Simulation constants -------------------------------------------------
const COLS = 80;
const ROWS = 80;
const ITER = 5;
const GRAVITY = -3.0;
const TORN_GRAVITY_MULT = 2.4;
const DAMPING = 0.992;
const PIN_EVERY = 8; // pin top row every Nth vertex
const TEAR_RADIUS_INIT = 0.08; // small — let the rip propagate organically
const TEAR_PUNCH = 0.045; // outward impulse magnitude (in position units)
const EDGE_WIDEN = 0.0035; // impulse applied when a constraint breaks
const MAX_EMBERS = 1400;

interface SceneState {
  dispose: () => void;
  reset: () => void;
}

// ---- Default texture: a richly colored procedural test card ---------------
function makeDefaultDataUrl(): string {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 1024;
  const ctx = c.getContext("2d")!;

  const grad = ctx.createLinearGradient(0, 0, 1024, 1024);
  grad.addColorStop(0, "#0f2a4a");
  grad.addColorStop(0.5, "#7e2553");
  grad.addColorStop(1, "#ff6b35");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);

  for (let i = 0; i < 80; i++) {
    const r = 30 + Math.random() * 140;
    ctx.fillStyle = `hsla(${Math.random() * 360}, 70%, 60%, 0.15)`;
    ctx.beginPath();
    ctx.arc(Math.random() * 1024, Math.random() * 1024, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 64; i++) {
    const p = (i / 64) * 1024;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, 1024);
    ctx.moveTo(0, p);
    ctx.lineTo(1024, p);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "bold 104px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("CLICK TO TEAR", 512, 480);
  ctx.font = "30px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("upload your own image →", 512, 552);

  return c.toDataURL("image/png");
}

// ===========================================================================
function buildScene(
  container: HTMLDivElement,
  texture: THREE.Texture,
  imgAspect: number,
): SceneState {
  // ---- Renderer / camera --------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = "none";
  renderer.domElement.style.cursor = "crosshair";

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    42,
    container.clientWidth / container.clientHeight,
    0.1,
    100,
  );
  camera.position.set(0, 0, 4.6);

  const planeH = 2.4;
  const planeW = planeH * imgAspect;

  // ---- Particle buffers ---------------------------------------------------
  const nVerts = (COLS + 1) * (ROWS + 1);
  const pos = new Float32Array(nVerts * 3);
  const prev = new Float32Array(nVerts * 3);
  const pinned = new Uint8Array(nVerts);
  const damage = new Float32Array(nVerts); // 0..1, accumulates from broken neighbors
  const aDissolveStart = new Float32Array(nVerts);
  const aDamage = new Float32Array(nVerts);

  const initParticles = () => {
    for (let i = 0; i <= ROWS; i++) {
      for (let j = 0; j <= COLS; j++) {
        const idx = i * (COLS + 1) + j;
        const x = (j / COLS - 0.5) * planeW;
        const y = (0.5 - i / ROWS) * planeH;
        // tiny z perturbation so the cloth doesn't render perfectly co-planar
        const z = (Math.random() - 0.5) * 0.003;
        pos[idx * 3] = x;
        pos[idx * 3 + 1] = y;
        pos[idx * 3 + 2] = z;
        prev[idx * 3] = x;
        prev[idx * 3 + 1] = y;
        prev[idx * 3 + 2] = z;
        const isPin = i === 0 && (j % PIN_EVERY === 0 || j === COLS);
        pinned[idx] = isPin ? 1 : 0;
        damage[idx] = 0;
        aDissolveStart[idx] = 1e9;
        aDamage[idx] = 0;
      }
    }
  };
  initParticles();

  // ---- Constraints --------------------------------------------------------
  // Three layers: structural (orthogonal), shear (diagonal), bend (skip-one).
  // Each constraint has its own break threshold so cracks zigzag naturally.
  interface Constraint {
    a: number;
    b: number;
    rest: number;
    breakAt: number;
    stiffness: number;
    broken: boolean;
  }
  let constraints: Constraint[] = [];

  const buildConstraints = () => {
    constraints = [];
    const add = (
      a: number,
      b: number,
      stiffness: number,
      breakMult: number,
    ) => {
      const dx = pos[a * 3] - pos[b * 3];
      const dy = pos[a * 3 + 1] - pos[b * 3 + 1];
      const dz = pos[a * 3 + 2] - pos[b * 3 + 2];
      const rest = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // Randomize break point per-constraint → jagged tears
      const noise = 0.78 + Math.random() * 0.55;
      constraints.push({
        a,
        b,
        rest,
        breakAt: rest * breakMult * noise,
        stiffness,
        broken: false,
      });
    };
    for (let i = 0; i <= ROWS; i++) {
      for (let j = 0; j <= COLS; j++) {
        const idx = i * (COLS + 1) + j;
        // Structural — strong, breakable
        if (j < COLS) add(idx, idx + 1, 1.0, 1.55);
        if (i < ROWS) add(idx, idx + (COLS + 1), 1.0, 1.55);
        // Shear — slightly weaker
        if (i < ROWS && j < COLS) add(idx, idx + (COLS + 1) + 1, 0.7, 1.7);
        if (i < ROWS && j > 0) add(idx, idx + (COLS + 1) - 1, 0.7, 1.7);
        // Bend — soft, prevents extreme folding, doesn't break visibly
        if (j < COLS - 1) add(idx, idx + 2, 0.18, 5.0);
        if (i < ROWS - 1) add(idx, idx + 2 * (COLS + 1), 0.18, 5.0);
      }
    }
  };
  buildConstraints();

  // ---- Cloth geometry -----------------------------------------------------
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(pos);
  const uvs = new Float32Array(nVerts * 2);
  for (let i = 0; i <= ROWS; i++) {
    for (let j = 0; j <= COLS; j++) {
      const idx = i * (COLS + 1) + j;
      uvs[idx * 2] = j / COLS;
      uvs[idx * 2 + 1] = 1 - i / ROWS;
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
  const dmgAttr = new THREE.BufferAttribute(aDamage, 1);
  dmgAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("aDamage", dmgAttr);
  geometry.setIndex(indices);

  // ---- Cloth material with organic dissolve shader ------------------------
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uTime: { value: 0 },
      uDissolveSpeed: { value: 0.9 },
      uEmber: { value: new THREE.Color(0xff7a1f) },
      uChar: { value: new THREE.Color(0x0b0604) },
    },
    transparent: true,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute float aDissolveStart;
      attribute float aDamage;
      varying vec2 vUv;
      varying float vDissolveStart;
      varying float vDamage;
      void main() {
        vUv = uv;
        vDissolveStart = aDissolveStart;
        vDamage = aDamage;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D uMap;
      uniform float uTime;
      uniform float uDissolveSpeed;
      uniform vec3 uEmber;
      uniform vec3 uChar;
      varying vec2 vUv;
      varying float vDissolveStart;
      varying float vDamage;

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
        for (int i = 0; i < 5; i++) {
          v += amp * vnoise(p);
          p = p * 2.03 + 17.1;
          amp *= 0.5;
        }
        return v;
      }

      void main() {
        vec4 base = texture2D(uMap, vUv);

        // Time since this vertex's dissolve started; +damage shortcut.
        float t = max(0.0, uTime - vDissolveStart) * uDissolveSpeed
                + vDamage * 0.35;

        // Domain-warp the UV so the dissolve edge looks ragged and fibrous,
        // not bubbly.
        vec2 q = vUv * vec2(7.0, 11.0);
        vec2 warp = vec2(fbm(q * 0.9 + 3.1), fbm(q * 0.9 + 7.3)) * 1.4;
        // Stretch along x so the threads look horizontal (weave-like)
        warp.x *= 1.6;
        float n = fbm(q + warp);

        // Small high-frequency overlay to suggest individual threads
        float fiber = vnoise(vUv * vec2(420.0, 90.0));
        n = mix(n, fiber, 0.06);

        float a = t - n;
        if (a > 0.05) discard;

        // Color bands as the dissolve edge approaches:
        //   far interior (a << 0): untouched
        //   approaching (a ~ -0.25..-0.05): scorch / char darken
        //   at edge      (a ~ -0.05..0.05): hot ember glow
        float scorch = smoothstep(-0.30, -0.08, a);
        float ember  = smoothstep(-0.10, 0.02, a);
        float hot    = smoothstep(-0.02, 0.04, a);

        vec3 col = base.rgb;
        col = mix(col, col * 0.35 + uChar, scorch * 0.9);
        col = mix(col, uEmber, ember * 0.85);
        col += uEmber * pow(hot, 3.0) * 2.2;
        col += vec3(2.4, 1.2, 0.4) * pow(hot, 8.0);

        // Subtle damage darkening on torn fragments (frayed edges)
        col *= 1.0 - vDamage * 0.25;

        gl_FragColor = vec4(col, base.a);
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // ---- Background ---------------------------------------------------------
  const bgGeo = new THREE.PlaneGeometry(40, 40);
  const bgMat = new THREE.MeshBasicMaterial({ color: 0x07080c });
  const bg = new THREE.Mesh(bgGeo, bgMat);
  bg.position.z = -4;
  scene.add(bg);

  // ---- Ember / ash particles ---------------------------------------------
  const embPos = new Float32Array(MAX_EMBERS * 3);
  const embVel = new Float32Array(MAX_EMBERS * 3);
  const embAge = new Float32Array(MAX_EMBERS);
  const embLife = new Float32Array(MAX_EMBERS);
  const embSize = new Float32Array(MAX_EMBERS);
  for (let i = 0; i < MAX_EMBERS; i++) {
    embAge[i] = 1e9;
    embLife[i] = 1;
    embPos[i * 3] = 0;
    embPos[i * 3 + 1] = -100;
    embPos[i * 3 + 2] = 0;
  }
  let embCursor = 0;

  const spawnEmber = (
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    size: number,
  ) => {
    const i = embCursor;
    embCursor = (embCursor + 1) % MAX_EMBERS;
    embPos[i * 3] = x;
    embPos[i * 3 + 1] = y;
    embPos[i * 3 + 2] = z;
    embVel[i * 3] = vx;
    embVel[i * 3 + 1] = vy;
    embVel[i * 3 + 2] = vz;
    embAge[i] = 0;
    embLife[i] = life;
    embSize[i] = size;
  };

  const embGeo = new THREE.BufferGeometry();
  const embPosAttr = new THREE.BufferAttribute(embPos, 3);
  embPosAttr.setUsage(THREE.DynamicDrawUsage);
  embGeo.setAttribute("position", embPosAttr);
  const embAgeAttr = new THREE.BufferAttribute(embAge, 1);
  embAgeAttr.setUsage(THREE.DynamicDrawUsage);
  embGeo.setAttribute("aAge", embAgeAttr);
  const embLifeAttr = new THREE.BufferAttribute(embLife, 1);
  embLifeAttr.setUsage(THREE.DynamicDrawUsage);
  embGeo.setAttribute("aLife", embLifeAttr);
  const embSizeAttr = new THREE.BufferAttribute(embSize, 1);
  embSizeAttr.setUsage(THREE.DynamicDrawUsage);
  embGeo.setAttribute("aSize", embSizeAttr);

  const embMat = new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: renderer.getPixelRatio() },
      uEmber: { value: new THREE.Color(0xff8a2a) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aAge;
      attribute float aLife;
      attribute float aSize;
      uniform float uPixelRatio;
      varying float vT;
      void main() {
        float t = clamp(aAge / max(aLife, 0.0001), 0.0, 1.0);
        vT = t;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        // Fade size near end of life
        float size = aSize * (1.0 - t * 0.6);
        gl_PointSize = size * uPixelRatio * 90.0 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uEmber;
      varying float vT;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float r = length(c);
        if (r > 0.5) discard;
        float falloff = smoothstep(0.5, 0.0, r);
        // Color: hot orange near birth → red → dark
        vec3 col = mix(vec3(2.8, 1.6, 0.5), uEmber, smoothstep(0.0, 0.4, vT));
        col = mix(col, vec3(0.15, 0.05, 0.02), smoothstep(0.5, 1.0, vT));
        float alpha = falloff * (1.0 - vT);
        gl_FragColor = vec4(col * alpha, alpha);
      }
    `,
  });
  const emberPoints = new THREE.Points(embGeo, embMat);
  emberPoints.frustumCulled = false;
  scene.add(emberPoints);

  // ---- Wind gusts (impact ripples) ---------------------------------------
  interface Gust {
    x: number;
    y: number;
    t0: number;
  }
  const gusts: Gust[] = [];
  const WAVE_SPEED = 1.4;
  const GUST_LIFE = 3.5;

  // ---- Click → tear -------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let dissolveTriggered = false;

  const clock = { elapsed: 0 };

  const tearAt = (worldPoint: THREE.Vector3) => {
    dissolveTriggered = true;
    const r2 = TEAR_RADIUS_INIT * TEAR_RADIUS_INIT;
    const cx = worldPoint.x;
    const cy = worldPoint.y;

    // Punch — strong outward impulse to particles in a small radius
    for (let v = 0; v < nVerts; v++) {
      const dx = pos[v * 3] - cx;
      const dy = pos[v * 3 + 1] - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r2) {
        const d = Math.sqrt(d2) + 1e-5;
        const fall = 1 - d / TEAR_RADIUS_INIT;
        const k = TEAR_PUNCH * fall;
        prev[v * 3] -= (dx / d) * k;
        prev[v * 3 + 1] -= (dy / d) * k;
        prev[v * 3 + 2] -= (Math.random() - 0.5) * k * 1.2;
        pinned[v] = 0;
      }
    }

    // Break a small kernel of constraints to start the rip
    for (let k = 0; k < constraints.length; k++) {
      const c = constraints[k];
      if (c.broken) continue;
      const mx = (pos[c.a * 3] + pos[c.b * 3]) * 0.5 - cx;
      const my = (pos[c.a * 3 + 1] + pos[c.b * 3 + 1]) * 0.5 - cy;
      if (mx * mx + my * my < r2 * 0.6) breakConstraint(c);
    }

    gusts.push({ x: cx, y: cy, t0: clock.elapsed });
  };

  const breakConstraint = (c: Constraint) => {
    if (c.broken) return;
    c.broken = true;
    // Damage and dissolve scheduling for endpoints
    damage[c.a] = Math.min(1, damage[c.a] + 0.28);
    damage[c.b] = Math.min(1, damage[c.b] + 0.28);
    aDamage[c.a] = damage[c.a];
    aDamage[c.b] = damage[c.b];
    if (aDissolveStart[c.a] > clock.elapsed) {
      aDissolveStart[c.a] = clock.elapsed + 0.15 + Math.random() * 0.25;
    }
    if (aDissolveStart[c.b] > clock.elapsed) {
      aDissolveStart[c.b] = clock.elapsed + 0.15 + Math.random() * 0.25;
    }
    dmgAttr.needsUpdate = true;
    dsAttr.needsUpdate = true;

    // Push endpoints apart slightly so the crack widens visually
    const ai = c.a * 3;
    const bi = c.b * 3;
    const dx = pos[bi] - pos[ai];
    const dy = pos[bi + 1] - pos[ai + 1];
    const dz = pos[bi + 2] - pos[ai + 2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6;
    const nx = dx / d;
    const ny = dy / d;
    const nz = dz / d;
    if (!pinned[c.a]) {
      prev[ai] += nx * EDGE_WIDEN;
      prev[ai + 1] += ny * EDGE_WIDEN;
      prev[ai + 2] += nz * EDGE_WIDEN;
    }
    if (!pinned[c.b]) {
      prev[bi] -= nx * EDGE_WIDEN;
      prev[bi + 1] -= ny * EDGE_WIDEN;
      prev[bi + 2] -= nz * EDGE_WIDEN;
    }

    // Spawn embers at the break midpoint
    const mx = (pos[ai] + pos[bi]) * 0.5;
    const my = (pos[ai + 1] + pos[bi + 1]) * 0.5;
    const mz = (pos[ai + 2] + pos[bi + 2]) * 0.5;
    const count = 1 + (Math.random() < 0.3 ? 1 : 0);
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 0.25 + Math.random() * 0.6;
      spawnEmber(
        mx,
        my,
        mz,
        Math.cos(ang) * spd * 0.4,
        Math.abs(Math.sin(ang)) * spd * 0.7 + 0.15,
        (Math.random() - 0.5) * 0.3,
        0.8 + Math.random() * 1.2,
        2 + Math.random() * 3,
      );
    }
  };

  const onPointer = (e: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObject(mesh, false);
    if (hits.length) tearAt(hits[0].point);
  };
  renderer.domElement.addEventListener("pointerdown", onPointer);

  // ---- Simulation step ----------------------------------------------------
  const threeClock = new THREE.Clock();
  const fixedDt = 1 / 60;
  let acc = 0;

  const step = (dt: number) => {
    const now = clock.elapsed;
    const dt2 = dt * dt;

    // Cull expired gusts
    for (let g = gusts.length - 1; g >= 0; g--) {
      if (now - gusts[g].t0 > GUST_LIFE) gusts.splice(g, 1);
    }

    // Ambient breeze (very subtle)
    const ambient =
      Math.sin(now * 1.1) * 0.04 + Math.sin(now * 0.6 + 1.7) * 0.03;

    // Verlet
    for (let v = 0; v < nVerts; v++) {
      if (pinned[v]) continue;
      const ix = v * 3;
      const iy = ix + 1;
      const iz = ix + 2;
      const vx = (pos[ix] - prev[ix]) * DAMPING;
      const vy = (pos[iy] - prev[iy]) * DAMPING;
      const vz = (pos[iz] - prev[iz]) * DAMPING;

      let ax = 0;
      let az = ambient;
      for (let gi = 0; gi < gusts.length; gi++) {
        const g = gusts[gi];
        const age = now - g.t0;
        const fade = Math.exp(-age * 0.85);
        const dx = pos[ix] - g.x;
        const dy = pos[iy] - g.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const front = d - age * WAVE_SPEED;
        const pulse =
          Math.exp(-(front * front) * 40) * Math.cos(front * 20);
        az += fade * pulse * 22;
        const flutter =
          Math.sin(now * 5.5 + d * 9) * Math.exp(-age * 0.7) * 0.22;
        az += flutter;
        ax += flutter * 0.3;
      }

      const gMult = damage[v] > 0 ? TORN_GRAVITY_MULT : 1.0;

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

        // Stretch-based break — uses the constraint's own breakAt
        if (d > c.breakAt) {
          breakConstraint(c);
          continue;
        }

        const diff = ((d - c.rest) / d) * c.stiffness * 0.5;
        const offX = dx * diff;
        const offY = dy * diff;
        const offZ = dz * diff;
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

  // ---- Dissolve propagation (creeps inward from torn edges) ---------------
  const propagateDissolve = (dt: number) => {
    const now = clock.elapsed;
    // For each particle whose dissolve has begun, seed neighbors with a
    // small delayed dissolve so the burn slowly eats into intact cloth.
    const targetDelay = 0.4 / Math.max(dt, 0.001); // controls inward speed
    for (let i = 0; i <= ROWS; i++) {
      for (let j = 0; j <= COLS; j++) {
        const idx = i * (COLS + 1) + j;
        if (aDissolveStart[idx] > now - 0.05) continue;
        const cap = now + 0.35 + Math.random() * 0.6;
        const tryProp = (n: number) => {
          if (aDissolveStart[n] > cap) {
            aDissolveStart[n] = cap;
          }
        };
        if (j > 0) tryProp(idx - 1);
        if (j < COLS) tryProp(idx + 1);
        if (i > 0) tryProp(idx - (COLS + 1));
        if (i < ROWS) tryProp(idx + (COLS + 1));
      }
    }
    dsAttr.needsUpdate = true;
    void targetDelay;
  };

  // ---- Embers update ------------------------------------------------------
  const stepEmbers = (dt: number) => {
    for (let i = 0; i < MAX_EMBERS; i++) {
      if (embAge[i] >= embLife[i]) continue;
      embAge[i] += dt;
      const ix = i * 3;
      // Light buoyant ash physics — rise then fall
      embVel[ix + 1] += (0.5 - embAge[i] * 0.6) * dt; // updraft fades
      embVel[ix + 1] += GRAVITY * 0.05 * dt;
      embVel[ix] += (Math.random() - 0.5) * 0.4 * dt;
      embVel[ix + 2] += (Math.random() - 0.5) * 0.4 * dt;
      embPos[ix] += embVel[ix] * dt;
      embPos[ix + 1] += embVel[ix + 1] * dt;
      embPos[ix + 2] += embVel[ix + 2] * dt;
    }
    embPosAttr.needsUpdate = true;
    embAgeAttr.needsUpdate = true;
  };

  // ---- Main loop ----------------------------------------------------------
  let rafId = 0;
  let globalBurnStart = -1;

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
      // After a beat, also start eating the cloth from the outer edges so
      // even untouched regions eventually disintegrate.
      if (globalBurnStart < 0) globalBurnStart = clock.elapsed + 1.6;
      if (clock.elapsed > globalBurnStart) {
        const seed = clock.elapsed + (clock.elapsed - globalBurnStart) * 0.4;
        for (let s = 0; s < 4; s++) {
          const onTop = Math.random() < 0.5;
          const i = onTop ? 0 : ROWS;
          const j = Math.floor(Math.random() * (COLS + 1));
          const idx = i * (COLS + 1) + j;
          if (aDissolveStart[idx] > seed) aDissolveStart[idx] = seed;
        }
        for (let s = 0; s < 2; s++) {
          const j = Math.random() < 0.5 ? 0 : COLS;
          const i = Math.floor(Math.random() * (ROWS + 1));
          const idx = i * (COLS + 1) + j;
          if (aDissolveStart[idx] > seed) aDissolveStart[idx] = seed;
        }
      }
      propagateDissolve(dt);
    }

    stepEmbers(dt);

    posAttr.needsUpdate = true;
    material.uniforms.uTime.value = clock.elapsed;
    renderer.render(scene, camera);
  };
  tick();

  // ---- Resize -------------------------------------------------------------
  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    embMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  };
  window.addEventListener("resize", onResize);

  // ---- Reset --------------------------------------------------------------
  const reset = () => {
    initParticles();
    buildConstraints();
    for (let v = 0; v < nVerts; v++) {
      aDissolveStart[v] = 1e9;
      aDamage[v] = 0;
    }
    for (let i = 0; i < MAX_EMBERS; i++) {
      embAge[i] = 1e9;
      embPos[i * 3 + 1] = -100;
    }
    gusts.length = 0;
    positions.set(pos);
    posAttr.needsUpdate = true;
    dsAttr.needsUpdate = true;
    dmgAttr.needsUpdate = true;
    embPosAttr.needsUpdate = true;
    embAgeAttr.needsUpdate = true;
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
      embGeo.dispose();
      embMat.dispose();
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

// ===========================================================================
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
          "radial-gradient(circle at 50% 35%, #1a1d28 0%, #06070a 75%)",
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
              maxWidth: 380,
            }}
          >
            Click the fabric — a jagged tear rips outward, embers fly, and
            the rest slowly burns away.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, pointerEvents: "auto" }}>
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
