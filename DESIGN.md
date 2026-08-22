# DESIGN.md — Grimoire v2 Design System

Status: **authored 2026-08-22, implemented for the UI chrome (T023).** This is
the design language of the UI layer: `src/ui/**`, `src/features/*`'s
components and their CSS, and `src/app/runtime.tsx` are built against it. The
data layer (`src/domain/`, `src/application/`, `src/infrastructure/`) is
untouched by this document and by the rebuild it describes. Sections 9 and 10
below register the tokens the rebuild added; nothing in §§1–8 was revised by
the implementation.

**2026-08-22 addendum (D-013):** the background world and splash moved from a
Three.js build to owner-sourced **video assets** (`anime/`). Component rule 5
in §6 ("World surface") now covers not only a Three.js canvas but also the
video layer and its poster/fallback treatment. The video's own tone and color
stay outside §1's token registry (scene-internal values, same treatment the
rule already gave Three.js scene internals) and outside the §7 raw-value
lint. Chrome drawn on top of the video (back navigation, area selection, the
observation mark, bottom nav) still follows rules 1–4 unchanged.

Rule 6 ("Emblem") stands as written: the app keeps using the 32–64px
wordless mark even with a video splash. When the video is absent, fails to
load, or `prefers-reduced-motion` applies, fall back to the static emblem
treatment.

This file is the registry `scripts/verify.mjs`'s raw-value lint (pm-zero v12.1
§16.2) will check UI-layer changes against once that rebuild lands: a value
outside this registry, used in a shared or feature UI file, needs a named
token added here first — not a one-off literal.

---

## 0. Brief (carried from docs/vision.md and docs/architecture.md §8, not restated there — refined here into concrete tokens)

A local-first task app whose reward for finishing today's work is watching a
living natural-history world grow. The subject is not "productivity app" —
it is a naturalist's field journal that happens to also get things done.
Two registers coexist and must stay visually distinct: **operation** (today's
tasks — brief, legible, gets out of the way) and **lore** (the grimoire world
— unhurried, spacious, wants to be looked at).

Non-negotiables inherited from architecture.md §8 (already decided, not open
for revision here):
- Iron controls floating above a living negative-space world; the world can
  cross the page field, UI appears only where an action or reading surface
  is needed.
- Noto Sans JP for operation, Shippori Mincho for lore/names/catalog headings.
- Cyan mist is the *only* saturated color, and it is scarce.
- No dashboard of equal rounded cards. No cyan glow on every control.
- Signature: a wordless broken grimoire seal (open book + water/egg core),
  legible at 32–64px with three readable masses, distinct from the v1 logo.
- Verify at 320 CSS px, 200% zoom, keyboard, screen reader labels, high
  contrast, reduced motion. WCAG 2.2 AA is the floor, not the target.

What this document adds that architecture.md left as prose: a concrete,
named token registry: a real type scale (none existed before this file —
`design-tokens.ts` had font *families* but no sizes), refined spacing/radius
naming, and component rules that make "no templated dashboard" enforceable
rather than aspirational.

---

## 1. Color

Six named colors carry the palette; everything else is a tint, an opacity,
or a state derived from these. Values below are the **light** register;
dark is the same hue family inverted for legibility, not a new palette (see
1.2). This mostly ratifies `src/styles/tokens.css`'s existing choices —
they already fit the brief — and gives them names design conversation can
use instead of `--color-line-strong`.

| Name | Hex (light) | Hex (dark) | Role |
|---|---|---|---|
| **Iron** | `#0d1311` | `#050a09` | Text-on-light, control fills, the "crisp iron control" material |
| **World** | `#e9ede8` | `#07100f` | Page ground — the negative-space the world lives in |
| **Ground** | `#dce4de` | `#0b1614` | One step off World; large environmental fields, not text surfaces |
| **Mist** | `#58cbd2` | `#68dbe1` | The one saturated accent. Focus, committed-event glow, environment reflection only — never decoration |
| **Stone** | `#53615c` | `#a0b2ab` | Muted ink — captions, secondary reads, disabled states |
| **Scrim** | `rgb(5 10 9 / 62%)` | `rgb(2 6 5 / 74%)` | Sheet/modal backdrop only |

Status colors are utilitarian, not brand — kept desaturated so Mist stays
the only color that reads as "alive":

| Name | Hex (light) | Hex (dark) |
|---|---|---|
| Success | `#146f56` | `#69caa5` |
| Warning | `#805914` | `#dfb86a` |
| Danger | `#a23b45` | `#f08a92` |

### 1.1 Mist governance (the rule most likely to get violated)

Mist appears in exactly three situations: **focus ring**, **committed-event
glow** (a task completed, a discovery made), and **environment light
reflection** in the Grimo/Catalog world. If a component wants Mist for any
other reason — a highlight, a badge, an active-tab indicator — that is the
signal the component needs redesigning, not a fourth use case for Mist.

### 1.2 Light/dark: inversion, not a second palette

Dark mode is not independently art-directed. World/Ground/Iron invert
(iron becomes near-black-on-near-black text, world becomes the deep field);
Mist, Success, Warning, Danger shift toward higher luminance so they hold
contrast against a dark field, but keep the same hue. `color-scheme` and
`prefers-color-scheme` drive selection; `data-color-scheme` allows explicit
override. `prefers-contrast: more` collapses World/Ground toward a shared
strong surface and forces line colors to `currentcolor` — implement this as
a token override, never a component-level `@media` block.

### 1.3 Two expression themes (orthogonal to color scheme)

`data-theme` selects **register**, independent of light/dark:

| Theme | Routes | Heading face | Edge treatment | Accent opacity |
|---|---|---|---|---|
| `order` | Home, Calendar, Settings | Noto Sans JP | Iron, hairline | 0.92 — present, controlled |
| `natural-history` | Grimo, Catalog | Shippori Mincho | soft line-strong | 0.78 — recedes, lets the world lead |

This is already wired in `src/app/runtime.tsx`'s route-based theme switch
and should be preserved by the rebuild, not reinvented.

---

## 2. Type

Two families, one new scale.

- **Operation** — Noto Sans JP, system-ui fallback stack. Every actionable
  surface: buttons, nav, forms, dates, list rows.
- **Lore** — Shippori Mincho, serif fallback stack. Names, catalog entries,
  world/creature copy, empty-state and error voice.

### 2.1 Scale

A restrained scale (ratio ≈1.2, "minor third") — this is a field journal,
not a marketing page; the type should not compete with the world it frames.

| Token | Size | Line-height | Use |
|---|---|---|---|
| `--text-caption` | 0.75rem (12px) | 1.4 | Timestamps, metadata, unit labels |
| `--text-body` | 0.9375rem (15px) | 1.5 | Default operation text, list rows |
| `--text-body-lg` | 1.0625rem (17px) | 1.5 | Primary reading surfaces (task detail, settings rows) |
| `--text-title` | 1.375rem (22px) | 1.3 | Screen titles (operation register) |
| `--text-lore` | 1.625rem (26px) | 1.35 | Lore/catalog headings, set in Shippori Mincho |
| `--text-display` | 2.5rem (40px) | 1.15 | Splash/emblem-adjacent moments only — rare |

Weight: operation text uses Regular/Medium only (400/500) — no bold rows;
emphasis is spacing and Iron/Stone contrast, not weight, to keep Home calm
per the brief's "gets out of the way." Lore text may use Medium (500) for
creature/area names to separate them from surrounding description.

---

## 3. Space, radius, shadow

Carried forward from `tokens.css` — these already serve the brief well and
are not being redesigned, only re-registered so the lint has one source:

| Token | Value |
|---|---|
| `--space-1` … `--space-20` | 0.25rem → 5rem, existing 8-step scale |
| `--space-page` | `clamp(1rem, 4vw, 4rem)` |
| `--radius-control` | 0.625rem — buttons, chips, inputs |
| `--radius-panel` | 1.25rem — cards, non-full-screen surfaces |
| `--radius-sheet` | 1.75rem — bottom sheets, modals |
| `--radius-round` | 999px — avatars, dots, pills |
| `--shadow-control` | `0 10px 32px rgb(6 17 14 / 13%)` |
| `--shadow-float` | `0 24px 80px rgb(5 16 13 / 18%)` |
| `--shadow-mineral` | inset highlight + hairline — the "mineral edge" signature texture from Pass 1 |

Rule: a panel gets **one** radius tier and **one** shadow tier from this
table. Mixing `--radius-panel` with `--shadow-float` on a small control (or
vice versa) is a scale mismatch, not a style choice — it is what "equal
rounded cards" looks like when it creeps in one component at a time.

## 4. Motion

Carried forward from `design-tokens.ts`'s `interactionTokens` — thorough
and correct as-is:

| Token | Value | Use |
|---|---|---|
| `--duration-instant` | 90ms | Press feedback |
| `--duration-feedback` | 180ms | Toggle, selection |
| `--duration-reveal` | 360ms | Sheet/panel entry |
| `--duration-ambient` | 12000ms | World idle motion loop |
| `--ease-press` | `cubic-bezier(.2,.8,.25,1)` | Physical press |
| `--ease-settle` | `cubic-bezier(.16,1,.3,1)` | Arrival, settle |
| `--ease-ambient` | `cubic-bezier(.45,0,.55,1)` | Slow environmental drift |

Rule: **committed-event glow** (task done, creature discovered) is the only
animation allowed to use Mist as a light source. Everything else animates
position, scale, or opacity — never introduces color.

`prefers-reduced-motion: reduce` collapses `--duration-instant/feedback/reveal`
toward near-zero and removes `--duration-ambient` entirely — this is already
implemented in `tokens.css` and must be preserved.

## 5. Layout and layers

| Token | Value |
|---|---|
| `--breakpoint-compact` | 480px |
| `--breakpoint-split` | 800px |
| `--breakpoint-wide` | 1200px |
| `--content-max` | 78rem |
| `--reading-max` | 42rem |
| `--tap-target` | 2.75rem (44px) — WCAG 2.2 AA floor, not aspirational |

Z-stack (`--layer-*`): world 0 · content 10 · navigation 30 · sheet 50 ·
toast 70 · splash 90. The world layer existing below content, not beside
it in a grid cell, is what makes "environment can cross the page field"
true — a rebuilt component must never introduce a layer value outside
this table.

---

## 6. Component rules

Only one shared component exists today (`bottom-navigation`); the rest are
per-feature. These rules are what the rebuild's *new* shared components
must follow — they exist to make Pass 2's rejections structural instead of
something a reviewer has to notice by eye each time.

1. **Control** (button, chip, input, tab): `--radius-control`,
   `--shadow-control` only on raised state (not resting), Iron fill or
   Iron outline — never a filled color chip except for the rare Mist
   committed-state. Minimum `--tap-target`.
2. **Panel** (a bounded reading/task surface): `--radius-panel`, no shadow
   at rest; `--shadow-float` only while actively dragged/focused. A panel
   never repeats the exact size/radius/shadow combination of a sibling
   panel on the same screen — if two panels want to look identical, they
   are the same component, not two panels (this is the concrete form of
   "no dashboard of equal rounded cards").
3. **Sheet** (bottom sheet, modal): `--radius-sheet`, `--shadow-mineral`
   on its top edge, `--ease-settle` entry, Scrim backdrop. Never stacks two
   sheets.
4. **Navigation**: Iron on World, hairline top border (`--color-line`), no
   active-tab color fill — active state is an Iron weight/position change,
   because color is reserved for Mist (§1.1).
5. **World surface** (Grimo/Catalog canvas or its CSS/poster fallback):
   exempt from the token registry for scene-internal values (glow color,
   blur radius, atmospheric hex) — these are one-off art direction, not
   reusable design tokens, and the raw-value lint (§7) must not flag them.
   What is *not* exempt: any chrome drawn on top of the world (buttons,
   labels, the area-trigger control) still follows rules 1–4.
6. **Emblem** (the wordless seal): exactly two assets — a ≤64px vector mark
   with three readable masses, and an atmospheric raster splash treatment.
   No third variant. Never recolored per-theme; it is Iron-on-World always.

---

## 7. Raw-value lint scope (pm-zero v12.1 §16.2)

Once the UI rebuild lands, `scripts/verify.mjs`'s lint step rejects
unregistered raw hex/px/radius/shadow values in changed files under:

    src/app/**  src/features/*/[A-Z]*.tsx  src/features/*/*.module.css (chrome parts only)
    src/ui/**  src/styles/**

**Explicitly exempt** (component rule 5): scene-internal atmosphere values
inside a feature's world-rendering surface — glow colors, blur radii,
gradient stops used for mood lighting inside Grimo/Catalog's canvas/CSS
backdrop. These are marked by a `/* world: scene value, exempt from DESIGN.md */`
comment on the same line or rule block, which the lint treats as the
registration mechanism for that exemption — not a loophole, an explicit,
grep-able opt-out.

Enforcement is decided per D-011 addendum: land as **blocking** from the
rebuild's first commit, not warn-only — because scope is narrow (chrome
only) and the exemption path above keeps false positives out of the
legitimately bespoke scene code.

---

## 8. What this document does not cover

Three.js/world rendering budgets (draw calls, triangle counts, FPS tiers)
are governed separately by `docs/quality-loop.md` and the area-specific
decisions in `grimore-v2/Grimoire_決定事項ログ.md` — this file is UI chrome
only. `ASSET_REGISTRY.md` (illustration/3D asset provenance) is a separate
optional file, added only when asset volume makes duplication a real risk
(pm-zero v12.1 §16.6) — not needed yet.

---

## 9. Tokens the rebuild added (2026-08-22, T023)

These are registered here because §7's lint reads this file. They are
additions, not revisions: no value in §§1–5 changed.

### 9.1 Fills that keep their own luminance

| Token | Light | Dark | Role |
|---|---|---|---|
| `--color-on-iron` | `#edf4ef` | `#edf4ef` | Foreground on an Iron fill |
| `--color-on-mist` | `#06110f` | `#06110f` | Foreground on a Mist fill |

`--color-ink-inverse` flips with the color scheme, which makes it the wrong
token for these two: Iron is near-black in *both* schemes and Mist is a light
cyan in both, so on a dark page `--color-ink-inverse` would put dark text on
a dark fill. Any component filling with Iron or Mist takes its foreground
from this table instead.

### 9.2 Chrome over the world

| Token | Value | Role |
|---|---|---|
| `--color-chrome-ground` | `rgb(8 16 14 / 34%)` | Translucent ground for controls floating over footage |
| `--color-chrome-line` | `rgb(255 255 255 / 14%)` | Their hairline |
| `--color-chrome-line-strong` | `rgb(255 255 255 / 26%)` | Their emphasised hairline |
| `--color-chrome-ink` | `rgb(238 248 244 / 88%)` | Their ink |
| `--color-chrome-ink-strong` | `#fff` | Their ink at current/active |
| `--blur-chrome` | `0.75rem` | Their backdrop blur |

Deliberately outside §1.2's inversion: the world keeps its own imagery in
either color scheme, so the controls above it are tuned once against that
footage rather than flipped with the page (決定事項ログ F-15).

### 9.3 Task categories

| Token | Light | Dark |
|---|---|---|
| `--color-category-job` | `#8a6a2f` | `#d7b473` |
| `--color-category-university` | `#4b5f8a` | `#9db2dd` |
| `--color-category-life` | `#4d6b4f` | `#9dc0a0` |
| `--color-category-none` | `var(--color-ink-muted)` | — |

Carried over from v1 (決定事項ログ F-4) and desaturated on purpose: a
category appears only as a small swatch, never as a fill, so Mist stays the
one color that reads as alive (§1.1).

### 9.4 Type scale and weight

§2.1's table is now emitted as `--text-*` / `--leading-*` pairs plus
`--weight-regular` (400) and `--weight-medium` (500). A component takes a
size and its matching leading from the same row — never a size from one row
and a leading from another. `src/ui/tokens/design-tokens.ts`'s
`typeScaleTokens` mirrors the same table for code that needs the numbers,
and `design-tokens.test.ts` asserts the ratio stays inside the minor third.

### 9.5 Motion has three states, not two

`prefers-reduced-motion` is the *initial* value; the in-app setting overrides
it in both directions (決定事項ログ E-5). `data-motion` is absent while the
preference is "system", `full` forces motion on against the OS preference,
and `reduced` forces it off. Both CSS and the `useReducedMotion` hook read
the same attribute, so JS-driven and CSS-driven motion cannot disagree.

---

## 10. Navigation: reconciling §6.4 with 決定事項ログ F-10/F-11/F-12

§6.4 says "Iron on World, hairline top border". F-10/F-11/F-12 say the bottom
navigation is a **transparent floating capsule**, never an opaque bar. Both
are binding, and the implementation resolves them this way:

- The capsule is translucent on every screen. What it is translucent
  *against* differs by register, so the ground, line and ink come from
  `--nav-ground` / `--nav-line` / `--nav-ink` / `--nav-ink-current`, which
  `[data-theme]` re-points: `order` maps them to the page surface tokens,
  `natural-history` to §9.2's chrome tokens.
- §6.4's substantive rule is kept verbatim: **no active-tab color fill.** The
  current destination is a soft glow plus a hairline mark — a weight and
  position change, never a color one, because color is reserved for Mist.
- The "hairline top border" is satisfied by the capsule's own hairline
  (`--nav-line`) rather than a full-width rule, since a full-width border
  under a floating capsule would draw the opaque bar the decision log
  rejects.

Press feedback is a ripple from the touched point, scoped per destination;
long press (500ms) reveals the destination name, so a first-time user can
identify a wordless target without labels living on screen permanently.
