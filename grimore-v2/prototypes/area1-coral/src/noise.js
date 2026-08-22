/**
 * noise.js — deterministic noise, shared by CPU geometry generation and GLSL shading.
 *
 * CPU side: seeded Perlin gradient noise + fbm + domain warp. Used by the marching-cubes
 * SDF (rock towers), the ground displacement and the coral branch generator, so a given
 * `seed` parameter always regenerates the identical world.
 *
 * GLSL side: Ashima/Stefan Gustavson simplex noise (public domain), exported as a source
 * string so every material shares one implementation instead of drifting copies.
 */

/* ------------------------------------------------------------------ *
 * Seeded RNG (mulberry32) — small, fast, good enough for asset layout
 * ------------------------------------------------------------------ */

export function makeRng(seed = 1) {
  let a = (seed >>> 0) || 1;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform float in [min, max). */
export function rand(rng, min, max) {
  return min + (max - min) * rng();
}

/** Symmetric jitter in [-amount, amount). */
export function jitter(rng, amount) {
  return (rng() * 2 - 1) * amount;
}

/* ------------------------------------------------------------------ *
 * Perlin 3D gradient noise (CPU)
 * ------------------------------------------------------------------ */

const GRAD3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

/**
 * Builds a Perlin noise sampler bound to `seed`.
 * Returns noise3(x, y, z) in roughly [-1, 1].
 */
export function makePerlin(seed = 1) {
  const rng = makeRng(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  // Fisher-Yates with the seeded rng so the table is reproducible.
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  const perm = new Uint8Array(512);
  const permMod12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    permMod12[i] = perm[i] % 12;
  }

  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  const dot3 = (g, x, y, z) => g[0] * x + g[1] * y + g[2] * z;

  return function noise3(x, y, z) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    const fx = x - Math.floor(x);
    const fy = y - Math.floor(y);
    const fz = z - Math.floor(z);
    const u = fade(fx);
    const v = fade(fy);
    const w = fade(fz);

    const A = perm[X] + Y;
    const AA = perm[A] + Z;
    const AB = perm[A + 1] + Z;
    const B = perm[X + 1] + Y;
    const BA = perm[B] + Z;
    const BB = perm[B + 1] + Z;

    const g = (h) => GRAD3[permMod12[h]];

    return lerp(
      lerp(
        lerp(dot3(g(AA), fx, fy, fz), dot3(g(BA), fx - 1, fy, fz), u),
        lerp(dot3(g(AB), fx, fy - 1, fz), dot3(g(BB), fx - 1, fy - 1, fz), u),
        v
      ),
      lerp(
        lerp(dot3(g(AA + 1), fx, fy, fz - 1), dot3(g(BA + 1), fx - 1, fy, fz - 1), u),
        lerp(dot3(g(AB + 1), fx, fy - 1, fz - 1), dot3(g(BB + 1), fx - 1, fy - 1, fz - 1), u),
        v
      ),
      w
    );
  };
}

/**
 * Fractional Brownian motion over a Perlin sampler.
 * `ridged` folds each octave (|n| inverted) which produces the sharp crests that read
 * as eroded rock rather than smooth blobs.
 */
export function makeFbm(noise3, { octaves = 4, lacunarity = 2.0, gain = 0.5, ridged = false } = {}) {
  return function fbm(x, y, z) {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      let n = noise3(x * freq, y * freq, z * freq);
      if (ridged) n = 1 - Math.abs(n) * 2;
      sum += n * amp;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return norm > 0 ? sum / norm : 0;
  };
}

/* ------------------------------------------------------------------ *
 * GLSL: simplex noise + fbm + helpers, shared by every material
 * ------------------------------------------------------------------ */

export const GLSL_NOISE = /* glsl */ `
vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

float fbm3(vec3 p, int octaves, float lacunarity, float gain){
  float amp = 0.5;
  float sum = 0.0;
  for (int i = 0; i < 6; i++){
    if (i >= octaves) break;
    sum += snoise(p) * amp;
    p *= lacunarity;
    amp *= gain;
  }
  return sum;
}

// Ridged variant: sharp crests, used for rock micro-detail.
float fbmRidged(vec3 p, int octaves, float lacunarity, float gain){
  float amp = 0.5;
  float sum = 0.0;
  for (int i = 0; i < 6; i++){
    if (i >= octaves) break;
    float n = 1.0 - abs(snoise(p));
    sum += n * n * amp;
    p *= lacunarity;
    amp *= gain;
  }
  return sum;
}

// Cheap 2D hash used for grain / per-particle randomness.
float hash21(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
`;

/**
 * Animated "light dapple" — the moving caustic-like pattern the reference frame gets from
 * light passing through the churning canopy. Two counter-scrolling ridged layers multiplied
 * together give the characteristic thin bright veins.
 */
export const GLSL_DAPPLE = /* glsl */ `
float dapple(vec3 worldPos, float time, float scale, float speed, float sharpness){
  vec3 p = worldPos * scale;
  vec3 a = p + vec3(time * speed, time * speed * 0.31, -time * speed * 0.62);
  vec3 b = p * 1.73 + vec3(-time * speed * 0.77, time * speed * 0.19, time * speed * 0.43);
  float na = 1.0 - abs(snoise(a));
  float nb = 1.0 - abs(snoise(b));
  float v = na * nb;
  return pow(clamp(v, 0.0, 1.0), sharpness);
}
`;
