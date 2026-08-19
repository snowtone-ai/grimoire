/**
 * passes.js — the post chain, kept deliberately short (A章「ポストプロセス最小限」).
 *
 *   1. occlusion   sun disc + tight halo, with every occluder rendered flat black
 *   2. god rays    radial blur of (1) from the sun's screen position
 *                  — Mitchell, "Volumetric Light Scattering as a Post-Process", GPU Gems 3.
 *                  Chosen over raymarched god rays because it needs no shadow map, which
 *                  keeps Pixel 7a inside budget (G章).
 *   3. bloom       threshold + progressive down/upsample mip chain (Jimenez, SIGGRAPH 2014)
 *   4. composite   scene + rays + bloom → tone map → grade → vignette/grain → sRGB
 *
 * Only the composite pass writes to the screen, and it is the single place where linear
 * light becomes display-referred pixels.
 */

import * as THREE from 'three';

/* ================================================================== *
 * Fullscreen triangle helper
 * ================================================================== */

const FS_VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

class FullScreenPass {
  constructor(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.geometry = g;
    this.material = material;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  render(renderer, target = null) {
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

function makeTarget(w, h, { float = true, depth = false } = {}) {
  const rt = new THREE.WebGLRenderTarget(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), {
    type: float ? THREE.HalfFloatType : THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: depth,
    stencilBuffer: false,
    colorSpace: THREE.LinearSRGBColorSpace,
    generateMipmaps: false,
  });
  return rt;
}

/* ================================================================== *
 * God rays
 * ================================================================== */

const GODRAY_FRAG = /* glsl */ `
uniform sampler2D tOcclusion;
uniform vec2  uLightPos;
uniform vec4  uRay;        // x: density, y: weight, z: decay, w: exposure
uniform float uClampMax;
uniform float uOffScreenFade;
varying vec2 vUv;

void main(){
  vec2 coord = vUv;
  vec2 delta = (vUv - uLightPos) * (1.0 / float(SAMPLES)) * uRay.x;
  float decay = 1.0;
  vec3 acc = vec3(0.0);

  for (int i = 0; i < SAMPLES; i++){
    coord -= delta;
    vec3 s = texture2D(tOcclusion, clamp(coord, vec2(0.0), vec2(1.0))).rgb;
    acc += s * decay * uRay.y;
    decay *= uRay.z;
  }

  acc *= uRay.w;

  // When the sun leaves the frame the streaks would otherwise snap; fade them out instead.
  vec2 over = max(vec2(0.0) - uLightPos, uLightPos - vec2(1.0));
  float outside = max(over.x, over.y);
  acc *= 1.0 - clamp(outside / max(uOffScreenFade, 0.001), 0.0, 1.0);

  gl_FragColor = vec4(min(acc, vec3(uClampMax)), 1.0);
}
`;

/* Cheap 5-tap cross blur, used to soften the radial streaks. */
const BLUR_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uTexel;
uniform float uRadius;
varying vec2 vUv;
void main(){
  vec2 o = uTexel * uRadius;
  vec3 c = texture2D(tDiffuse, vUv).rgb * 0.4;
  c += texture2D(tDiffuse, vUv + vec2( o.x, 0.0)).rgb * 0.15;
  c += texture2D(tDiffuse, vUv + vec2(-o.x, 0.0)).rgb * 0.15;
  c += texture2D(tDiffuse, vUv + vec2(0.0,  o.y)).rgb * 0.15;
  c += texture2D(tDiffuse, vUv + vec2(0.0, -o.y)).rgb * 0.15;
  gl_FragColor = vec4(c, 1.0);
}
`;

/* ================================================================== *
 * Bloom
 * ================================================================== */

const BRIGHT_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec3 uThreshold;   // x: threshold, y: knee, z: 1/(2*knee)
varying vec2 vUv;
void main(){
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float br = max(c.r, max(c.g, c.b));
  // Soft knee (Unity/Jimenez formulation) so the bloom does not pop at the threshold.
  float soft = clamp(br - uThreshold.x + uThreshold.y, 0.0, 2.0 * uThreshold.y);
  soft = soft * soft * uThreshold.z;
  float contrib = max(soft, br - uThreshold.x) / max(br, 1e-4);
  gl_FragColor = vec4(c * contrib, 1.0);
}
`;

const DOWN_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uTexel;
varying vec2 vUv;
void main(){
  vec2 o = uTexel;
  vec3 c = texture2D(tDiffuse, vUv + vec2(-o.x, -o.y)).rgb;
  c += texture2D(tDiffuse, vUv + vec2( o.x, -o.y)).rgb;
  c += texture2D(tDiffuse, vUv + vec2(-o.x,  o.y)).rgb;
  c += texture2D(tDiffuse, vUv + vec2( o.x,  o.y)).rgb;
  gl_FragColor = vec4(c * 0.25, 1.0);
}
`;

const UP_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;   // the smaller mip being upsampled
uniform vec2 uTexel;
uniform float uRadius;
uniform float uStrength;
varying vec2 vUv;
void main(){
  // 3x3 tent filter — the classic progressive-upsample kernel.
  vec2 o = uTexel * uRadius;
  vec3 c = texture2D(tDiffuse, vUv + vec2(-o.x,  o.y)).rgb * 1.0;
  c += texture2D(tDiffuse, vUv + vec2( 0.0,  o.y)).rgb * 2.0;
  c += texture2D(tDiffuse, vUv + vec2( o.x,  o.y)).rgb * 1.0;
  c += texture2D(tDiffuse, vUv + vec2(-o.x,  0.0)).rgb * 2.0;
  c += texture2D(tDiffuse, vUv                  ).rgb * 4.0;
  c += texture2D(tDiffuse, vUv + vec2( o.x,  0.0)).rgb * 2.0;
  c += texture2D(tDiffuse, vUv + vec2(-o.x, -o.y)).rgb * 1.0;
  c += texture2D(tDiffuse, vUv + vec2( 0.0, -o.y)).rgb * 2.0;
  c += texture2D(tDiffuse, vUv + vec2( o.x, -o.y)).rgb * 1.0;
  // Each level is additively blended into the next larger mip. Without this per-level
  // scale a 5-mip chain sums roughly five copies of the highlight into one flat veil.
  gl_FragColor = vec4(c * (1.0 / 16.0) * uStrength, 1.0);
}
`;

/* ================================================================== *
 * Composite
 * ================================================================== */

const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tRays;
uniform sampler2D tBloom;
uniform vec2  uResolution;
uniform float uTime;

uniform float uExposure;
uniform int   uToneMapping;
uniform float uChromatic;

uniform vec3  uRayTint;
uniform float uRayIntensity;
uniform vec3  uBloomTint;
uniform float uBloomIntensity;
uniform float uRaysOn;
uniform float uBloomOn;

uniform float uContrast;
uniform float uSaturation;
uniform float uLift;
uniform float uGain;
uniform float uTemperature;
uniform float uTintShift;
uniform vec3  uShadowTint;
uniform float uShadowAmount;
uniform vec3  uHighlightTint;
uniform float uHighlightAmount;

uniform vec3  uVignette;   // x: amount, y: radius, z: softness
uniform vec2  uGrain;      // x: amount, y: size
uniform float uDither;

varying vec2 vUv;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

vec3 RRTAndODTFit(vec3 v){
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}

vec3 toneACES(vec3 color){
  const mat3 ACESInput = mat3(
    0.59719, 0.07600, 0.02840,
    0.35458, 0.90834, 0.13383,
    0.04823, 0.01566, 0.83777
  );
  const mat3 ACESOutput = mat3(
     1.60475, -0.10208, -0.00327,
    -0.53108,  1.10813, -0.07276,
    -0.07367, -0.00605,  1.07602
  );
  color /= 0.6;
  color = ACESInput * color;
  color = RRTAndODTFit(color);
  color = ACESOutput * color;
  return clamp(color, 0.0, 1.0);
}

vec3 toneNeutral(vec3 color){
  const float startCompression = 0.8 - 0.04;
  const float desaturation = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return clamp(color, 0.0, 1.0);
  float d = 1.0 - startCompression;
  float newPeak = 1.0 - d * d / (peak + d - startCompression);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return clamp(mix(color, vec3(newPeak), g), 0.0, 1.0);
}

vec3 applyToneMapping(vec3 c){
  if (uToneMapping == 0) return toneACES(c);
  if (uToneMapping == 1) return toneNeutral(c);
  if (uToneMapping == 2) return clamp(c / (1.0 + c), 0.0, 1.0);
  return clamp(c, 0.0, 1.0);
}

vec3 linearToSRGB(vec3 c){
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

float hash12(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main(){
  vec2 uv = vUv;
  vec2 centred = uv - 0.5;
  float r2 = dot(centred, centred);

  // Chromatic aberration grows with the square of the radius, like a real lens.
  vec3 scene;
  if (uChromatic > 0.0){
    vec2 off = centred * r2 * uChromatic * 4.0;
    scene.r = texture2D(tScene, uv + off).r;
    scene.g = texture2D(tScene, uv).g;
    scene.b = texture2D(tScene, uv - off).b;
  } else {
    scene = texture2D(tScene, uv).rgb;
  }

  if (uRaysOn > 0.5){
    scene += texture2D(tRays, uv).rgb * uRayTint * uRayIntensity;
  }
  if (uBloomOn > 0.5){
    scene += texture2D(tBloom, uv).rgb * uBloomTint * uBloomIntensity;
  }

  vec3 c = applyToneMapping(scene * uExposure);

  /* --- display-referred grade --------------------------------------- */
  c.r *= 1.0 + uTemperature * 0.32;
  c.b *= 1.0 - uTemperature * 0.32;
  c.g *= 1.0 - uTintShift * 0.22;
  c.r *= 1.0 + uTintShift * 0.10;
  c.b *= 1.0 + uTintShift * 0.10;

  float lum = dot(c, LUMA);
  vec3 st = uShadowTint / max(dot(uShadowTint, LUMA), 1e-4);
  vec3 ht = uHighlightTint / max(dot(uHighlightTint, LUMA), 1e-4);
  c = mix(c, c * st, (1.0 - smoothstep(0.0, 0.55, lum)) * uShadowAmount);
  c = mix(c, c * ht, smoothstep(0.45, 1.0, lum) * uHighlightAmount);

  c = (c - 0.5) * uContrast + 0.5;
  c = uLift + c * (uGain - uLift);
  lum = dot(c, LUMA);
  c = mix(vec3(lum), c, uSaturation);

  float vig = 1.0 - smoothstep(uVignette.y, uVignette.y + uVignette.z, length(centred) * 1.4142);
  c *= mix(1.0, vig, uVignette.x);

  if (uGrain.x > 0.0){
    float g = hash12(floor(uv * uResolution / max(uGrain.y, 0.5)) + fract(uTime) * 91.7);
    c += (g - 0.5) * uGrain.x;
  }

  c = clamp(c, 0.0, 1.0);
  c = linearToSRGB(c);

  if (uDither > 0.0){
    float d = hash12(uv * uResolution + fract(uTime) * 17.3) - 0.5;
    c += d * uDither / 255.0;
  }

  gl_FragColor = vec4(c, 1.0);
}
`;

/* ================================================================== *
 * Pipeline
 * ================================================================== */

export class PostPipeline {
  constructor(renderer, params) {
    this.renderer = renderer;
    this.width = 1;
    this.height = 1;

    this.sceneTarget = makeTarget(1, 1, { float: true, depth: true });
    this.occlusionTarget = makeTarget(1, 1, { float: false });
    // Half-float so `clampMax` above 1.0 keeps its headroom instead of clipping.
    this.rayTargetA = makeTarget(1, 1, { float: true });
    this.rayTargetB = makeTarget(1, 1, { float: true });
    this.bloomMips = [];

    this.godrayPass = new FullScreenPass(new THREE.ShaderMaterial({
      defines: { SAMPLES: Math.round(params.godrays.samples) },
      uniforms: {
        tOcclusion: { value: this.occlusionTarget.texture },
        uLightPos: { value: new THREE.Vector2(0.5, 0.8) },
        uRay: { value: new THREE.Vector4(params.godrays.density, params.godrays.weight, params.godrays.decay, params.godrays.exposure) },
        uClampMax: { value: params.godrays.clampMax },
        uOffScreenFade: { value: params.godrays.offScreenFade },
      },
      vertexShader: FS_VERT,
      fragmentShader: GODRAY_FRAG,
      depthTest: false,
      depthWrite: false,
    }));

    this.blurPass = new FullScreenPass(new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uRadius: { value: 1.0 },
      },
      vertexShader: FS_VERT,
      fragmentShader: BLUR_FRAG,
      depthTest: false,
      depthWrite: false,
    }));

    this.brightPass = new FullScreenPass(new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uThreshold: { value: new THREE.Vector3(1, 0.5, 1) },
      },
      vertexShader: FS_VERT,
      fragmentShader: BRIGHT_FRAG,
      depthTest: false,
      depthWrite: false,
    }));

    this.downPass = new FullScreenPass(new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2() } },
      vertexShader: FS_VERT,
      fragmentShader: DOWN_FRAG,
      depthTest: false,
      depthWrite: false,
    }));

    this.upPass = new FullScreenPass(new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1 }, uStrength: { value: 0.62 } },
      vertexShader: FS_VERT,
      fragmentShader: UP_FRAG,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      transparent: true,
    }));

    this.compositePass = new FullScreenPass(new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: this.sceneTarget.texture },
        tRays: { value: this.rayTargetA.texture },
        tBloom: { value: null },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uExposure: { value: 1 },
        uToneMapping: { value: 0 },
        uChromatic: { value: 0 },
        uRayTint: { value: new THREE.Color(0xffffff) },
        uRayIntensity: { value: 1 },
        uBloomTint: { value: new THREE.Color(0xffffff) },
        uBloomIntensity: { value: 0.6 },
        uRaysOn: { value: 1 },
        uBloomOn: { value: 1 },
        uContrast: { value: 1 },
        uSaturation: { value: 1 },
        uLift: { value: 0 },
        uGain: { value: 1 },
        uTemperature: { value: 0 },
        uTintShift: { value: 0 },
        uShadowTint: { value: new THREE.Color(0xffffff) },
        uShadowAmount: { value: 0 },
        uHighlightTint: { value: new THREE.Color(0xffffff) },
        uHighlightAmount: { value: 0 },
        uVignette: { value: new THREE.Vector3(0.4, 0.7, 0.6) },
        uGrain: { value: new THREE.Vector2(0.03, 1.5) },
        uDither: { value: 0.5 },
      },
      vertexShader: FS_VERT,
      fragmentShader: COMPOSITE_FRAG,
      depthTest: false,
      depthWrite: false,
    }));
  }

  get sceneRenderTarget() {
    return this.sceneTarget;
  }

  /** Reallocates every target. Called on resize and when a `rebuild: 'passes'` param moves. */
  setSize(width, height, params) {
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));

    this.sceneTarget.setSize(this.width, this.height);

    const rs = THREE.MathUtils.clamp(params.godrays.resolutionScale, 0.1, 1);
    const rw = Math.max(1, Math.round(this.width * rs));
    const rh = Math.max(1, Math.round(this.height * rs));
    this.occlusionTarget.setSize(rw, rh);
    this.rayTargetA.setSize(rw, rh);
    this.rayTargetB.setSize(rw, rh);

    for (const mip of this.bloomMips) mip.dispose();
    this.bloomMips = [];
    const mipCount = Math.max(1, Math.round(params.bloom.mips));
    let w = Math.max(1, Math.round(this.width / 2));
    let h = Math.max(1, Math.round(this.height / 2));
    for (let i = 0; i < mipCount; i++) {
      this.bloomMips.push(makeTarget(w, h, { float: true }));
      w = Math.max(1, Math.round(w / 2));
      h = Math.max(1, Math.round(h / 2));
      if (w <= 2 || h <= 2) break;
    }

    this.compositePass.material.uniforms.uResolution.value.set(this.width, this.height);
    this.compositePass.material.uniforms.tScene.value = this.sceneTarget.texture;
    this.godrayPass.material.uniforms.tOcclusion.value = this.occlusionTarget.texture;
  }

  /** Rebuilds the god-ray program when the sample count changes (it is a compile-time loop). */
  setSamples(samples) {
    const s = Math.max(4, Math.round(samples));
    if (this.godrayPass.material.defines.SAMPLES === s) return;
    this.godrayPass.material.defines.SAMPLES = s;
    this.godrayPass.material.needsUpdate = true;
  }

  renderGodRays(params, lightScreenPos) {
    const u = this.godrayPass.material.uniforms;
    u.uLightPos.value.copy(lightScreenPos);
    u.uRay.value.set(params.godrays.density, params.godrays.weight, params.godrays.decay, params.godrays.exposure);
    u.uClampMax.value = params.godrays.clampMax;
    u.uOffScreenFade.value = params.godrays.offScreenFade;
    this.godrayPass.render(this.renderer, this.rayTargetA);

    if (params.godrays.blur) {
      const b = this.blurPass.material.uniforms;
      b.tDiffuse.value = this.rayTargetA.texture;
      b.uTexel.value.set(1 / this.rayTargetA.width, 1 / this.rayTargetA.height);
      b.uRadius.value = 1.0;
      this.blurPass.render(this.renderer, this.rayTargetB);
      const swap = this.rayTargetA;
      this.rayTargetA = this.rayTargetB;
      this.rayTargetB = swap;
    }
    this.compositePass.material.uniforms.tRays.value = this.rayTargetA.texture;
  }

  renderBloom(params) {
    if (this.bloomMips.length === 0) return;
    const knee = Math.max(params.bloom.knee * params.bloom.threshold, 1e-4);
    const bu = this.brightPass.material.uniforms;
    bu.tDiffuse.value = this.sceneTarget.texture;
    bu.uThreshold.value.set(params.bloom.threshold, knee, 1 / (4 * knee));
    this.brightPass.render(this.renderer, this.bloomMips[0]);

    for (let i = 1; i < this.bloomMips.length; i++) {
      const src = this.bloomMips[i - 1];
      const du = this.downPass.material.uniforms;
      du.tDiffuse.value = src.texture;
      du.uTexel.value.set(1 / src.width, 1 / src.height);
      this.downPass.render(this.renderer, this.bloomMips[i]);
    }

    for (let i = this.bloomMips.length - 1; i > 0; i--) {
      const src = this.bloomMips[i];
      const uu = this.upPass.material.uniforms;
      uu.tDiffuse.value = src.texture;
      uu.uTexel.value.set(1 / src.width, 1 / src.height);
      uu.uRadius.value = params.bloom.radius;
      this.upPass.render(this.renderer, this.bloomMips[i - 1]);
    }

    this.compositePass.material.uniforms.tBloom.value = this.bloomMips[0].texture;
  }

  /** Pushes the whole grade block, then draws to the screen. */
  composite(params, time) {
    const u = this.compositePass.material.uniforms;
    const g = params.grade;
    u.uTime.value = time;
    u.uExposure.value = g.exposure;
    u.uToneMapping.value = { aces: 0, neutral: 1, reinhard: 2, none: 3 }[g.toneMapping] ?? 0;
    u.uChromatic.value = g.chromatic;
    u.uContrast.value = g.contrast;
    u.uSaturation.value = g.saturation;
    u.uLift.value = g.lift;
    u.uGain.value = g.gain;
    u.uTemperature.value = g.temperature;
    u.uTintShift.value = g.tintShift;
    u.uShadowTint.value.setHex(g.shadowTint);
    u.uShadowAmount.value = g.shadowTintAmount;
    u.uHighlightTint.value.setHex(g.highlightTint);
    u.uHighlightAmount.value = g.highlightTintAmount;
    u.uVignette.value.set(g.vignetteAmount, g.vignetteRadius, g.vignetteSoftness);
    u.uGrain.value.set(g.grainAmount, g.grainSize);
    u.uDither.value = g.dither;

    u.uRaysOn.value = params.godrays.enabled ? 1 : 0;
    u.uRayIntensity.value = params.godrays.intensity;
    u.uRayTint.value.setHex(params.godrays.tint);
    u.uBloomOn.value = params.bloom.enabled && this.bloomMips.length > 0 ? 1 : 0;
    u.uBloomIntensity.value = params.bloom.intensity;
    u.uBloomTint.value.setHex(params.bloom.tint);
    if (!u.tBloom.value && this.bloomMips.length > 0) u.tBloom.value = this.bloomMips[0].texture;

    this.compositePass.render(this.renderer, null);
  }

  dispose() {
    this.sceneTarget.dispose();
    this.occlusionTarget.dispose();
    this.rayTargetA.dispose();
    this.rayTargetB.dispose();
    for (const m of this.bloomMips) m.dispose();
    this.godrayPass.dispose();
    this.blurPass.dispose();
    this.brightPass.dispose();
    this.downPass.dispose();
    this.upPass.dispose();
    this.compositePass.dispose();
  }
}
