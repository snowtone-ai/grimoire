/**
 * materials.js — every shader in Area 1.
 *
 * All world surfaces share ONE program source, specialised by `defines`, so the lighting
 * model is impossible to fork by accident. The model is deliberately stylised rather than
 * PBR (G章「スタイライズ路線」):
 *
 *   wrap diffuse        keeps the unlit side readable under hard backlight
 *   translucency        Barré-Brisebois & Bouchard, GDC 2011 / GPU Pro 2 (Frostbite 2)
 *   rim / fresnel       the bright coral edge that sells 逆光
 *   hemispheric ambient sky/ground tint instead of an IBL probe
 *   light dapple        animated veins cast through the canopy
 *   aerial perspective  3-band distance fog + sun inscattering, matched to the sky
 *                       (CryEngine2 horizon-matched fog, Firewatch layered colour)
 *
 * Colour space: every material works in linear space and writes to a HalfFloat target.
 * The renderer is set to LinearSRGB output and the composite pass does the sRGB encode,
 * so there is exactly one conversion in the whole chain.
 */

import * as THREE from 'three';
import { GLSL_NOISE, GLSL_DAPPLE } from './noise.js';

/* ================================================================== *
 * Shared uniforms — one object, referenced by every material
 * ================================================================== */

const C = (hex) => new THREE.Color(hex);

export function createSharedUniforms(p) {
  return {
    uTime: { value: 0 },
    uPixelRatio: { value: 1 },
    uResolution: { value: new THREE.Vector2(1, 1) },

    // Sun
    uSunDir: { value: new THREE.Vector3(0, 0.5, -1).normalize() },
    uSunColor: { value: C(p.sun.color) },
    uSunIntensity: { value: p.sun.intensity },
    uSunDisc: { value: new THREE.Vector3(p.sun.discSize, p.sun.discSoftness, p.sun.discIntensity) },
    uSunFlicker: { value: new THREE.Vector2(p.sun.flickerAmp, p.sun.flickerSpeed) },

    // Sky
    uSkyZenith: { value: C(p.sky.zenithColor) },
    uSkyHorizon: { value: C(p.sky.horizonColor) },
    uSkyGround: { value: C(p.sky.groundColor) },
    uSkyGradientPower: { value: p.sky.gradientPower },
    uHaloColor: { value: C(p.sky.haloColor) },
    uHalo: { value: new THREE.Vector2(p.sky.haloIntensity, p.sky.haloFalloff) },
    uCanopyColor: { value: C(p.sky.canopyColor) },
    uCanopy: { value: new THREE.Vector4(p.sky.canopyHeight, p.sky.canopyScale, p.sky.canopySpeed, p.sky.canopyContrast) },
    uCanopyMix: { value: new THREE.Vector3(p.sky.canopyCoverage, p.sky.canopyEnabled ? 1 : 0, p.sky.starEnabled ? 1 : 0) },

    // Fog / aerial perspective
    uFogNear: { value: C(p.fog.nearColor) },
    uFogMid: { value: C(p.fog.midColor) },
    uFogFar: { value: C(p.fog.farColor) },
    uFogDist: { value: new THREE.Vector3(p.fog.nearDist, p.fog.midDist, p.fog.farDist) },
    uFogParams: { value: new THREE.Vector4(p.fog.density, p.fog.power, p.fog.heightFalloff, p.fog.heightOffset) },
    uFogFloorBoost: { value: p.fog.floorBoost },
    uFogInscatterColor: { value: C(p.fog.inscatterColor) },
    uFogInscatter: { value: new THREE.Vector2(p.fog.inscatterStrength, p.fog.inscatterPower) },
    uFogScroll: { value: new THREE.Vector3(p.fog.scrollSpeed, p.fog.scrollScale, p.fog.scrollAmount) },
    uHorizonBlend: { value: 0.85 },

    // Shared BRDF
    uWrap: { value: new THREE.Vector2(p.surface.wrap, p.surface.wrapPower) },
    uAmbientSky: { value: C(p.surface.ambientSky) },
    uAmbientGround: { value: C(p.surface.ambientGround) },
    uAmbientIntensity: { value: p.surface.ambientIntensity },
    uRimColor: { value: C(p.surface.rimColor) },
    uRim: { value: new THREE.Vector3(p.surface.rimStrength, p.surface.rimPower, p.surface.rimBacklightBias) },
    uSpec: { value: new THREE.Vector2(p.surface.specStrength, p.surface.specPower) },
    uAoStrength: { value: p.surface.aoStrength },
    uDetail: { value: new THREE.Vector4(p.surface.detailScale, p.surface.detailAmount, p.surface.macroScale, p.surface.macroAmount) },
    uNormalPerturb: { value: p.surface.normalPerturb },

    // Translucency
    uLT: { value: new THREE.Vector4(p.translucency.distortion, p.translucency.power, p.translucency.scale, p.translucency.ambient) },
    uLTColor: { value: C(p.translucency.color) },
    uLTThickness: { value: new THREE.Vector3(p.translucency.thicknessBias, p.translucency.thicknessScale, p.translucency.enabled ? 1 : 0) },

    // Dapple
    uDapple: { value: new THREE.Vector4(p.dapple.scale, p.dapple.speed, p.dapple.sharpness, p.dapple.contrast) },
    uDappleTint: { value: C(p.dapple.tint) },
    uDappleOn: { value: p.dapple.enabled ? 1 : 0 },
  };
}

/* ================================================================== *
 * Shared GLSL
 * ================================================================== */

const GLSL_SHARED_UNIFORMS = /* glsl */ `
uniform float uTime;
uniform vec3  uSunDir;
uniform vec3  uSunColor;
uniform float uSunIntensity;
uniform vec3  uSunDisc;
uniform vec2  uSunFlicker;

uniform vec3  uSkyZenith;
uniform vec3  uSkyHorizon;
uniform vec3  uSkyGround;
uniform float uSkyGradientPower;
uniform vec3  uHaloColor;
uniform vec2  uHalo;
uniform vec3  uCanopyColor;
uniform vec4  uCanopy;
uniform vec3  uCanopyMix;

uniform vec3  uFogNear;
uniform vec3  uFogMid;
uniform vec3  uFogFar;
uniform vec3  uFogDist;
uniform vec4  uFogParams;
uniform float uFogFloorBoost;
uniform vec3  uFogInscatterColor;
uniform vec2  uFogInscatter;
uniform vec3  uFogScroll;
uniform float uHorizonBlend;
`;

/** Sun colour including the slow flicker — one definition, used by sky and surfaces. */
const GLSL_SUN = /* glsl */ `
vec3 sunRadiance(){
  float f = 1.0
    + sin(uTime * uSunFlicker.y) * uSunFlicker.x
    + sin(uTime * uSunFlicker.y * 1.73 + 1.3) * uSunFlicker.x * 0.5;
  return uSunColor * uSunIntensity * max(f, 0.0);
}
`;

const GLSL_AERIAL = /* glsl */ `
vec3 fogColorAt(float dist, vec3 dir){
  vec3 c = dist < uFogDist.y
    ? mix(uFogNear, uFogMid, smoothstep(uFogDist.x, uFogDist.y, dist))
    : mix(uFogMid,  uFogFar, smoothstep(uFogDist.y, uFogDist.z, dist));
  float sunAmt = pow(clamp(dot(dir, uSunDir), 0.0, 1.0), uFogInscatter.y);
  return mix(c, uFogInscatterColor * (0.55 + uSunIntensity * 0.22), sunAmt * uFogInscatter.x);
}

vec3 applyAerial(vec3 color, vec3 worldPos, vec3 camPos){
  vec3 toFrag = worldPos - camPos;
  float dist = length(toFrag);
  vec3 dir = toFrag / max(dist, 1e-4);

  float hRel = max(0.0, worldPos.y - uFogParams.w);
  float heightAtt = exp(-hRel * uFogParams.z);
  heightAtt *= 1.0 + uFogFloorBoost * exp(-hRel * 0.9);

  float f = 1.0 - exp(-pow(max(dist * uFogParams.x, 0.0), uFogParams.y));
  f *= heightAtt;

  #if Q_FULL
    float nz = snoise(worldPos * uFogScroll.y + vec3(uTime * uFogScroll.x, uTime * uFogScroll.x * 0.31, uTime * uFogScroll.x * 0.62));
    f *= 1.0 + nz * uFogScroll.z;
  #endif

  f = clamp(f, 0.0, 1.0);
  return mix(color, fogColorAt(dist, dir), f);
}
`;

/* ================================================================== *
 * World surface material
 * ================================================================== */

const WORLD_VERT = /* glsl */ `
attribute vec4 aSurf;
#ifdef USE_INSTANCING
  attribute vec3 iColor;
  attribute vec4 iParams;
#endif

uniform vec3  uBaseColor;
uniform vec4  uInstDefault;
uniform vec2  uSway;          // x: global speed, y: global amplitude multiplier

varying vec3 vWorld;
varying vec3 vNormal;
varying vec4 vSurf;
varying vec3 vAlbedo;
varying vec4 vInst;

void main(){
  vSurf = aSurf;

  #ifdef USE_INSTANCING
    vAlbedo = iColor;
    vInst = iParams;
    mat4 modelInstance = modelMatrix * instanceMatrix;
  #else
    vAlbedo = uBaseColor;
    vInst = uInstDefault;
    mat4 modelInstance = modelMatrix;
  #endif

  vec4 world = modelInstance * vec4(position, 1.0);

  // Wind sway. Amplitude ramps with height along the object so roots stay planted.
  float amp = vInst.z * uSway.y * pow(clamp(aSurf.x, 0.0, 1.0), 1.7);
  if (amp > 0.0){
    float ph = vInst.w * 6.28318 + world.x * 0.35 + world.z * 0.27;
    float t = uTime * uSway.x;
    world.xyz += vec3(
      sin(t + ph),
      sin(t * 0.71 + ph * 1.7) * 0.28,
      cos(t * 0.87 + ph * 0.6)
    ) * amp;
  }

  vWorld = world.xyz;
  vNormal = normalize(mat3(modelInstance) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const WORLD_FRAG = /* glsl */ `
uniform vec3  uAmbientSky;
uniform vec3  uAmbientGround;
uniform float uAmbientIntensity;
uniform vec2  uWrap;
uniform vec3  uRimColor;
uniform vec3  uRim;
uniform vec2  uSpec;
uniform float uAoStrength;
uniform vec4  uDetail;
uniform float uNormalPerturb;
uniform vec4  uLT;
uniform vec3  uLTColor;
uniform vec3  uLTThickness;
uniform vec4  uDapple;
uniform vec3  uDappleTint;
uniform float uDappleOn;

uniform vec3  uColorA;
uniform vec3  uColorB;
uniform vec3  uColorC;
uniform float uTipPower;
uniform float uSlopeSharpness;
uniform vec3  uEncrustColor;
uniform vec2  uEncrust;        // x: amount, y: scale
uniform vec3  uEmissiveColor;
uniform vec4  uEmissive;       // x: strength, y: tip bias, z: pulse amount, w: pulse speed
uniform vec2  uFrame;          // x: darkness, y: rim boost
uniform float uColorJitter;
uniform float uRimScale;

varying vec3 vWorld;
varying vec3 vNormal;
varying vec4 vSurf;
varying vec3 vAlbedo;
varying vec4 vInst;

void main(){
  vec3 N = normalize(vNormal);
  #ifdef DOUBLE_SIDED_SURFACE
    if (!gl_FrontFacing) N = -N;
  #endif

  vec3 V = normalize(cameraPosition - vWorld);

  /* --- procedural surface detail ------------------------------------ */
  float detailN = snoise(vWorld * uDetail.x);
  float macroN  = snoise(vWorld * uDetail.z + 17.3);

  #if Q_FULL
    if (uNormalPerturb > 0.0){
      float e = 0.35 / max(uDetail.x, 0.001);
      vec3 g = vec3(
        snoise((vWorld + vec3(e, 0.0, 0.0)) * uDetail.x) - detailN,
        snoise((vWorld + vec3(0.0, e, 0.0)) * uDetail.x) - detailN,
        snoise((vWorld + vec3(0.0, 0.0, e)) * uDetail.x) - detailN
      );
      N = normalize(N + g * uNormalPerturb * 1.6);
    }
  #endif

  /* --- albedo -------------------------------------------------------- */
  vec3 albedo;

  #if defined(ALBEDO_TERRAIN)
    float slope = 1.0 - clamp(N.y, 0.0, 1.0);
    albedo = mix(uColorA, uColorB, clamp(vSurf.x, 0.0, 1.0));
    albedo = mix(albedo, uColorC, smoothstep(0.12, 0.12 + 1.0 / uSlopeSharpness, slope));
  #elif defined(ALBEDO_TOWER)
    albedo = mix(uColorA, uColorB, smoothstep(0.0, 1.0, pow(clamp(vSurf.x, 0.0, 1.0), 0.85)));
  #elif defined(ALBEDO_TIP)
    albedo = mix(vAlbedo, uColorB, pow(clamp(vSurf.x, 0.0, 1.0), uTipPower));
  #elif defined(ALBEDO_PLATE)
    float up = clamp(N.y * 0.5 + 0.5, 0.0, 1.0);
    albedo = mix(uColorC, vAlbedo, smoothstep(0.42, 0.68, up));
    albedo = mix(albedo, uColorB, smoothstep(0.74, 1.0, vSurf.x) * up);
  #else
    albedo = uColorA;
  #endif

  #ifdef USE_ENCRUST
    float enc = smoothstep(0.45, 0.92, snoise(vWorld * uEncrust.y) * 0.5 + 0.5) * clamp(N.y, 0.0, 1.0);
    albedo = mix(albedo, uEncrustColor, enc * uEncrust.x);
  #endif

  // Per-instance and per-vertex tonal jitter so repeated geometry stops reading as clones.
  albedo *= 1.0 + (vSurf.w - 0.5) * uColorJitter;
  albedo *= 1.0 + detailN * uDetail.y + macroN * uDetail.w;

  /* --- lighting ------------------------------------------------------ */
  vec3 L = uSunDir;
  vec3 sunCol = sunRadiance();
  float ndl = dot(N, L);

  float diffuse = pow(clamp((ndl + uWrap.x) / (1.0 + uWrap.x), 0.0, 1.0), uWrap.y);

  vec3 directTint = vec3(1.0);
  if (uDappleOn > 0.5 && uDapple.w > 0.0){
    float d = dapple(vWorld, uTime, uDapple.x, uDapple.y, uDapple.z);
    diffuse *= mix(1.0, 0.55 + d * 1.85, uDapple.w);
    directTint = mix(vec3(1.0), uDappleTint, uDapple.w * 0.55 * d);
  }
  vec3 direct = sunCol * diffuse * directTint;

  float ao = mix(1.0, clamp(vSurf.y, 0.0, 1.0), uAoStrength);
  vec3 ambient = mix(uAmbientGround, uAmbientSky, N.y * 0.5 + 0.5) * uAmbientIntensity * ao;

  // Frostbite-style translucency: light entering the back and leaving toward the eye.
  vec3 trans = vec3(0.0);
  if (uLTThickness.z > 0.5){
    float thick = clamp(vSurf.z * vInst.x * uLTThickness.y + uLTThickness.x, 0.0, 2.0);
    vec3 ltLight = normalize(L + N * uLT.x);
    float ltDot = exp2(clamp(dot(V, -ltLight), 0.0, 1.0) * uLT.y - uLT.y) * uLT.z;
    trans = albedo * uLTColor * sunCol * (ltDot + uLT.w) * thick;
  }

  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), uRim.y);
  float backlit = mix(1.0, clamp(ndl * 0.5 + 0.5, 0.0, 1.0), uRim.z);
  // Per-material rim scale. A large receding ground plane is grazing-angle everywhere, so a
  // global fresnel term washes it out; only small silhouetted shapes should take the full rim.
  vec3 rim = uRimColor * fres * uRim.x * backlit * uRimScale;

  vec3 H = normalize(L + V);
  vec3 spec = sunCol * pow(clamp(dot(N, H), 0.0, 1.0), uSpec.y) * uSpec.x * clamp(ndl * 2.0, 0.0, 1.0);

  vec3 color = albedo * (direct + ambient) + trans + rim + spec;

  #ifdef EMISSIVE_TIP
    float tipMask = pow(clamp(vSurf.x, 0.0, 1.0), uEmissive.y);
    float pulse = 1.0 + sin(uTime * uEmissive.w + vInst.w * 6.28318) * uEmissive.z;
    color += uEmissiveColor * uEmissive.x * vInst.y * tipMask * max(pulse, 0.0);
  #endif

  #ifdef FRAMING_SILHOUETTE
    // Foreground framing: crush toward a flat dark mass, keep only the rim so the shape
    // still reads as coral rather than a black blob (B章「画面端をわずかに縁取り」).
    vec3 silhouette = uColorA * (ambient * 0.35) + rim * uFrame.y;
    color = mix(color, silhouette, uFrame.x);
  #endif

  color = applyAerial(color, vWorld, cameraPosition);

  gl_FragColor = vec4(max(color, 0.0), 1.0);
}
`;

/**
 * @param {object} shared shared uniform object (identity is reused across materials)
 * @param {object} opts   { albedo, encrust, emissive, framing, doubleSided, quality }
 */
export function createWorldMaterial(shared, opts = {}) {
  const defines = { Q_FULL: opts.quality === 'reduced' ? 0 : 1 };
  const albedoMode = opts.albedo ?? 'flat';
  if (albedoMode === 'terrain') defines.ALBEDO_TERRAIN = '';
  else if (albedoMode === 'tower') defines.ALBEDO_TOWER = '';
  else if (albedoMode === 'tip') defines.ALBEDO_TIP = '';
  else if (albedoMode === 'plate') defines.ALBEDO_PLATE = '';
  if (opts.encrust) defines.USE_ENCRUST = '';
  if (opts.emissive) defines.EMISSIVE_TIP = '';
  if (opts.framing) defines.FRAMING_SILHOUETTE = '';
  if (opts.doubleSided) defines.DOUBLE_SIDED_SURFACE = '';

  const uniforms = THREE.UniformsUtils.merge([
    {
      uBaseColor: { value: new THREE.Color(0xffffff) },
      uInstDefault: { value: new THREE.Vector4(1, 0, 0, 0) },
      uSway: { value: new THREE.Vector2(0.5, 1) },
      uColorA: { value: new THREE.Color(0x808080) },
      uColorB: { value: new THREE.Color(0xffffff) },
      uColorC: { value: new THREE.Color(0x303030) },
      uTipPower: { value: 1.4 },
      uSlopeSharpness: { value: 3.0 },
      uEncrustColor: { value: new THREE.Color(0xffffff) },
      uEncrust: { value: new THREE.Vector2(0, 0.4) },
      uEmissiveColor: { value: new THREE.Color(0x49d8ff) },
      uEmissive: { value: new THREE.Vector4(0, 2, 0.2, 0.5) },
      uFrame: { value: new THREE.Vector2(0, 1) },
      uColorJitter: { value: 0.12 },
      uRimScale: { value: 1.0 },
    },
  ]);
  // Shared uniforms keep their original object identity so one write updates everything.
  Object.assign(uniforms, shared);

  uniforms.uRimScale.value = opts.rimScale ?? 1.0;

  return new THREE.ShaderMaterial({
    defines,
    uniforms,
    vertexShader: GLSL_SHARED_UNIFORMS + WORLD_VERT,
    fragmentShader:
      GLSL_SHARED_UNIFORMS + GLSL_NOISE + GLSL_DAPPLE + GLSL_SUN + GLSL_AERIAL + WORLD_FRAG,
    side: opts.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
  });
}

/* ================================================================== *
 * Sky — fullscreen quad, drawn before the world into the same HDR target
 * ================================================================== */

const SKY_VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

const SKY_RAY = /* glsl */ `
uniform mat4 uInvProjection;
uniform mat4 uCameraWorld;
uniform vec3 uCameraPos;
varying vec2 vUv;

vec3 rayDirection(){
  vec4 clip = vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec4 view = uInvProjection * clip;
  view /= view.w;
  return normalize(mat3(uCameraWorld) * view.xyz);
}
`;

const SKY_FRAG = /* glsl */ `
float canopyDensity(vec3 dir){
  if (uCanopyMix.y < 0.5 || dir.y < 0.012) return 0.0;
  float tPlane = uCanopy.x / dir.y;
  vec2 uvp = (uCameraPos.xz + dir.xz * tPlane) * uCanopy.y;
  float drift = uTime * uCanopy.z * 0.02;
  vec3 q = vec3(uvp.x + drift, uvp.y - drift * 0.6, drift * 0.35);
  int oct = int(CANOPY_OCTAVES);
  float n = fbm3(q, oct, 2.05, 0.55) * 0.5 + 0.5;
  // Second, slower layer breaks the single-scale look of plain fbm.
  float n2 = fbm3(q * 0.43 + 11.7, max(oct - 1, 1), 2.1, 0.5) * 0.5 + 0.5;
  n = mix(n, n * n2 * 1.8, 0.45);
  float cov = smoothstep(uCanopyMix.x - 0.22, uCanopyMix.x + 0.30, n);
  // Grazing angles stack more canopy: fade in from the horizon.
  float grazing = smoothstep(0.015, 0.42, dir.y);
  return pow(cov, uCanopy.w) * grazing;
}

void main(){
  vec3 dir = rayDirection();
  float h = dir.y;
  float cosA = dot(dir, uSunDir);

  vec3 col = mix(uSkyHorizon, uSkyZenith, pow(clamp(h, 0.0, 1.0), 1.0 / max(uSkyGradientPower, 0.01)));
  col = mix(uSkyGround, col, smoothstep(-0.09, 0.02, h));

  col += uHaloColor * pow(clamp(cosA, 0.0, 1.0), uHalo.y) * uHalo.x;

  float cd = canopyDensity(dir);
  if (cd > 0.0){
    // The canopy is lit from behind, so it is brightest around the sun.
    vec3 lit = uCanopyColor * (0.30 + pow(clamp(cosA, 0.0, 1.0), 3.2) * 1.75);
    col = mix(col, lit, clamp(cd, 0.0, 1.0));
  }

  if (uCanopyMix.z > 0.5){
    float s = hash21(floor(dir.xz * 620.0 + dir.y * 130.0));
    float star = smoothstep(0.9975, 1.0, s) * smoothstep(0.05, 0.6, h);
    col += vec3(star) * 1.4;
  }

  // Sun disc, in HDR so it drives both bloom and the god-ray occlusion buffer.
  float ang = acos(clamp(cosA, -1.0, 1.0));
  float disc = 1.0 - smoothstep(uSunDisc.x * (1.0 - uSunDisc.y), uSunDisc.x, ang);
  vec3 sunCol = sunRadiance();
  col += normalize(sunCol + 1e-4) * uSunDisc.z * disc;

  // Blend the horizon into the far fog band so distant geometry dissolves seamlessly.
  col = mix(col, uFogFar, smoothstep(0.22, -0.06, h) * uHorizonBlend);

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

const SKY_OCCLUSION_FRAG = /* glsl */ `
uniform float uOcclusionHalo;
void main(){
  vec3 dir = rayDirection();
  float cosA = dot(dir, uSunDir);
  float ang = acos(clamp(cosA, -1.0, 1.0));
  float disc = 1.0 - smoothstep(uSunDisc.x * (1.0 - uSunDisc.y), uSunDisc.x, ang);
  // A tight halo around the disc widens the shaft base without washing the whole frame.
  float halo = pow(clamp(cosA, 0.0, 1.0), max(uHalo.y * 2.2, 1.0)) * uOcclusionHalo;
  float v = clamp(disc + halo, 0.0, 1.0);
  gl_FragColor = vec4(vec3(v), 1.0);
}
`;

function skyUniforms(shared, extra = {}) {
  const u = {
    uInvProjection: { value: new THREE.Matrix4() },
    uCameraWorld: { value: new THREE.Matrix4() },
    uCameraPos: { value: new THREE.Vector3() },
    ...extra,
  };
  Object.assign(u, shared);
  return u;
}

export function createSkyMaterial(shared, canopyOctaves = 4) {
  return new THREE.ShaderMaterial({
    defines: { CANOPY_OCTAVES: `${Math.max(1, Math.round(canopyOctaves))}.0`, Q_FULL: 1 },
    uniforms: skyUniforms(shared),
    vertexShader: SKY_VERT,
    fragmentShader: GLSL_SHARED_UNIFORMS + GLSL_NOISE + GLSL_SUN + SKY_RAY + SKY_FRAG,
    depthTest: false,
    depthWrite: false,
  });
}

export function createSkyOcclusionMaterial(shared, occlusionHalo = 0.55) {
  return new THREE.ShaderMaterial({
    defines: { Q_FULL: 1 },
    uniforms: skyUniforms(shared, { uOcclusionHalo: { value: occlusionHalo } }),
    vertexShader: SKY_VERT,
    fragmentShader: GLSL_SHARED_UNIFORMS + GLSL_NOISE + GLSL_SUN + SKY_RAY + SKY_OCCLUSION_FRAG,
    depthTest: false,
    depthWrite: false,
  });
}

/** Flat black — every occluder writes this into the god-ray occlusion buffer. */
export function createOccluderMaterial() {
  // DoubleSide so the fan corals (which render double-sided) still block the light.
  return new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
}

/* ================================================================== *
 * Far ridges — B章 遠景「霧に沈む塔状の巨大シルエット」, one draw call
 * ================================================================== */

const RIDGE_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main(){
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const RIDGE_FRAG = /* glsl */ `
uniform int   uLayers;
uniform vec4  uRidge;        // x: baseHeight, y: amplitude, z: frequency, w: spikiness
uniform vec2  uRidgeMisc;    // x: layerFalloff, y: driftSpeed
uniform vec3  uRidgeNear;
uniform vec3  uRidgeFar;
uniform float uRidgeOpacity;
varying vec2 vUv;
varying vec3 vWorld;

float ridgeProfile(float x, float spikiness){
  float n = 0.0;
  n += (1.0 - abs(snoise(vec3(x, 0.0, 0.0)))) * 0.55;
  n += (1.0 - abs(snoise(vec3(x * 2.13 + 5.2, 0.0, 0.0)))) * 0.28;
  n += (1.0 - abs(snoise(vec3(x * 4.31 - 3.1, 0.0, 0.0)))) * 0.17;
  return pow(clamp(n, 0.0, 1.0), spikiness);
}

void main(){
  float aa = fwidth(vUv.y) * 1.4 + 0.0012;
  vec3 col = vec3(0.0);
  float alpha = 0.0;

  for (int i = 0; i < 6; i++){
    if (i >= uLayers) break;
    float li = float(i);
    float freq = uRidge.z * (1.0 + li * 0.62);
    float x = vUv.x * freq + li * 13.7 + uTime * uRidgeMisc.y * (1.0 + li * 0.35);
    float amp = uRidge.y * pow(uRidgeMisc.x, li);
    float hgt = uRidge.x + ridgeProfile(x, uRidge.w) * amp;

    float cov = smoothstep(hgt + aa, hgt - aa, vUv.y);
    float t = uLayers > 1 ? li / float(uLayers - 1) : 0.0;
    vec3 c = mix(uRidgeNear, uRidgeFar, t);

    col += c * cov * (1.0 - alpha);
    alpha += cov * (1.0 - alpha);
  }

  if (alpha < 0.002) discard;

  #ifdef RIDGE_OCCLUSION
    // Occlusion variant: the far spires must block god rays exactly where they are opaque,
    // which a flat overrideMaterial on this quad could never do.
    gl_FragColor = vec4(0.0, 0.0, 0.0, alpha * uRidgeOpacity);
  #else
    col = applyAerial(col, vWorld, cameraPosition);
    gl_FragColor = vec4(col, alpha * uRidgeOpacity);
  #endif
}
`;

/**
 * Returns { main, occlusion } sharing one ridge-uniform object, so a slider move updates
 * the visible silhouette and the god-ray occluder in the same frame.
 */
export function createRidgeMaterials(shared, p) {
  const ridgeUniforms = {
    uLayers: { value: Math.round(p.layers) },
    uRidge: { value: new THREE.Vector4(p.baseHeight, p.amplitude, p.frequency, p.spikiness) },
    uRidgeMisc: { value: new THREE.Vector2(p.layerFalloff, p.driftSpeed) },
    uRidgeNear: { value: C(p.colorNear) },
    uRidgeFar: { value: C(p.colorFar) },
    uRidgeOpacity: { value: p.opacity },
  };
  const build = (occlusion) => {
    const uniforms = { ...ridgeUniforms };
    Object.assign(uniforms, shared);
    return new THREE.ShaderMaterial({
      defines: occlusion ? { Q_FULL: 1, RIDGE_OCCLUSION: '' } : { Q_FULL: 1 },
      uniforms,
      vertexShader: GLSL_SHARED_UNIFORMS + RIDGE_VERT,
      fragmentShader: GLSL_SHARED_UNIFORMS + GLSL_NOISE + GLSL_SUN + GLSL_AERIAL + RIDGE_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  };
  return { main: build(false), occlusion: build(true), uniforms: ridgeUniforms };
}

/* ================================================================== *
 * Motes — floating particles (C章「浮遊粒子」)
 * ================================================================== */

const MOTE_VERT = /* glsl */ `
attribute vec4 aMote;    // x: size rand, y: phase, z: speed rand, w: drift rand

uniform float uPixelRatio;
uniform vec3  uSpread;
uniform vec3  uMoteMotion;   // x: rise, y: drift speed, z: drift scale
uniform vec2  uMoteSize;     // x: min, y: max
uniform float uNearFade;

varying float vTwinkleSeed;
varying vec3  vWorld;
varying float vFade;

void main(){
  vec3 p = position;

  // Vertical wrap: motes rise and re-enter at the bottom of the volume.
  float span = uSpread.y;
  float rise = uTime * uMoteMotion.x * (0.55 + aMote.z);
  p.y = mod(p.y + rise + span * 0.5, span) - span * 0.5;

  float t = uTime * uMoteMotion.y * (0.6 + aMote.w * 0.8);
  float ph = aMote.y * 6.28318;
  p.x += sin(t + ph) * uMoteMotion.z;
  p.z += cos(t * 0.83 + ph * 1.4) * uMoteMotion.z;
  p.y += sin(t * 0.61 + ph * 0.7) * uMoteMotion.z * 0.45;

  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;

  vec4 mv = viewMatrix * world;
  float dist = -mv.z;

  float size = mix(uMoteSize.x, uMoteSize.y, aMote.x);
  gl_PointSize = size * uPixelRatio * (12.0 / max(dist, 0.4));

  // Fade out anything that drifts into the near plane so it never smears the frame.
  vFade = smoothstep(0.0, 1.0, (dist - uNearFade) / max(uNearFade, 0.001));
  vTwinkleSeed = aMote.y;

  gl_Position = projectionMatrix * mv;
}
`;

const MOTE_FRAG = /* glsl */ `
uniform vec3  uMoteColor;
uniform vec4  uMoteLook;   // x: opacity, y: twinkle speed, z: twinkle amount, w: softness
uniform float uSunBias;

varying float vTwinkleSeed;
varying vec3  vWorld;
varying float vFade;

void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  if (r > 1.0) discard;
  float shape = pow(1.0 - r, uMoteLook.w);

  float tw = 1.0 - uMoteLook.z + uMoteLook.z * (0.5 + 0.5 * sin(uTime * uMoteLook.y + vTwinkleSeed * 47.3));

  // Motes sitting inside a shaft catch far more light than those off-axis.
  vec3 toEye = normalize(cameraPosition - vWorld);
  float sunAlign = pow(clamp(dot(-toEye, -uSunDir), 0.0, 1.0), 3.0);
  float boost = 1.0 + sunAlign * uSunBias;

  vec3 col = uMoteColor * sunRadiance() * 0.35 * boost;
  float a = shape * tw * uMoteLook.x * vFade;

  // Distant motes must dissolve into the fog like everything else.
  float dist = length(vWorld - cameraPosition);
  float f = clamp(1.0 - exp(-pow(max(dist * uFogParams.x, 0.0), uFogParams.y)), 0.0, 1.0);
  a *= 1.0 - f * 0.85;

  gl_FragColor = vec4(col * a, a);
}
`;

export function createMoteMaterial(shared, p) {
  const uniforms = {
    uPixelRatio: { value: 1 },
    uSpread: { value: new THREE.Vector3(p.spreadX, p.spreadY, p.spreadZ) },
    uMoteMotion: { value: new THREE.Vector3(p.riseSpeed, p.driftSpeed, p.driftScale) },
    uMoteSize: { value: new THREE.Vector2(p.sizeMin, p.sizeMax) },
    uMoteColor: { value: C(p.color) },
    uMoteLook: { value: new THREE.Vector4(p.opacity, p.twinkleSpeed, p.twinkleAmount, p.softness) },
    uSunBias: { value: p.sunBias },
    uNearFade: { value: p.nearFade },
  };
  Object.assign(uniforms, shared);
  return new THREE.ShaderMaterial({
    defines: { Q_FULL: 1 },
    uniforms,
    vertexShader: GLSL_SHARED_UNIFORMS + MOTE_VERT,
    fragmentShader: GLSL_SHARED_UNIFORMS + GLSL_NOISE + GLSL_SUN + MOTE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
