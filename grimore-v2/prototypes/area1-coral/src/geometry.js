/**
 * geometry.js — every mesh in Area 1 is generated here from `params`. No model files,
 * no textures: the whole diorama is procedural so any shape decision stays a slider.
 *
 * Vertex contract shared by all world geometry:
 *   position (vec3)
 *   normal   (vec3)
 *   aSurf    (vec4)  x = 0..1 height along the object (root→tip): drives tip colour + sway
 *                    y = 0..1 ambient occlusion proxy (1 = open)
 *                    z = 0..1 local thickness for the translucency term (1 = paper-thin)
 *                    w = 0..1 per-vertex random, for detail decorrelation
 *
 * Instanced meshes additionally carry:
 *   iColor   (vec3)  per-instance albedo
 *   iParams  (vec4)  x = thickness multiplier, y = emissive gain,
 *                    z = sway amplitude,       w = animation phase
 */

import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeRng, rand, makePerlin, makeFbm } from './noise.js';

/* ================================================================== *
 * Small mesh accumulator
 * ================================================================== */

class MeshBuilder {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.surf = [];
    this.idx = [];
  }

  get vertexCount() {
    return this.pos.length / 3;
  }

  vertex(px, py, pz, nx, ny, nz, h, ao, thick, rnd) {
    this.pos.push(px, py, pz);
    this.nor.push(nx, ny, nz);
    this.surf.push(h, ao, thick, rnd);
    return this.vertexCount - 1;
  }

  tri(a, b, c) {
    this.idx.push(a, b, c);
  }

  quad(a, b, c, d) {
    this.idx.push(a, b, c, a, c, d);
  }

  toGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aSurf', new THREE.Float32BufferAttribute(this.surf, 4));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

/** Orthonormal basis around `dir` (assumed normalised). */
function basisFrom(dir, outU, outV) {
  // `up` MUST NOT share a scratch vector with `dir`. Callers hold `dir` in _vTmpA, so
  // writing `up` there made the two the same object: cross(dir, dir) is the zero vector,
  // both basis vectors normalised to zero, and every tube ring collapsed onto its own
  // centre line. The result still had a plausible bounding box and finite attributes —
  // it just had zero area, so every coral built from addSegment rendered nothing at all.
  const up = Math.abs(dir.y) > 0.94 ? _vUp.set(1, 0, 0) : _vUp.set(0, 1, 0);
  outU.crossVectors(up, dir).normalize();
  outV.crossVectors(dir, outU).normalize();
}

const _vTmpA = new THREE.Vector3();
const _vUp = new THREE.Vector3();
const _vU = new THREE.Vector3();
const _vV = new THREE.Vector3();
const _vN = new THREE.Vector3();

/* ================================================================== *
 * Terrain — radial disc, dense near the camera, fading into fog
 * ================================================================== */

/**
 * Analytic height field. Kept as an object so scatter passes can place every coral
 * exactly on the surface without reading back the mesh.
 */
export function makeTerrainField(p) {
  const perlin = makePerlin(p.seed);
  const fbm = makeFbm(perlin, { octaves: p.octaves, gain: 0.5, lacunarity: 2.05, ridged: p.ridged });
  const step = p.terraceSteps > 0 ? 1 / p.terraceSteps : 0;

  function height(x, z) {
    let h = fbm(x * p.noiseScale, 13.7, z * p.noiseScale);
    // Ridged fbm lands in a different range; normalise both to roughly [-0.5, 0.9].
    h = p.ridged ? h * 0.9 - 0.35 : h;

    if (step > 0 && p.terraceAmount > 0) {
      const t = h / step;
      const base = Math.floor(t);
      const frac = t - base;
      // Smoothstep the riser so terraces read as eroded shelves, not stairs.
      const eased = frac * frac * (3 - 2 * frac);
      const terraced = (base + eased) * step;
      h = h + (terraced - h) * p.terraceAmount;
    }

    h *= p.heightScale;

    // Valley walls. The reference frame has no horizon anywhere in it: the ground rises on
    // both sides into coral banks that close the composition and funnel the eye toward the
    // bright core. An open plain with a visible horizon reads as a different location
    // entirely, so the gully is modelled explicitly instead of hoped for out of the fbm.
    if (p.valleyRise > 0) {
      const along = Math.max(0, p.valleyOriginZ - z);
      const halfWidth = Math.max(0.5, p.valleyWidth + along * p.valleyFlare);
      const t = Math.max(0, (Math.abs(x - p.valleyOriginX) - halfWidth) / Math.max(0.5, p.valleyRamp));
      h += Math.min(Math.pow(t, p.valleyCurve), p.valleyClamp) * p.valleyRise;
      // The floor tilts up as it recedes so the far end of the corridor closes off too.
      const far = Math.min(along / Math.max(1, p.valleyLength), 1);
      h += far * far * p.valleyLift;
    }

    if (p.basinRadius > 0 && p.basinDepth > 0) {
      const d = Math.sqrt(x * x + (z + 2.0) * (z + 2.0)) / p.basinRadius;
      const bowl = Math.max(0, 1 - d * d);
      h -= bowl * bowl * p.basinDepth;
    }
    return h;
  }

  function normal(x, z, eps = 0.35) {
    const hx = height(x + eps, z) - height(x - eps, z);
    const hz = height(x, z + eps) - height(x, z - eps);
    return _vN.set(-hx, 2 * eps, -hz).normalize().clone();
  }

  return { height, normal, perlin, fbm };
}

export function buildTerrain(p, field) {
  const b = new MeshBuilder();
  const rings = Math.max(12, Math.round(p.segments * 0.42));
  const segs = p.segments;

  for (let r = 0; r <= rings; r++) {
    // Non-linear radial spacing: dense where the camera actually resolves detail.
    const t = r / rings;
    const radius = Math.pow(t, 2.1) * p.radius;
    for (let s = 0; s <= segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      const x = Math.cos(a) * radius;
      const z = Math.sin(a) * radius;
      const y = field.height(x, z);
      const n = field.normal(x, z, Math.max(0.12, radius * 0.02));
      // Concave spots (valleys) get a darker AO proxy.
      const curvature = field.height(x, z) * 2 - field.height(x + 1.2, z) - field.height(x, z + 1.2);
      const ao = THREE.MathUtils.clamp(0.62 + curvature * 0.34 + n.y * 0.3, 0, 1);
      const rnd = ((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1 + 1) % 1;
      b.vertex(x, y, z, n.x, n.y, n.z, THREE.MathUtils.clamp(y / (p.heightScale + 0.001) * 0.5 + 0.5, 0, 1), ao, 0.05, rnd);
    }
  }

  const stride = segs + 1;
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segs; s++) {
      const a = r * stride + s;
      const bIdx = a + 1;
      const c = a + stride + 1;
      const d = a + stride;
      if (r === 0) b.tri(a, c, d);
      else b.quad(a, bIdx, c, d);
    }
  }
  return b.toGeometry();
}

/* ================================================================== *
 * Pierced rock towers — SDF surfaced with marching cubes
 * ================================================================== */

function smoothMax(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
}

/**
 * Builds the SDF for one tower in the normalised cube [-1,1]^3.
 * Returns `sdf(x,y,z)` — negative inside.
 */
export function makeTowerSdf(p, seed) {
  const perlin = makePerlin(seed);
  const warp = makeFbm(perlin, { octaves: 2, gain: 0.55, lacunarity: 2.1 });
  const detail = makeFbm(perlin, { octaves: 3, gain: 0.5, lacunarity: 2.3, ridged: true });
  const rng = makeRng(seed ^ 0x9e37);

  const lean = Math.tan((p.leanAngle * Math.PI) / 180) * 0.55;
  const leanAngle = rng() * Math.PI * 2;
  const radius0 = 0.52;
  const yBase = -0.99;
  const yTop = 0.9;

  // Radius of the tower at height fraction t — shared by the SDF and the hole sizing.
  const profileAt = (t) => (1 - p.taper * t) * (1 + p.bulge * Math.sin(Math.PI * Math.pow(t, 0.85)));

  // Hole set: even indices bore straight through (cylinders), odd ones are pits (spheres).
  // A hole is always a FRACTION of the LOCAL radius (hard-capped at 0.78). Sizing them
  // against the base radius instead let an upper hole exceed the tapered tower and cut it
  // into floating chunks.
  const holes = [];
  for (let i = 0; i < p.holeCount; i++) {
    const t = (i + 0.5 + rand(rng, -0.28, 0.28)) / Math.max(1, p.holeCount);
    const tc = Math.min(Math.max(t, 0), 1);
    const hy = yBase + tc * (yTop - yBase);
    const ang = rng() * Math.PI * 2;
    const rVar = 1 + (rng() * 2 - 1) * p.holeRadiusVar;
    const localR = radius0 * profileAt(tc);
    holes.push({
      pierce: i % 2 === 0,
      y: hy,
      ang,
      r: Math.min(Math.max(p.holeRadius * rVar, 0.1), 0.78) * localR,
      ox: (rng() * 2 - 1) * 0.16 * localR,
      oz: (rng() * 2 - 1) * 0.16 * localR,
      tilt: (rng() * 2 - 1) * 0.35,
    });
  }

  return function sdf(x, y, z) {
    const t = THREE.MathUtils.clamp((y - yBase) / (yTop - yBase), 0, 1);

    // Lean the axis, then warp the whole domain so the silhouette stops reading as a cylinder.
    const lx = x - Math.cos(leanAngle) * lean * (t - 0.5) * 2;
    const lz = z - Math.sin(leanAngle) * lean * (t - 0.5) * 2;
    const ws = p.warpScale * 2.4;
    const wx = warp(lx * ws, y * ws * 0.55, lz * ws) * p.warpAmount * 0.5;
    const wz = warp(lx * ws + 31.7, y * ws * 0.55 + 11.3, lz * ws - 7.1) * p.warpAmount * 0.5;
    const px = lx + wx;
    const pz = lz + wz;

    const r = radius0 * profileAt(t);
    let d = Math.hypot(px, pz) - r;

    // Vertical bounds, rounded so the top is a dome rather than a cut.
    d = smoothMax(d, y - yTop, 0.22);
    d = Math.max(d, yBase - y);

    // Eroded rock micro-relief.
    const ns = p.noiseScale * 2.6;
    d += (detail(x * ns, y * ns, z * ns) - 0.45) * p.noiseAmount * 0.42;

    // Carve the holes.
    for (let i = 0; i < holes.length; i++) {
      const h = holes[i];
      let hd;
      if (h.pierce) {
        // Distance to a horizontal line through (ox, y, oz) with direction (cos, tilt, sin).
        const dx = Math.cos(h.ang);
        const dz = Math.sin(h.ang);
        const dy = h.tilt;
        const inv = 1 / Math.hypot(dx, dy, dz);
        const ux = dx * inv;
        const uy = dy * inv;
        const uz = dz * inv;
        const vx = x - h.ox;
        const vy = y - h.y;
        const vz = z - h.oz;
        const proj = vx * ux + vy * uy + vz * uz;
        const cx = vx - ux * proj;
        const cy = vy - uy * proj;
        const cz = vz - uz * proj;
        hd = Math.hypot(cx, cy, cz) - h.r;
      } else {
        hd = Math.hypot(x - h.ox * 2.2, y - h.y, z - h.oz * 2.2) - h.r * 1.05;
      }
      d = smoothMax(d, -hd, p.holeSmooth * 0.5);
    }

    return d;
  };
}

/**
 * Surfaces one tower. Returns a static BufferGeometry in the normalised cube; the caller
 * scales it into world space. Async-friendly: the caller yields between towers.
 */
export function buildTower(p, seed) {
  const res = Math.max(20, Math.round(p.resolution));
  const sdf = makeTowerSdf(p, seed);
  // MarchingCubes reads `material.flatShading` while emitting vertices, so it needs a real
  // material even though we only ever harvest the buffers. MeshNormalMaterial actually has
  // the property, so this stays warning-free.
  const scratchMaterial = new THREE.MeshNormalMaterial({ flatShading: false });
  // Polygon budget. `res*res*2` looks generous and is not: a pierced tower at res 52 wants
  // ~11k triangles against the 5.4k that formula allows, and the overflow does not fail
  // loudly — it silently leaves duplicate vertices in the array, which then weld down to a
  // single point and render as garbage. Measured worst case is ~4.1 tris per res^2/10, so
  // budget 8x with a floor for small resolutions.
  const polyBudget = Math.max(24000, res * res * 8);
  const mc = new MarchingCubes(res, scratchMaterial, false, false, polyBudget);
  mc.isolation = 0;

  const size = mc.size;
  const half = mc.halfsize;
  const field = mc.field;
  // Fill the density field: positive inside so marching cubes triangulates at sdf == 0.
  for (let z = 0; z < size; z++) {
    const fz = (z - half) / half;
    const zo = size * size * z;
    for (let y = 0; y < size; y++) {
      const fy = (y - half) / half;
      const yo = zo + size * y;
      for (let x = 0; x < size; x++) {
        const fx = (x - half) / half;
        field[yo + x] = -sdf(fx, fy, fz);
      }
    }
  }
  mc.update();

  const count = mc.count;
  if (count > polyBudget * 3) {
    // Never silently ship a truncated surface; the caller can lower `resolution`.
    console.warn(
      `buildTower: marching cubes emitted ${count / 3} triangles against a ${polyBudget} budget — ` +
      'the surface is truncated. Lower towers.resolution or raise the budget.'
    );
  }
  if (count === 0) {
    mc.geometry.dispose();
    scratchMaterial.dispose();
    return new THREE.BufferGeometry();
  }

  const src = mc.positionArray;
  const srcN = mc.normalArray;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  positions.set(src.subarray(0, count * 3));
  normals.set(srcN.subarray(0, count * 3));

  // Per-vertex extras. AO uses the classic SDF trick: how much free space is there along
  // the normal? Concave folds return a small value and go dark.
  const surf = new Float32Array(count * 4);
  const aoR1 = 0.06;
  const aoR2 = 0.16;
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    let nx = normals[i * 3];
    let ny = normals[i * 3 + 1];
    let nz = normals[i * 3 + 2];
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    normals[i * 3] = nx; normals[i * 3 + 1] = ny; normals[i * 3 + 2] = nz;

    const d1 = sdf(x + nx * aoR1, y + ny * aoR1, z + nz * aoR1);
    const d2 = sdf(x + nx * aoR2, y + ny * aoR2, z + nz * aoR2);
    const occ = THREE.MathUtils.clamp(0.5 * (d1 / aoR1) + 0.5 * (d2 / aoR2), 0, 1);

    surf[i * 4] = THREE.MathUtils.clamp((y + 0.99) / 1.89, 0, 1);
    surf[i * 4 + 1] = 0.25 + occ * 0.75;
    surf[i * 4 + 2] = 1.0;
    surf[i * 4 + 3] = ((Math.sin(x * 91.7 + y * 47.3 + z * 13.1) * 43758.5453) % 1 + 1) % 1;
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.setAttribute('aSurf', new THREE.BufferAttribute(surf, 4));
  mc.geometry.dispose();
  scratchMaterial.dispose();

  // Marching cubes emits a triangle soup. Welding it is what makes the connected-component
  // pass possible at all (islands are only detectable through shared indices), and it drops
  // the vertex count roughly 6x as a side effect.
  const welded = mergeVertices(g, 1e-4);
  const solid = keepLargestComponent(welded);
  solid.computeBoundingSphere();
  return solid;
}

/* ================================================================== *
 * Branching (staghorn) coral
 * ================================================================== */

/** Adds one tapered tube segment; returns the ring of vertex indices at the tip. */
function addSegment(b, from, to, rFrom, rTo, sides, hFrom, hTo, thickFrom, thickTo, aoFrom, aoTo, rnd) {
  const dir = _vTmpA.copy(to).sub(from);
  const len = dir.length() || 1e-4;
  dir.divideScalar(len);
  basisFrom(dir, _vU, _vV);

  const ringA = [];
  const ringB = [];
  for (let s = 0; s < sides; s++) {
    const a = (s / sides) * Math.PI * 2;
    const cx = Math.cos(a);
    const cz = Math.sin(a);
    const nx = _vU.x * cx + _vV.x * cz;
    const ny = _vU.y * cx + _vV.y * cz;
    const nz = _vU.z * cx + _vV.z * cz;
    ringA.push(b.vertex(from.x + nx * rFrom, from.y + ny * rFrom, from.z + nz * rFrom, nx, ny, nz, hFrom, aoFrom, thickFrom, rnd));
    ringB.push(b.vertex(to.x + nx * rTo, to.y + ny * rTo, to.z + nz * rTo, nx, ny, nz, hTo, aoTo, thickTo, rnd));
  }
  for (let s = 0; s < sides; s++) {
    const s2 = (s + 1) % sides;
    b.quad(ringA[s], ringA[s2], ringB[s2], ringB[s]);
  }
  return { ring: ringB, dir: dir.clone() };
}

export function buildBranchCoral(p, seed) {
  const b = new MeshBuilder();
  const rng = makeRng(seed);
  const sides = Math.max(3, Math.round(p.radialSegments));
  const spread = (p.spreadAngle * Math.PI) / 180;
  const rndSeed = rng();

  // Total reachable length, used to normalise aSurf.x so the tip colour lands consistently.
  let maxReach = 0;
  {
    let l = p.trunkLength;
    let acc = 0;
    for (let i = 0; i < p.levels; i++) { acc += l; l *= p.lengthFalloff; }
    maxReach = acc || 1;
  }

  const up = new THREE.Vector3(0, 1, 0);

  function grow(origin, dir, length, radius, level, reached) {
    const tip = origin.clone().addScaledVector(dir, length);
    // Wobble + curl bend the branch mid-flight so nothing reads as a straight cone.
    tip.x += (rng() * 2 - 1) * p.wobble * length * 0.5;
    tip.z += (rng() * 2 - 1) * p.wobble * length * 0.5;
    tip.y += p.curl * length * 0.32;

    const isLeaf = level >= p.levels - 1;
    const rTo = isLeaf ? radius * p.radiusFalloff * p.tipSwell * 0.55 : radius * p.radiusFalloff;
    const hFrom = THREE.MathUtils.clamp(reached / maxReach, 0, 1);
    const hTo = THREE.MathUtils.clamp((reached + length) / maxReach, 0, 1);
    // Thinner branches transmit more light: thickness rises toward the tips.
    const thickFrom = 0.25 + hFrom * 0.75;
    const thickTo = 0.25 + hTo * 0.75;
    const aoFrom = 0.4 + hFrom * 0.6;
    const aoTo = 0.45 + hTo * 0.55;

    const seg = addSegment(b, origin, tip, radius, rTo, sides, hFrom, hTo, thickFrom, thickTo, aoFrom, aoTo, rndSeed);

    if (isLeaf) {
      // Cone cap so tips close cleanly and catch a rim highlight.
      const capLen = length * 0.22 * p.tipSwell;
      const apex = tip.clone().addScaledVector(dir, capLen);
      const capIdx = b.vertex(apex.x, apex.y, apex.z, dir.x, dir.y, dir.z, 1.0, 1.0, 1.0, rndSeed);
      for (let s = 0; s < sides; s++) {
        b.tri(seg.ring[s], seg.ring[(s + 1) % sides], capIdx);
      }
      return;
    }

    const childCount = Math.max(1, Math.round(p.branchesPerLevel));
    const baseRoll = rng() * Math.PI * 2;
    for (let i = 0; i < childCount; i++) {
      const roll = baseRoll + (i / childCount) * Math.PI * 2 + (rng() * 2 - 1) * 0.35;
      const bend = spread * (0.6 + rng() * 0.7);
      basisFrom(dir, _vU, _vV);
      const child = dir.clone()
        .multiplyScalar(Math.cos(bend))
        .addScaledVector(_vU, Math.sin(bend) * Math.cos(roll))
        .addScaledVector(_vV, Math.sin(bend) * Math.sin(roll));
      // Coral grows toward the light: bias every child back toward vertical.
      child.lerp(up, Math.max(0, p.curl) * 0.28).normalize();
      grow(tip.clone(), child, length * p.lengthFalloff, rTo, level + 1, reached + length);
    }
  }

  const root = new THREE.Vector3(0, 0, 0);
  const startDir = new THREE.Vector3((rng() * 2 - 1) * 0.16, 1, (rng() * 2 - 1) * 0.16).normalize();
  grow(root, startDir, p.trunkLength, p.trunkRadius, 0, 0);

  return b.toGeometry();
}

/* ================================================================== *
 * Plate / table coral
 * ================================================================== */

export function buildPlateCoral(p, seed) {
  const b = new MeshBuilder();
  const rng = makeRng(seed);
  const segs = Math.max(6, Math.round(p.radialSegments));
  const tiers = Math.max(1, Math.round(p.tiers));
  const rippleCount = Math.max(0, Math.round(p.rippleCount));
  const ripplePhase = rng() * Math.PI * 2;

  for (let tier = 0; tier < tiers; tier++) {
    const tierT = tiers === 1 ? 0 : tier / (tiers - 1);
    const radius = p.radius * (1 - p.radiusVar * tierT * 0.55) * (0.85 + rng() * 0.3);
    const yBase = p.stemHeight * (1 + tierT * 1.35);
    const tilt = (rng() * 2 - 1) * 0.18;
    const tiltDir = rng() * Math.PI * 2;
    const offX = tierT * radius * 0.25 * Math.cos(tiltDir);
    const offZ = tierT * radius * 0.25 * Math.sin(tiltDir);

    const edgeR = (a) => {
      const ripple = rippleCount > 0 ? Math.sin(a * rippleCount + ripplePhase + tier * 1.7) : 0;
      return radius * (1 + ripple * p.rippleAmount);
    };

    // Two concentric rings + a centre vertex for the top face, mirrored underneath.
    const rings = [0.0, 0.52, 1.0];
    const topIdx = [];
    const botIdx = [];
    const centreY = yBase + p.domeAmount * radius;
    const centreTop = b.vertex(offX, centreY, offZ, 0, 1, 0, 0.0, 1.0, 0.45, rng());
    const centreBot = b.vertex(offX, centreY - p.thicknessGeo, offZ, 0, -1, 0, 0.0, 0.25, 0.45, rng());

    for (let r = 1; r < rings.length; r++) {
      const rowTop = [];
      const rowBot = [];
      for (let s = 0; s < segs; s++) {
        const a = (s / segs) * Math.PI * 2;
        const rr = edgeR(a) * rings[r];
        const x = offX + Math.cos(a) * rr;
        const z = offZ + Math.sin(a) * rr;
        const dome = p.domeAmount * radius * (1 - rings[r] * rings[r]);
        const y = yBase + dome + Math.cos(a - tiltDir) * tilt * rr;
        // Normal from the dome slope, so the plate catches a soft gradient.
        const slope = (p.domeAmount * radius * 2 * rings[r]) / Math.max(0.001, radius);
        const nx = Math.cos(a) * slope;
        const nz = Math.sin(a) * slope;
        const nl = Math.hypot(nx, 1, nz);
        // aSurf.x runs 0 at the centre to 1 at the rim, so the rim colour lands on the rim.
        const h = rings[r];
        rowTop.push(b.vertex(x, y, z, nx / nl, 1 / nl, nz / nl, h, 0.55 + (1 - h) * 0.45, 0.35 + h * 0.65, rng()));
        rowBot.push(b.vertex(x, y - p.thicknessGeo, z, -nx / nl, -1 / nl, -nz / nl, h, 0.2 + (1 - h) * 0.2, 0.35 + h * 0.65, rng()));
      }
      topIdx.push(rowTop);
      botIdx.push(rowBot);
    }

    for (let s = 0; s < segs; s++) {
      const s2 = (s + 1) % segs;
      b.tri(centreTop, topIdx[0][s], topIdx[0][s2]);
      b.tri(centreBot, botIdx[0][s2], botIdx[0][s]);
      b.quad(topIdx[0][s], topIdx[1][s], topIdx[1][s2], topIdx[0][s2]);
      b.quad(botIdx[0][s2], botIdx[1][s2], botIdx[1][s], botIdx[0][s]);
      // Rim.
      b.quad(topIdx[1][s], botIdx[1][s], botIdx[1][s2], topIdx[1][s2]);
    }

    // Stem for the lowest tier only.
    if (tier === 0 && p.stemHeight > 0.01) {
      const from = new THREE.Vector3(offX, 0, offZ);
      const to = new THREE.Vector3(offX, yBase, offZ);
      addSegment(b, from, to, radius * 0.3, radius * 0.16, Math.min(8, segs), 0.0, 0.6, 0.2, 0.3, 0.35, 0.6, rng());
    }
  }

  return b.toGeometry();
}

/* ================================================================== *
 * Fan coral — thin blade, the strongest translucency showcase
 * ================================================================== */

export function buildFanCoral(p, seed) {
  const b = new MeshBuilder();
  const rng = makeRng(seed);
  const nx = Math.max(3, Math.round(p.segmentsX));
  const ny = Math.max(3, Math.round(p.segmentsY));
  const perlin = makePerlin(seed);
  const lobes = Math.max(0, Math.round(p.lobes));
  const phase = rng() * Math.PI * 2;

  const grid = [];
  for (let j = 0; j <= ny; j++) {
    const v = j / ny;
    const row = [];
    for (let i = 0; i <= nx; i++) {
      const u = i / nx * 2 - 1;
      // Blade outline: widest at mid-height, notched by `lobes`.
      const notch = lobes > 0 ? 1 - 0.18 * Math.abs(Math.sin(u * lobes * 1.7 + phase)) : 1;
      const widthAt = Math.sin(Math.min(1, v * 1.06) * Math.PI * 0.86) * notch;
      const x = u * p.width * 0.5 * widthAt;
      const y = v * p.height;
      const wave = perlin(u * 2.1, v * 2.4, phase) * p.waviness * 0.35;
      const z = p.curvature * (u * u) * p.width * 0.24 + wave;
      row.push({ x, y, z, u, v });
    }
    grid.push(row);
  }

  const idx = [];
  for (let j = 0; j <= ny; j++) {
    const row = [];
    for (let i = 0; i <= nx; i++) {
      const c = grid[j][i];
      // Normal from the local surface gradient of the (x,z) sheet.
      const l = grid[j][Math.max(0, i - 1)];
      const r = grid[j][Math.min(nx, i + 1)];
      const d = grid[Math.max(0, j - 1)][i];
      const u2 = grid[Math.min(ny, j + 1)][i];
      _vU.set(r.x - l.x, r.y - l.y, r.z - l.z);
      _vV.set(u2.x - d.x, u2.y - d.y, u2.z - d.z);
      _vN.crossVectors(_vU, _vV).normalize();
      if (_vN.lengthSq() < 0.5) _vN.set(0, 0, 1);
      const edge = Math.min(1, (1 - Math.abs(c.u)) * 2.2);
      row.push(b.vertex(c.x, c.y, c.z, _vN.x, _vN.y, _vN.z, c.v, 0.5 + edge * 0.5, 0.55 + c.v * 0.45, rng()));
    }
    idx.push(row);
  }

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      b.quad(idx[j][i], idx[j][i + 1], idx[j + 1][i + 1], idx[j + 1][i]);
    }
  }

  // Thin stem so the blade does not float.
  const from = new THREE.Vector3(0, -p.height * 0.12, 0);
  const to = new THREE.Vector3(0, 0, 0);
  addSegment(b, from, to, p.width * 0.045, p.width * 0.03, 5, 0, 0.1, 0.2, 0.25, 0.4, 0.5, rng());

  return b.toGeometry();
}

/* ================================================================== *
 * Boulder — displaced icosahedron, used for the foreground framing mass
 * ================================================================== */

export function buildBoulder(detail, noiseAmount, seed) {
  const src = new THREE.IcosahedronGeometry(1, Math.max(0, Math.min(4, Math.round(detail))));
  // three emits polyhedra non-indexed, and computeVertexNormals() on non-indexed data gives
  // per-face normals — that is what made the first build read as flat black facets. Welding
  // the seams first is what buys smooth shading.
  const nonIndexed = mergeVertices(src, 1e-4);
  src.dispose();
  const pos = nonIndexed.getAttribute('position');
  const perlin = makePerlin(seed);
  const fbm = makeFbm(perlin, { octaves: 3, gain: 0.5, lacunarity: 2.2, ridged: true });

  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = fbm(v.x * 1.35, v.y * 1.35, v.z * 1.35);
    // Squash slightly on Y so boulders sit rather than float.
    const s = 1 + (n - 0.42) * noiseAmount * 1.6;
    v.multiplyScalar(s);
    v.y *= 0.78;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  nonIndexed.computeVertexNormals();

  const count = pos.count;
  const surf = new Float32Array(count * 4);
  const nor = nonIndexed.getAttribute('normal');
  for (let i = 0; i < count; i++) {
    v.fromBufferAttribute(pos, i);
    surf[i * 4] = THREE.MathUtils.clamp(v.y * 0.5 + 0.5, 0, 1);
    surf[i * 4 + 1] = THREE.MathUtils.clamp(0.45 + nor.getY(i) * 0.55, 0, 1);
    surf[i * 4 + 2] = 0.08;
    surf[i * 4 + 3] = ((Math.sin(v.x * 31.7 + v.y * 17.3 + v.z * 53.1) * 43758.5453) % 1 + 1) % 1;
  }
  nonIndexed.setAttribute('aSurf', new THREE.BufferAttribute(surf, 4));
  nonIndexed.computeBoundingSphere();
  return nonIndexed;
}

/**
 * Keeps only the largest connected shell of an indexed geometry.
 *
 * Marching cubes will happily emit islands whenever a hole or a noise trough severs the
 * body, and those islands render as rock hanging in mid-air. Rather than tune the SDF
 * until it never happens (it always eventually does at some parameter combination), the
 * result is filtered: whatever the field produced, only the piece attached to the main
 * mass survives. Union-find over shared vertex indices, so it needs a welded geometry.
 */
function keepLargestComponent(geo) {
  const index = geo.getIndex();
  if (!index) return geo;
  const idx = index.array;
  const triCount = (idx.length / 3) | 0;
  const vertCount = geo.getAttribute('position').count;
  // A geometry whose indices outrun its vertex array cannot be walked — remap lookups go
  // out of bounds and every triangle silently collapses onto vertex 0. Bail instead.
  if (triCount === 0 || vertCount < 3) return geo;

  const parent = new Int32Array(vertCount);
  for (let i = 0; i < vertCount; i++) parent[i] = i;
  const find = (a) => {
    let r = a;
    while (parent[r] !== r) r = parent[r];
    while (parent[a] !== r) { const nx = parent[a]; parent[a] = r; a = nx; }
    return r;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  for (let t = 0; t < triCount; t++) {
    const a = idx[t * 3];
    const b = idx[t * 3 + 1];
    const c = idx[t * 3 + 2];
    union(a, b);
    union(b, c);
  }

  const tally = new Map();
  for (let t = 0; t < triCount; t++) {
    const r = find(idx[t * 3]);
    tally.set(r, (tally.get(r) ?? 0) + 1);
  }
  if (tally.size <= 1) return geo;

  let best = -1;
  let bestN = -1;
  for (const [root, n] of tally) {
    if (n > bestN) { bestN = n; best = root; }
  }

  const remap = new Int32Array(vertCount).fill(-1);
  const newIdx = new Uint32Array(bestN * 3);
  let next = 0;
  let w = 0;
  for (let t = 0; t < triCount; t++) {
    if (find(idx[t * 3]) !== best) continue;
    for (let k = 0; k < 3; k++) {
      const v = idx[t * 3 + k];
      if (remap[v] < 0) remap[v] = next++;
      newIdx[w++] = remap[v];
    }
  }

  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(geo.attributes)) {
    const src = geo.getAttribute(name);
    const n = src.itemSize;
    const dst = new Float32Array(next * n);
    for (let v = 0; v < vertCount; v++) {
      const m = remap[v];
      if (m < 0) continue;
      for (let k = 0; k < n; k++) dst[m * n + k] = src.array[v * n + k];
    }
    out.setAttribute(name, new THREE.BufferAttribute(dst, n));
  }
  out.setIndex(new THREE.BufferAttribute(newIdx, 1));
  out.computeBoundingSphere();
  geo.dispose();
  return out;
}

/* ================================================================== *
 * Scatter helpers
 * ================================================================== */

/**
 * Rejection-samples placements on the terrain, skipping anything that would sit on top of
 * a tower, inside the stage clearance, or behind the camera.
 *
 * `view` switches the sampling domain from a disc around the origin to a wedge anchored at
 * the camera. That matters more than it sounds: the camera is fixed (C章), so a disc spends
 * most of the triangle budget on geometry that is never on screen — measured 15 of 152
 * branch corals inside the frustum before this changed. In wedge mode `inner`/`outer` are
 * distances from the camera, not radii from the origin.
 */
export function scatterOnTerrain({
  rng, count, inner, outer, field, avoid = [], cameraZ = 9, minCameraDist = 2.0,
  stage = null, slopeLimit = 0.45, slopeFloor = 0, maxAttempts = 60, clusters = 0, clusterRadius = 4,
  view = null,
}) {
  const out = [];
  const innerFrac = outer > 0 ? Math.min(inner / outer, 0.98) : 0;

  const sample = () => {
    // sqrt-distributed radius keeps the density uniform per unit area.
    const d = Math.sqrt(rand(rng, innerFrac ** 2, 1)) * outer;
    if (view) {
      const a = view.angle + rand(rng, -view.halfAngle, view.halfAngle);
      return { x: view.x + Math.sin(a) * d, z: view.z + Math.cos(a) * d };
    }
    const a = rng() * Math.PI * 2;
    return { x: Math.cos(a) * d, z: Math.sin(a) * d };
  };

  const inDomain = (x, z) => {
    if (!view) return Math.hypot(x, z) <= outer * 1.15;
    const dx = x - view.x;
    const dz = z - view.z;
    const d = Math.hypot(dx, dz);
    if (d > outer * view.bleed || d < inner * 0.55) return false;
    let da = Math.atan2(dx, dz) - view.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    return Math.abs(da) <= view.halfAngle * view.bleed;
  };

  // Colony seeds. Sampling around these rather than uniformly is what makes the coral read
  // as thickets with open ground between them instead of an evenly sprinkled lawn.
  const seeds = [];
  for (let i = 0; i < Math.round(clusters); i++) seeds.push(sample());

  for (let i = 0; i < count; i++) {
    let placed = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let x;
      let z;
      if (seeds.length > 0 && rng() < 0.82) {
        const seed = seeds[(rng() * seeds.length) | 0];
        // Sum of two uniforms is a soft bell, so colonies thin out toward their edges.
        const rr = (rng() + rng()) * 0.5 * clusterRadius;
        const aa = rng() * Math.PI * 2;
        x = seed.x + Math.cos(aa) * rr;
        z = seed.z + Math.sin(aa) * rr;
        if (!inDomain(x, z)) continue;
      } else {
        const pt = sample();
        x = pt.x;
        z = pt.z;
      }

      if (z > cameraZ - minCameraDist) continue;
      const dCam = Math.hypot(x, z - cameraZ);
      if (dCam < minCameraDist) continue;

      if (stage && Math.hypot(x - stage.x, z - stage.z) < stage.radius) continue;

      let blocked = false;
      for (let k = 0; k < avoid.length; k++) {
        const av = avoid[k];
        if (Math.hypot(x - av.x, z - av.z) < av.r) { blocked = true; break; }
      }
      if (blocked) continue;

      const n = field.normal(x, z, 0.45);
      if (n.y < 1 - slopeLimit) continue;
      // Inverse of slopeLimit: rubble only belongs where the ground is actually steep.
      if (slopeFloor > 0 && n.y > 1 - slopeFloor) continue;

      placed = { x, y: field.height(x, z), z, normal: n.clone(), rand: rng() };
      break;
    }
    if (placed) out.push(placed);
  }
  return out;
}

/**
 * Builds the sampling wedge from the camera's own framing so `scatterOnTerrain` and the
 * foreground framing agree on where the frame edges are.
 */
export function makeViewWedge(camera, spreadDeg, bleed = 1.12) {
  const dx = camera.targetX - camera.posX;
  const dz = camera.targetZ - camera.posZ;
  return {
    x: camera.posX,
    z: camera.posZ,
    angle: Math.atan2(dx, dz),
    halfAngle: (spreadDeg * Math.PI) / 360,
    bleed,
  };
}

/** Fills instanceMatrix + iColor + iParams for one InstancedMesh from placements. */
export function applyInstances(mesh, placements, describe) {
  const dummy = new THREE.Object3D();
  const colors = new Float32Array(placements.length * 3);
  const extras = new Float32Array(placements.length * 4);
  const c = new THREE.Color();

  for (let i = 0; i < placements.length; i++) {
    const spec = describe(placements[i], i);
    dummy.position.set(spec.position.x, spec.position.y, spec.position.z);
    dummy.rotation.set(spec.rotation.x, spec.rotation.y, spec.rotation.z);
    dummy.scale.set(spec.scale.x, spec.scale.y, spec.scale.z);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    c.copy(spec.color);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;

    extras[i * 4] = spec.thickness;
    extras[i * 4 + 1] = spec.emissive;
    extras[i * 4 + 2] = spec.sway;
    extras[i * 4 + 3] = spec.phase;
  }

  mesh.count = placements.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.geometry.setAttribute('iColor', new THREE.InstancedBufferAttribute(colors, 3));
  mesh.geometry.setAttribute('iParams', new THREE.InstancedBufferAttribute(extras, 4));
  mesh.frustumCulled = false;
  return mesh;
}

/**
 * Fraction of a geometry's triangles that have (near) zero area.
 *
 * Exists because the basisFrom aliasing bug above was invisible to every other check:
 * attributes were finite, indices were in range, the bounding box was the right size, the
 * draw calls were issued and the triangle counter agreed. The only observable was that
 * nothing appeared on screen. Area is the check that catches it, so it runs on every
 * generated geometry.
 */
export function degenerateFraction(geometry) {
  const posAttr = geometry.getAttribute('position');
  if (!posAttr) return 0;
  const pos = posAttr.array;
  const index = geometry.getIndex();
  const count = index ? index.count : posAttr.count;
  if (count < 3) return 0;
  const at = index ? (i) => index.array[i] * 3 : (i) => i * 3;

  let zero = 0;
  let total = 0;
  for (let t = 0; t + 2 < count; t += 3) {
    const a = at(t);
    const b = at(t + 1);
    const c = at(t + 2);
    const e1x = pos[b] - pos[a];
    const e1y = pos[b + 1] - pos[a + 1];
    const e1z = pos[b + 2] - pos[a + 2];
    const e2x = pos[c] - pos[a];
    const e2y = pos[c + 1] - pos[a + 1];
    const e2z = pos[c + 2] - pos[a + 2];
    const cx = e1y * e2z - e1z * e2y;
    const cy = e1z * e2x - e1x * e2z;
    const cz = e1x * e2y - e1y * e2x;
    total++;
    if (Math.hypot(cx, cy, cz) * 0.5 < 1e-9) zero++;
  }
  return total > 0 ? zero / total : 0;
}

/**
 * Visible triangles below `root`, honouring instance counts.
 *
 * Passing CoralArea.group deliberately excludes the separate sky scene. traverseVisible()
 * also prunes descendants of hidden parents, unlike a flat `visible` check in traverse().
 */
export function countTriangles(root) {
  let tris = 0;
  root.traverseVisible((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry;
    const n = g.index ? g.index.count : g.getAttribute('position')?.count ?? 0;
    const instances = o.isInstancedMesh ? o.count : 1;
    tris += (n / 3) * instances;
  });
  return Math.round(tris);
}
