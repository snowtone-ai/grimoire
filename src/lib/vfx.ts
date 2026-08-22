/* Visual effect engine — additive sprite particles on one shared canvas (D-047).
 *
 * Replaces canvas-confetti and the DOM-span tap spark. One engine now draws
 * every effect in the app from the vendored Kenney textures, so "what an effect
 * looks like" is a data question (domain/vfx-scenes.ts) rather than a per-call-
 * site pile of options.
 *
 * Why a single canvas rather than a component per effect:
 *   - Effects outlive the screen that started them. A completion burst fired as
 *     the user navigates away has to keep drawing; parenting it to a React tree
 *     is what made the old confetti code need an explicit per-burst canceller at
 *     every call site (and miss it at three of them — see T031's review).
 *   - Additive blending is the whole reason these read as light rather than as
 *     confetti, and it needs the sprites in one compositing context.
 *
 * Performance discipline (D-024, unchanged): the canvas only exists while
 * something is on it, the rAF loop stops dead when the last particle dies, and
 * nothing here animates blur or filter. Tinting is done once per
 * texture+colour into a small offscreen cache, never per frame.
 */

import { isEffectEnabled, prefersReducedMotion } from "./fx.ts";
import { rarityStyle } from "./domain/rarity-style.ts";
import {
  ALL_CLEAR_SCENE,
  ALL_VFX_TEXTURES,
  clearScene,
  FLOURISH_SCENE,
  MORNING_SCENE,
  pageScene,
  RARITY_TINT,
  replayScene,
  TAP_SCENE,
  type VfxEmitter,
  type VfxMotion,
  type VfxScene,
} from "./domain/vfx-scenes.ts";

/* ------------------------------------------------------------ textures ---- */

const images = new Map<string, HTMLImageElement>();

function texture(name: string): HTMLImageElement | null {
  const cached = images.get(name);
  if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;

  const image = new Image();
  image.decoding = "async";
  image.src = `/vfx/${name}`;
  image.addEventListener("error", () => console.error(`[vfx] missing texture ${name}`), {
    once: true,
  });
  images.set(name, image);
  return null;
}

/** Warm every texture, so the first effect of a session is not a frame of
 * nothing while a PNG downloads. Cheap: ~280 KB for the whole set. */
export function preloadVfx(): void {
  if (typeof window === "undefined") return;
  for (const name of ALL_VFX_TEXTURES) texture(name);
}

/* The textures are white with an alpha channel, so a tint is one "source-in"
 * fill over a copy — done once per texture+colour pair and kept, because doing
 * it per particle per frame is what makes sprite engines slow. */
const tinted = new Map<string, HTMLCanvasElement>();

function tint(image: HTMLImageElement, color: string): CanvasImageSource {
  const key = `${image.src}|${color}`;
  const cached = tinted.get(key);
  if (cached) return cached;

  const off = document.createElement("canvas");
  off.width = image.naturalWidth;
  off.height = image.naturalHeight;
  const octx = off.getContext("2d");
  if (!octx) return image;
  octx.drawImage(image, 0, 0);
  octx.globalCompositeOperation = "source-in";
  octx.fillStyle = color;
  octx.fillRect(0, 0, off.width, off.height);
  tinted.set(key, off);
  return off;
}

/* ------------------------------------------------------------- canvas ---- */

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let frame = 0;
let lastFrameAt = 0;

function ensureCanvas(): CanvasRenderingContext2D | null {
  if (ctx) return ctx;
  if (typeof document === "undefined") return null;

  const element = document.createElement("canvas");
  element.setAttribute("aria-hidden", "true");
  /* Above everything, deliberately. Every scene this engine draws is meant to
   * be seen over whatever is on screen — including the drop-reveal card and the
   * open-flourish overlay. The one effect that has to sit *behind* something
   * (the halo under a high-rank reveal card) is not drawn here at all: it lives
   * in that card's own stacking context as CSS, precisely so this canvas never
   * has to negotiate z-index with a modal. */
  element.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:95";
  document.body.append(element);

  const context = element.getContext("2d");
  if (!context) {
    element.remove();
    return null;
  }
  canvas = element;
  ctx = context;
  resize();
  window.addEventListener("resize", resize, { passive: true });
  return ctx;
}

function resize(): void {
  if (!canvas || !ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function teardown(): void {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  window.removeEventListener("resize", resize);
  canvas?.remove();
  canvas = null;
  ctx = null;
}

/* ---------------------------------------------------------- particles ---- */

interface Particle {
  texture: string;
  color: string;
  motion: VfxMotion;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  /** Sway phase, "rise" only — motes drift rather than travel straight up. */
  phase: number;
  sizeFrom: number;
  sizeTo: number;
  rotation: number;
  spin: number;
  opacity: number;
  /** ms remaining before the particle starts drawing. */
  delay: number;
  age: number;
  life: number;
}

const particles: Particle[] = [];

/* A hard ceiling on live particles. The biggest single scene is ~200, and
 * nothing in the app fires two big scenes at once by design — but a user
 * completing several quests very fast can stack them, and an unbounded array is
 * how a phone drops frames. Oldest are dropped first: the newest moment is the
 * one the user is actually looking at. */
const MAX_PARTICLES = 700;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function spawn(emitter: VfxEmitter, originX: number, originY: number, tintColor: string): void {
  const color = emitter.color === RARITY_TINT ? tintColor : emitter.color;

  for (let i = 0; i < emitter.count; i++) {
    const life = rand(emitter.life[0], emitter.life[1]);
    const particle: Particle = {
      texture: emitter.texture,
      color,
      motion: emitter.motion,
      x: originX,
      y: originY,
      vx: 0,
      vy: 0,
      gravity: emitter.gravity,
      phase: Math.random() * Math.PI * 2,
      sizeFrom: rand(emitter.size[0], emitter.size[1]),
      sizeTo: rand(emitter.size[0], emitter.size[1]),
      rotation: Math.random() * Math.PI * 2,
      spin: rand(emitter.spin[0], emitter.spin[1]) * Math.PI * 2,
      opacity: emitter.opacity,
      delay: emitter.delayMs,
      age: 0,
      life,
    };

    if (emitter.motion === "burst") {
      /* 0deg is straight up; `spread` is the half-angle of the cone. */
      const angle = (rand(-emitter.spread, emitter.spread) * Math.PI) / 180 - Math.PI / 2;
      const speed = rand(emitter.speed[0], emitter.speed[1]);
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed;
    } else if (emitter.motion === "rise") {
      /* Motes start spread across the width of the viewport rather than all
       * from one point — they are a field of light, not an explosion. */
      particle.x = originX + rand(-0.46, 0.46) * window.innerWidth;
      particle.y = originY + rand(0, 0.18) * window.innerHeight;
      particle.vy = -rand(emitter.speed[0], emitter.speed[1]);
    } else {
      /* expand / flash: one sprite at the origin, size and alpha do the work. */
      particle.sizeFrom = emitter.size[0];
      particle.sizeTo = emitter.size[1];
    }

    particles.push(particle);
  }

  if (particles.length > MAX_PARTICLES) {
    particles.splice(0, particles.length - MAX_PARTICLES);
  }
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** Fade envelope: in fast, hold, out slow. `flash` skips the hold entirely. */
function envelope(motion: VfxMotion, progress: number): number {
  if (motion === "flash") return 1 - progress;
  if (motion === "expand") return progress < 0.12 ? progress / 0.12 : 1 - (progress - 0.12) / 0.88;
  if (progress < 0.08) return progress / 0.08;
  if (progress > 0.6) return 1 - (progress - 0.6) / 0.4;
  return 1;
}

function step(now: number): void {
  frame = 0;
  const context = ctx;
  if (!context) return;

  const dt = Math.min((now - lastFrameAt) / 1000, 0.05);
  lastFrameAt = now;
  const width = window.innerWidth;
  const height = window.innerHeight;

  context.clearRect(0, 0, width, height);
  context.globalCompositeOperation = "lighter";

  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];

    if (particle.delay > 0) {
      particle.delay -= dt * 1000;
      continue;
    }

    particle.age += dt * 1000;
    if (particle.age >= particle.life) {
      particles.splice(i, 1);
      continue;
    }

    const progress = particle.age / particle.life;

    if (particle.motion === "burst") {
      particle.vy += particle.gravity * dt;
      /* Light air drag, so sprites decelerate into their arc instead of
       * travelling in a clean parabola forever. */
      particle.vx *= 1 - 1.1 * dt;
      particle.vy *= 1 - 0.4 * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
    } else if (particle.motion === "rise") {
      particle.y += particle.vy * dt;
      particle.x += Math.sin(particle.phase + particle.age / 700) * 22 * dt;
    }

    particle.rotation += particle.spin * dt;

    const image = texture(particle.texture);
    if (!image) continue;

    const size =
      particle.motion === "expand"
        ? particle.sizeFrom + (particle.sizeTo - particle.sizeFrom) * easeOut(progress)
        : particle.sizeFrom + (particle.sizeTo - particle.sizeFrom) * progress;

    const alpha = particle.opacity * envelope(particle.motion, progress);
    if (alpha <= 0.01) continue;

    context.globalAlpha = Math.min(alpha, 1);
    context.save();
    context.translate(particle.x, particle.y);
    context.rotate(particle.rotation);
    context.drawImage(tint(image, particle.color), -size / 2, -size / 2, size, size);
    context.restore();
  }

  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";

  if (particles.length > 0) {
    frame = requestAnimationFrame(step);
  } else {
    teardown();
  }
}

function run(): void {
  if (frame) return;
  lastFrameAt = performance.now();
  frame = requestAnimationFrame(step);
}

/* ------------------------------------------------------------- public ---- */

function play(scene: VfxScene, tintColor: string, point?: { x: number; y: number }): void {
  if (typeof window === "undefined") return;
  /* The one invariant that holds for every scene, with no per-effect exception:
   * OS reduced-motion is an accessibility signal, and everything this engine
   * draws is motion. Individual `fire*` functions add their own preference
   * gate on top; none of them may weaken this one. */
  if (prefersReducedMotion()) return;
  if (!ensureCanvas()) return;

  const originX =
    scene.origin === "point" ? (point?.x ?? window.innerWidth / 2) : scene.origin.x * window.innerWidth;
  const originY =
    scene.origin === "point" ? (point?.y ?? window.innerHeight / 2) : scene.origin.y * window.innerHeight;

  for (const emitter of scene.emitters) spawn(emitter, originX, originY, tintColor);
  run();
}

/** Drop everything currently on screen. Called when a screen unmounts, so a
 * burst queued by one screen never lands on its successor. Unlike the old
 * confetti canceller this needs no per-call-site handle: there is one engine,
 * and it owns every particle in the app. */
export function cancelEffects(): void {
  particles.length = 0;
  if (ctx && canvas) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  teardown();
}

/** A glint under the finger, on every press. */
export function fireTapSpark(x: number, y: number): void {
  if (!isEffectEnabled("tapSpark")) return;
  play(TAP_SCENE, "#ffffff", { x, y });
}

/** Quest cleared / bounty claimed, scaled by the RARE 1-8 ladder. */
export function fireCompletionEffect(rarity: number): void {
  if (!isEffectEnabled("completion")) return;
  play(clearScene(rarity), rarityStyle(rarity).color);
}

/** Every quest for the day done. */
export function fireAllClearEffect(): void {
  if (!isEffectEnabled("completion")) return;
  play(ALL_CLEAR_SCENE, "#fbbf24");
}

/** /book replay. Deliberately NOT gated by the completion toggle (D-036,
 * unchanged): the user tapped a collected entry on purpose, and the settings
 * screen promises that always works "regardless of this setting". Reduced
 * motion still applies, via play(). */
export function fireReplayEffect(rarity: number): void {
  play(replayScene(), rarityStyle(rarity).color);
}

/** The app-open flourish's particle half. */
export function fireFlourishEffect(): void {
  if (!isEffectEnabled("openFlourish")) return;
  play(FLOURISH_SCENE, "#fbbf24");
}

/** The morning greeting's particle half. */
export function fireMorningEffect(): void {
  if (!isEffectEnabled("morningGreeting")) return;
  play(MORNING_SCENE, "#fde68a");
}

/** Punctuation on a page turn, themed by destination. */
export function firePageEffect(path: string): void {
  if (!isEffectEnabled("pageTransitions")) return;
  play(pageScene(path), "#fde68a");
}
