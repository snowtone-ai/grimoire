/* Mana orb renderer — a raymarched glass sphere on a WebGL canvas (D-049).
 *
 * Browser half of the orb; the tuning and the physics live in
 * src/lib/domain/mana-orb.ts. Everything here is one self-contained handle so
 * the React component owns nothing but mount/unmount.
 *
 * Why raymarching and not a sprite or CSS: the shell refracts *twice* — once on
 * the way in and once on the far wall — which is what separates glass from a
 * flat tinted disc, and neither refraction can be faked with a static image
 * once the surface is wobbling and squashing under the finger.
 *
 * Battery discipline (D-038's rule for the ambient layer applies here too): a
 * fragment shader running forever behind a button is exactly the open rAF loop
 * that rule exists to prevent, so the loop is suspended whenever the tab is
 * hidden or the button scrolls out of view, and prefers-reduced-motion draws a
 * single still frame and never starts a loop at all.
 */

import {
  MANA_ORB_PARAMS,
  MAX_ORB_STEP,
  createOrbMotion,
  pressDirection,
  pressImpulse,
  stepOrbMotion,
  type ManaOrbParams,
  type OrbMotion,
} from "@/lib/domain/mana-orb";

const VERT = "attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }";

const FRAG = `precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform vec3  uSlosh;
uniform float uSquash;
uniform vec3  uPressDir;
uniform float uPressAmt;
uniform float uClarity;
uniform float uWobble;
uniform float uDensity;
uniform float uIor;
uniform float uDisp;
uniform float uHueBase;
uniform float uHueSpan;
uniform float uCore;
uniform float uFilm;
uniform vec3  uTint;

float hash(vec3 p){
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float vnoise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i + vec3(0.0,0.0,0.0)), hash(i + vec3(1.0,0.0,0.0)), f.x),
                 mix(hash(i + vec3(0.0,1.0,0.0)), hash(i + vec3(1.0,1.0,0.0)), f.x), f.y),
             mix(mix(hash(i + vec3(0.0,0.0,1.0)), hash(i + vec3(1.0,0.0,1.0)), f.x),
                 mix(hash(i + vec3(0.0,1.0,1.0)), hash(i + vec3(1.0,1.0,1.0)), f.x), f.y), f.z);
}

float fbm(vec3 p){
  float a = 0.5; float s = 0.0;
  for (int i = 0; i < 3; i++){
    s += a * vnoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.4);
    a *= 0.5;
  }
  return s * 1.142857;
}

vec3 rotY(vec3 p, float a){
  float c = cos(a); float s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

vec3 iri(float t){
  return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
}

/* Emissive backdrop the glass bends light from. Near-black away from its few
   light sources, so the canvas stays genuinely transparent over the page. */
vec3 backdrop(vec3 o, vec3 d){
  if (d.z > -0.05) return vec3(0.03, 0.04, 0.07) * (0.6 + 0.4 * d.y);
  float tp = (-2.6 - o.z) / d.z;
  vec3 h = o + d * tp;
  vec2 g = abs(fract(h.xy * 0.42 + 0.5) - 0.5);
  float line = smoothstep(0.34, 0.5, max(g.x, g.y));
  float fade = exp(-length(h.xy) * 0.14);
  vec3 col = vec3(0.30, 0.42, 0.78) * line * fade * 0.30;
  col += vec3(0.62, 0.34, 1.00) * exp(-length(h.xy - vec2(-3.0, 2.4)) * 0.52) * 0.52;
  col += vec3(0.16, 0.78, 0.86) * exp(-length(h.xy - vec2( 3.2,-2.6)) * 0.52) * 0.46;
  col += vec3(1.00, 0.62, 0.86) * exp(-length(h.xy - vec2( 2.2, 3.4)) * 0.58) * 0.40;
  col += vec3(1.00, 0.88, 0.60) * exp(-length(h.xy - vec2(-2.6,-3.2)) * 0.60) * 0.32;
  col += vec3(1.00, 1.00, 1.00) * exp(-length(h.xy - vec2(-1.0, 3.0)) * 1.50) * 0.55;
  return col;
}

float map(vec3 p){
  vec3 q = p;
  q.y /= max(0.45, 1.0 - uSquash);
  q.x /= max(0.45, 1.0 + uSquash * 0.52);
  q.z /= max(0.45, 1.0 + uSquash * 0.52);
  float r = 1.0;
  float w = fbm(q * 1.35 + vec3(uSlosh.x * 2.4, uTime * 0.26, uSlosh.z * 2.4)) - 0.5;
  r += w * (0.03 + 0.12 * uWobble);
  vec3 nq = normalize(q + vec3(1e-4));
  r -= smoothstep(0.45, 1.0, dot(nq, uPressDir)) * uPressAmt * 0.19;
  return (length(q) - r) * 0.62;
}

/* Walk from just inside the shell to the far wall. */
float exitT(vec3 p, vec3 d){
  float t = 0.02;
  for (int i = 0; i < 22; i++){
    float dd = map(p + d * t);
    if (dd > -0.0025) break;
    t += max(0.012, -dd * 0.9);
  }
  return t;
}

vec3 calcNormal(vec3 p){
  vec2 e = vec2(1.0, -1.0) * 0.0024;
  return normalize(e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) +
                   e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
}

/* Volumetric mana: a low-frequency ridged field, so the whole mass drifts as
   one body instead of boiling. */
vec4 interior(vec3 p0, vec3 dir){
  vec3 acc = vec3(0.0);
  float alpha = 0.0;
  float t = 0.05;
  for (int i = 0; i < 20; i++){
    vec3 p = p0 + dir * t;
    float rr = length(p);
    if (rr > 1.35) break;
    vec3 sp = rotY(p, uTime * 0.13) * 1.55 + uSlosh * 2.8
            + vec3(0.0, -uTime * 0.19, uTime * 0.08);
    float n = fbm(sp);
    float vein = 1.0 - abs(n * 2.0 - 1.0);
    vein = pow(clamp(vein, 0.0, 1.0), 2.6);
    float dens = vein * (1.0 - smoothstep(0.28, 1.06, rr)) * uDensity;
    float phase = uHueBase + (p.y * 0.42 + p.x * 0.22 + n * 0.95) * uHueSpan - uTime * 0.05;
    vec3 c = iri(phase) * uTint;
    float core = uCore * exp(-rr * rr * 3.0);
    c += iri(uHueBase + 0.52) * uTint * core * 1.4;
    float a = clamp(dens, 0.0, 1.0) * 0.30 * (1.0 - alpha);
    acc += c * (a * 2.2 + core * 0.05);
    alpha += a;
    t += 0.092;
    if (alpha > 0.95) break;
  }
  return vec4(acc, alpha);
}

void main(){
  vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
  vec3 ro = vec3(0.0, 0.0, 3.15);
  vec3 rd = normalize(vec3(uv * 0.56, -1.0));

  vec3 halo = iri(uHueBase + 0.14) * uTint;
  float glow = exp(-length(uv) * 3.4);
  float cd = length(vec2(uv.x * 0.9, (uv.y + 0.80) * 3.0));
  float caustic = exp(-cd * cd * 3.4) * (0.25 + 0.55 * uCore);
  float vign = 1.0 - smoothstep(0.75, 1.35, length(uv));
  vec3 ambient = halo * (glow * 0.24 + caustic * 0.42) * vign;
  float ambientA = (glow * 0.11 + caustic * 0.13) * vign;

  /* Analytic bounding sphere first: background pixels never enter the march. */
  float b = dot(ro, rd);
  float cc = dot(ro, ro) - 1.44 * 1.44;
  float disc = b * b - cc;
  if (disc < 0.0){ gl_FragColor = vec4(ambient, ambientA); return; }
  float sd = sqrt(disc);
  float t = max(0.0, -b - sd);
  float tEnd = -b + sd;

  float hit = 0.0;
  for (int i = 0; i < 56; i++){
    vec3 pp = ro + rd * t;
    float d = map(pp);
    if (d < 0.0018){ hit = 1.0; break; }
    t += d;
    if (t > tEnd) break;
  }
  if (hit < 0.5){ gl_FragColor = vec4(ambient, ambientA); return; }

  vec3 p = ro + rd * t;
  vec3 n = calcNormal(p);
  float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 4.0);

  float ior = max(1.005, uIor);
  vec3 dR = refract(rd, n, 1.0 / (ior - uDisp));
  vec3 dG = refract(rd, n, 1.0 / ior);
  vec3 dB = refract(rd, n, 1.0 / (ior + uDisp));
  if (dot(dG, dG) < 0.0001) dG = reflect(rd, n);
  if (dot(dR, dR) < 0.0001) dR = dG;
  if (dot(dB, dB) < 0.0001) dB = dG;

  /* Second refraction on the way out — this is what makes it read as glass. */
  vec3 pExit = p + dG * exitT(p, dG);
  vec3 nOut = -calcNormal(pExit);
  vec3 oR = refract(dR, nOut, ior - uDisp);
  vec3 oG = refract(dG, nOut, ior);
  vec3 oB = refract(dB, nOut, ior + uDisp);
  if (dot(oG, oG) < 0.0001) oG = reflect(dG, nOut);
  if (dot(oR, oR) < 0.0001) oR = reflect(dR, nOut);
  if (dot(oB, oB) < 0.0001) oB = reflect(dB, nOut);
  vec3 refr = vec3(backdrop(pExit, oR).r, backdrop(pExit, oG).g, backdrop(pExit, oB).b);

  vec4 inner = interior(p, dG);

  float thick = fbm(n * 2.6 + vec3(uSlosh.x * 1.6, uTime * 0.16, uSlosh.z * 1.6));
  vec3 film = iri(uHueBase + thick * 0.5 + fres * 1.05) * uTint;

  /* Specular rides a rounded normal, so the surface wobble cannot flatten the
     highlight into a facet. */
  vec3 ns = normalize(mix(normalize(p), n, 0.40));
  vec3 l1 = normalize(vec3(-0.55, 0.82, 0.60));
  vec3 l2 = normalize(vec3( 0.72,-0.30, 0.52));
  float sp1 = pow(max(dot(ns, normalize(l1 - rd)), 0.0), 900.0);
  float sp2 = pow(max(dot(ns, normalize(l2 - rd)), 0.0), 120.0);

  float clear = 1.0 - 0.55 * uClarity;
  vec3 col = refr * (1.35 - 0.35 * uClarity)
           + inner.rgb * clear * 1.05
           + film * fres * uFilm * 0.62
           + vec3(1.0) * sp1 * 1.10
           + vec3(0.84, 0.92, 1.0) * sp2 * 0.08
           + ambient;

  /* Filmic rolloff: highlights can never clip to a flat white disc. */
  col = col / (1.0 + col * 0.62);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = max(vec3(0.0), mix(vec3(lum), col, 1.45));

  float a = (inner.a * 0.40 + dot(col, vec3(0.30)) * 0.62) * (1.0 - 0.42 * uClarity)
          + fres * (0.14 + 0.22 * uFilm) * clear
          + sp1 * 0.5 + ambientA;
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
}`;

const UNIFORM_NAMES = [
  "uRes",
  "uTime",
  "uSlosh",
  "uSquash",
  "uPressDir",
  "uPressAmt",
  "uClarity",
  "uWobble",
  "uDensity",
  "uIor",
  "uDisp",
  "uHueBase",
  "uHueSpan",
  "uCore",
  "uFilm",
  "uTint",
] as const;

type UniformName = (typeof UNIFORM_NAMES)[number];

export interface ManaOrbHandle {
  /** Begin a press at a viewport point; kicks the squash spring. */
  press(clientX: number, clientY: number): void;
  /** Track a pointer across the orb without pressing. */
  move(clientX: number, clientY: number): void;
  /** End the press and let the spring settle back. */
  release(): void;
  destroy(): void;
}

export interface ManaOrbOptions {
  params?: ManaOrbParams;
  /** Fired if the GPU drops the context mid-session (driver reset, tab evicted
   * under memory pressure). The canvas cannot recover on its own, so the caller
   * is expected to go back to its non-WebGL presentation. */
  onLost?: () => void;
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("shader allocation failed");
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "shader compile failed";
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

/**
 * Attaches an orb renderer to `canvas`. Returns null when WebGL is missing or
 * the program will not build — every caller must be able to fall back to a
 * plain button rather than showing an empty hole.
 */
export function createManaOrb(
  canvas: HTMLCanvasElement,
  options: ManaOrbOptions = {}
): ManaOrbHandle | null {
  const params = options.params ?? MANA_ORB_PARAMS;
  let gl: WebGLRenderingContext | null = null;
  try {
    gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      powerPreference: "low-power",
    }) as WebGLRenderingContext | null;
  } catch {
    return null;
  }
  // A canvas hands back the same context object every time, so a context that
  // was lost earlier can never be replaced by asking again — bail to the CSS
  // fallback instead of building a program on a dead context.
  if (!gl || gl.isContextLost()) return null;
  const ctx = gl;

  let program: WebGLProgram | null = null;
  let vert: WebGLShader | null = null;
  let frag: WebGLShader | null = null;
  try {
    program = ctx.createProgram();
    if (!program) throw new Error("program allocation failed");
    vert = compile(ctx, ctx.VERTEX_SHADER, VERT);
    frag = compile(ctx, ctx.FRAGMENT_SHADER, FRAG);
    ctx.attachShader(program, vert);
    ctx.attachShader(program, frag);
    ctx.linkProgram(program);
    if (!ctx.getProgramParameter(program, ctx.LINK_STATUS)) {
      throw new Error(ctx.getProgramInfoLog(program) ?? "program link failed");
    }
  } catch {
    if (vert) ctx.deleteShader(vert);
    if (frag) ctx.deleteShader(frag);
    if (program) ctx.deleteProgram(program);
    return null;
  }
  const prog = program;

  ctx.useProgram(prog);
  const buffer = ctx.createBuffer();
  ctx.bindBuffer(ctx.ARRAY_BUFFER, buffer);
  ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), ctx.STATIC_DRAW);
  const aPos = ctx.getAttribLocation(prog, "aPos");
  ctx.enableVertexAttribArray(aPos);
  ctx.vertexAttribPointer(aPos, 2, ctx.FLOAT, false, 0, 0);
  ctx.enable(ctx.BLEND);
  ctx.blendFunc(ctx.ONE, ctx.ONE_MINUS_SRC_ALPHA);
  ctx.clearColor(0, 0, 0, 0);

  const uniforms = {} as Record<UniformName, WebGLUniformLocation | null>;
  for (const name of UNIFORM_NAMES) uniforms[name] = ctx.getUniformLocation(prog, name);

  const reduceQuery =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
  let reduceMotion = reduceQuery?.matches ?? false;

  let motion: OrbMotion = createOrbMotion();
  let pressing = false;
  let pointerX = 0;
  let pointerY = 0;
  let pressDir: [number, number, number] = [0, 1, 0];
  let simTime = 0;
  let last = 0;
  let raf = 0;
  let destroyed = false;

  /** Called on init and whenever the element or the window changes — never per
   * frame. getBoundingClientRect forces a layout read, and paying for one on
   * every frame of an animation that exists to be cheap is exactly backwards. */
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round((rect.width || canvas.clientWidth) * dpr));
    const h = Math.max(1, Math.round((rect.height || canvas.clientHeight) * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function draw() {
    ctx.viewport(0, 0, canvas.width, canvas.height);
    ctx.clear(ctx.COLOR_BUFFER_BIT);
    ctx.uniform2f(uniforms.uRes, canvas.width, canvas.height);
    ctx.uniform1f(uniforms.uTime, simTime);
    ctx.uniform3f(uniforms.uSlosh, motion.sloshX, motion.squash * 0.5, motion.sloshZ);
    ctx.uniform1f(uniforms.uSquash, motion.squash);
    ctx.uniform3f(uniforms.uPressDir, pressDir[0], pressDir[1], pressDir[2]);
    ctx.uniform1f(uniforms.uPressAmt, motion.pressAmt);
    ctx.uniform1f(uniforms.uClarity, params.clarity);
    ctx.uniform1f(uniforms.uWobble, params.wobble);
    ctx.uniform1f(uniforms.uDensity, params.density);
    ctx.uniform1f(uniforms.uIor, params.ior);
    ctx.uniform1f(uniforms.uDisp, params.disp);
    ctx.uniform1f(uniforms.uHueBase, params.hueBase);
    ctx.uniform1f(uniforms.uHueSpan, params.hueSpan);
    ctx.uniform1f(uniforms.uCore, params.core);
    ctx.uniform1f(uniforms.uFilm, params.film);
    ctx.uniform3f(uniforms.uTint, params.tint[0], params.tint[1], params.tint[2]);
    ctx.drawArrays(ctx.TRIANGLES, 0, 3);
  }

  function frame(now: number) {
    raf = 0;
    const dt = (now - last) / 1000;
    last = now;
    simTime += Math.min(MAX_ORB_STEP, Math.max(0, dt));
    motion = stepOrbMotion(motion, { pressing, pointerX, pointerY }, dt, params);
    draw();
    raf = window.requestAnimationFrame(frame);
  }

  /** Suspended whenever the orb cannot be seen — a shader running behind a
   * hidden tab is pure battery cost. */
  function running() {
    return raf !== 0;
  }

  function start() {
    if (destroyed || reduceMotion || running()) return;
    last = performance.now();
    raf = window.requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
  }

  let onScreen = true;

  function sync() {
    if (onScreen && !document.hidden) start();
    else stop();
  }

  const onVisibility = () => sync();
  document.addEventListener("visibilitychange", onVisibility);

  const onContextLost = () => {
    stop();
    options.onLost?.();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);

  let observer: IntersectionObserver | null = null;
  if (typeof IntersectionObserver === "function") {
    observer = new IntersectionObserver((entries) => {
      onScreen = entries.some((entry) => entry.isIntersecting);
      sync();
    });
    observer.observe(canvas);
  }

  function remeasure() {
    resize();
    if (!running()) draw();
  }

  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(remeasure);
    resizeObserver.observe(canvas);
  }
  // ResizeObserver watches the element's box, which does not change when the
  // window merely moves to a display with a different pixel ratio — so the
  // window listener is not a duplicate of it.
  window.addEventListener("resize", remeasure);

  // Reduced motion can be switched on while the app is open. Without this the
  // orb would keep animating until the next reload, which is the opposite of
  // what the user just asked their OS for.
  const onReduceChange = (event: MediaQueryListEvent) => {
    reduceMotion = event.matches;
    if (reduceMotion) stop();
    else sync();
    draw();
  };
  reduceQuery?.addEventListener("change", onReduceChange);

  resize();
  draw();
  sync();

  function toLocal(clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointerX = Math.max(-1.6, Math.min(1.6, ((clientX - rect.left) / rect.width) * 2 - 1));
    pointerY = Math.max(-1.6, Math.min(1.6, -(((clientY - rect.top) / rect.height) * 2 - 1)));
    pressDir = pressDirection(pointerX, pointerY);
  }

  return {
    // Under reduced motion the orb is a still image and stays one: the impulse
    // is recorded so the spring is correct if the setting is switched back off
    // mid-press, but nothing is redrawn. A single step would only dent the
    // shell and leave it dented, since no loop exists to bring it back — worse
    // than not reacting at all. The button's own CSS :active still answers the
    // touch, which is the feedback that survives the accessibility setting.
    press(clientX, clientY) {
      if (destroyed) return;
      toLocal(clientX, clientY);
      pressing = true;
      motion = pressImpulse(motion, params);
    },
    move(clientX, clientY) {
      if (destroyed) return;
      toLocal(clientX, clientY);
    },
    release() {
      if (destroyed) return;
      pressing = false;
      pointerX = 0;
      pointerY = 0;
      pressDir = pressDirection(0, 0);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      window.removeEventListener("resize", remeasure);
      reduceQuery?.removeEventListener("change", onReduceChange);
      observer?.disconnect();
      resizeObserver?.disconnect();
      // Resources go back individually; the context itself is deliberately left
      // alive. Forcing WEBGL_lose_context here would free it a little sooner but
      // permanently poison the canvas, and this component is remounted on every
      // development refresh and by React's own double-invoked effects — the
      // second orb would silently never appear.
      ctx.deleteBuffer(buffer);
      ctx.deleteShader(vert);
      ctx.deleteShader(frag);
      ctx.deleteProgram(prog);
    },
  };
}
