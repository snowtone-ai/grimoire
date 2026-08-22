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
 * it per particle per frame is what makes sprite engines slow.
 *
 * Bounded, because the pairs multiply: RARITY_TINT alone resolves to eight
 * distinct colours and six textures accept it, so an unbounded cache reaches
 * ~60 entries after a user has seen every rarity band. Each entry is a
 * 256x256 backing store (~256 KB), which is ~16 MB held for the life of the
 * tab — not a leak, but not something to hand a mid-range phone either.
 * Insertion-order eviction is enough: no single scene uses more than 13
 * texture+colour pairs, so an in-flight effect can never evict its own
 * entries and thrash. */
const tinted = new Map<string, HTMLCanvasElement>();
const MAX_TINTED = 32;

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

  if (tinted.size >= MAX_TINTED) {
    const oldest = tinted.keys().next();
    if (!oldest.done) tinted.delete(oldest.value);
  }
  tinted.set(key, off);
  return off;
}

/* ------------------------------------------------------------- canvas ---- */

/* Two layers, not one.
 *
 * Most of what this engine draws is meant to be seen over everything on screen
 * — a completion burst, the open flourish, a page sweep — so "front" sits at
 * z-index 95, above even the drop-reveal card and the flourish overlay.
 *
 * But not all of it. The morning greeting is weather, not UI: D-036's F-1
 * settled that its light must never paint over the quest list the user opened
 * the app to read, which is why `.morning-light` is pinned at z-index -1 with
 * a comment saying so. Its particle half has to obey the same rule, so it
 * draws on "behind" — the same layer as the fixed atmosphere.
 *
 * (The halo under a high-rank reveal card is a third case and is not drawn
 * here at all: it has to sit inside that card's own stacking context, so it
 * lives in drop-reveal.tsx as CSS.) */
export type VfxLayer = "behind" | "front";

interface Layer {
  canvas: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  readonly zIndex: string;
}

const layers: Record<VfxLayer, Layer> = {
  behind: { canvas: null, ctx: null, zIndex: "-1" },
  front: { canvas: null, ctx: null, zIndex: "95" },
};

const LAYER_NAMES: readonly VfxLayer[] = ["behind", "front"];

let frame = 0;
let lastFrameAt = 0;

function ensureLayer(name: VfxLayer): CanvasRenderingContext2D | null {
  const layer = layers[name];
  if (layer.ctx) return layer.ctx;
  if (typeof document === "undefined") return null;

  const element = document.createElement("canvas");
  element.setAttribute("aria-hidden", "true");
  element.style.cssText = `position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:${layer.zIndex}`;
  document.body.append(element);

  const context = element.getContext("2d");
  if (!context) {
    element.remove();
    return null;
  }
  layer.canvas = element;
  layer.ctx = context;
  resizeLayer(layer);
  /* One listener for both layers, added on the first canvas of a run and
   * removed in teardown(); the `ctx` guard above makes double-adding
   * impossible. */
  window.addEventListener("resize", resize, { passive: true });
  return context;
}

function resizeLayer(layer: Layer): void {
  if (!layer.canvas || !layer.ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  layer.canvas.width = Math.floor(window.innerWidth * dpr);
  layer.canvas.height = Math.floor(window.innerHeight * dpr);
  layer.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resize(): void {
  for (const name of LAYER_NAMES) resizeLayer(layers[name]);
}

function teardown(): void {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  window.removeEventListener("resize", resize);
  for (const name of LAYER_NAMES) {
    const layer = layers[name];
    layer.canvas?.remove();
    layer.canvas = null;
    layer.ctx = null;
  }
}

/* ---------------------------------------------------------- particles ---- */

/* Who a particle belongs to, which decides whether it survives a screen
 * unmount. A completion burst belongs to the screen that fired it and must not
 * land on the next one. A page sweep is the opposite: BottomNav fires it and
 * *then* navigates, so the screen being left would otherwise delete the very
 * arrival effect that click just started — which is exactly what happened
 * before this distinction existed, but only when leaving Home or /book (the
 * two screens that register an unmount cleanup), so the sweep was present on
 * two tabs and absent on the other two. */
type ParticleOwner = "screen" | "global";

interface Particle {
  texture: string;
  color: string;
  motion: VfxMotion;
  layer: VfxLayer;
  owner: ParticleOwner;
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

function spawn(
  emitter: VfxEmitter,
  originX: number,
  originY: number,
  tintColor: string,
  layer: VfxLayer,
  owner: ParticleOwner
): void {
  const color = emitter.color === RARITY_TINT ? tintColor : emitter.color;
  /* Only tumbling sprites get a random start angle. `expand` and `flash` draw
   * one sprite whose whole job is its shape, and two of the textures are
   * directional — flare.png is a horizontal anamorphic light bar, swirl.png a
   * pair of crescent arcs. Both are used as the single streak in every page
   * sweep and in the all-clear, with spin 0, so a random angle froze them
   * there for life: the "horizontal flare across the middle" the scene
   * promises was horizontal about one time in ninety, and each destination's
   * arrival motif was unrecognisable from one visit to the next. */
  const oriented = emitter.motion === "expand" || emitter.motion === "flash";

  for (let i = 0; i < emitter.count; i++) {
    const life = rand(emitter.life[0], emitter.life[1]);
    const particle: Particle = {
      texture: emitter.texture,
      color,
      motion: emitter.motion,
      layer,
      owner,
      x: originX,
      y: originY,
      vx: 0,
      vy: 0,
      gravity: emitter.gravity,
      phase: Math.random() * Math.PI * 2,
      sizeFrom: rand(emitter.size[0], emitter.size[1]),
      sizeTo: rand(emitter.size[0], emitter.size[1]),
      rotation: oriented ? 0 : Math.random() * Math.PI * 2,
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

  const dt = Math.min((now - lastFrameAt) / 1000, 0.05);
  lastFrameAt = now;
  const width = window.innerWidth;
  const height = window.innerHeight;

  for (const name of LAYER_NAMES) {
    const context = layers[name].ctx;
    if (!context) continue;
    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = "lighter";
  }

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

    const context = layers[particle.layer].ctx;
    if (!context) continue;

    context.globalAlpha = Math.min(alpha, 1);
    context.save();
    context.translate(particle.x, particle.y);
    context.rotate(particle.rotation);
    context.drawImage(tint(image, particle.color), -size / 2, -size / 2, size, size);
    context.restore();
  }

  for (const name of LAYER_NAMES) {
    const context = layers[name].ctx;
    if (!context) continue;
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
  }

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

interface PlayOptions {
  point?: { x: number; y: number };
  layer?: VfxLayer;
  owner?: ParticleOwner;
}

function play(scene: VfxScene, tintColor: string, options: PlayOptions = {}): void {
  if (typeof window === "undefined") return;
  /* The one invariant that holds for every scene, with no per-effect exception:
   * OS reduced-motion is an accessibility signal, and everything this engine
   * draws is motion. Individual `fire*` functions add their own preference
   * gate on top; none of them may weaken this one. */
  if (prefersReducedMotion()) return;

  const layer = options.layer ?? "front";
  const owner = options.owner ?? "screen";
  if (!ensureLayer(layer)) return;

  const point = options.point;
  const originX =
    scene.origin === "point" ? (point?.x ?? window.innerWidth / 2) : scene.origin.x * window.innerWidth;
  const originY =
    scene.origin === "point" ? (point?.y ?? window.innerHeight / 2) : scene.origin.y * window.innerHeight;

  for (const emitter of scene.emitters) {
    spawn(emitter, originX, originY, tintColor, layer, owner);
  }
  run();
}

/** Drop everything currently on screen, including effects that would otherwise
 * survive a navigation. For a deliberate supersede — a second /book entry
 * tapped while the first is still drawing, or the open flourish being
 * dismissed — where the old effect is genuinely finished with. Unlike the old
 * confetti canceller this needs no per-call-site handle: there is one engine,
 * and it owns every particle in the app. */
export function cancelEffects(): void {
  particles.length = 0;
  teardown();
}

/** Drop only what the unmounting screen owns, leaving a page sweep the same
 * click just fired alone. This is what a screen's unmount cleanup wants: the
 * point is that *this screen's* burst must not land on its successor, not that
 * the successor's own arrival effect should be cancelled on arrival. */
export function cancelScreenEffects(): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    if (particles[i].owner === "screen") particles.splice(i, 1);
  }
  if (particles.length === 0) {
    teardown();
    return;
  }
  /* Something global is still drawing, so the canvases stay — but clear them
   * now rather than leaving the cancelled sprites up until the next frame. */
  for (const name of LAYER_NAMES) {
    layers[name].ctx?.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }
}

/* rAF stops while the tab is hidden, which leaves the last drawn frame sitting
 * on a canvas that is never torn down — and, because dt is clamped, returning
 * ten minutes later resumes the burst from where it froze and plays out the
 * remainder as if no time had passed. Neither is what the user means by coming
 * back to the app, so drop it. */
if (typeof document !== "undefined") {
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.visibilityState === "hidden") cancelEffects();
    },
    { passive: true }
  );
}

/** A glint under the finger, on every press. */
export function fireTapSpark(x: number, y: number): void {
  if (!isEffectEnabled("tapSpark")) return;
  play(TAP_SCENE, "#ffffff", { point: { x, y } });
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

/** The app-open flourish's particle half. Global: it is mounted in the root
 * layout and belongs to the session, not to whichever screen happens to be
 * under it when the user navigates mid-flourish. */
export function fireFlourishEffect(): void {
  if (!isEffectEnabled("openFlourish")) return;
  play(FLOURISH_SCENE, "#fbbf24", { owner: "global" });
}

/** The morning greeting's particle half. Drawn *behind* the content, matching
 * `.morning-light`'s own z-index: -1 — F-1 (D-036) settled that this greeting
 * must never paint over the quest list the user opened the app to read. */
export function fireMorningEffect(): void {
  if (!isEffectEnabled("morningGreeting")) return;
  play(MORNING_SCENE, "#fde68a", { layer: "behind" });
}

/** Punctuation on a page turn, themed by destination. Global: BottomNav fires
 * this and then navigates, so it must outlive the screen being left. */
export function firePageEffect(path: string): void {
  if (!isEffectEnabled("pageTransitions")) return;
  play(pageScene(path), "#fde68a", { owner: "global" });
}
