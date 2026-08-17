/* Effects preferences — independent per-effect toggles (D-039, replacing the
 * quiet/normal/lively dial from D-036).
 *
 * D-036 chose one three-step dial specifically to avoid a 2^N toggle explosion and
 * the decision-fatigue cost of scanning many switches for an ADHD-persona user.
 * That reasoning has not gone away — it is why this file still ships a curated set
 * of six keys (one per distinct "moment" in the app, not one per animation detail)
 * and why DEFAULT_EFFECT_PREFS keeps the smallest footprint that still matches
 * D-036's validated "normal" tier for the pre-existing effects. What changed is
 * the shape of the choice: this rebuild (T036) adds enough genuinely new, heavier
 * effects (an app-open flourish, an ambient particle layer, per-page transition
 * themes) that folding them into one dial would force an all-or-nothing tradeoff —
 * someone who wants the tap spark and completion confetti but not a multi-second
 * open-app flourish had no way to say so under the old model. Each new, heavier
 * effect defaults to off; the two effects already proven at D-036's "normal"
 * default stay on. Sound/haptics are deliberately NOT one of these keys: they
 * keep their own pre-existing independent toggle in sound.ts (fx-enabled), which
 * — per D-036 — must NOT be forced off by OS reduced-motion, since that media
 * query is a motion signal, not an audio one. Every key below IS a visual/motion
 * effect, so reduced-motion always overrides them regardless of stored preference.
 */

export type EffectKey =
  | "tapSpark"
  | "completion"
  | "morningGreeting"
  | "openFlourish"
  | "ambientParticles"
  | "pageTransitions";

/** Ordered for settings-screen display: proven-default-on effects first, then the
 * new heavier ones. */
export const EFFECT_KEYS: readonly EffectKey[] = [
  "tapSpark",
  "completion",
  "morningGreeting",
  "openFlourish",
  "ambientParticles",
  "pageTransitions",
];

export type SettingsSection = "basic" | "more";

/** Assigns every effect to one of the two settings-screen sections
 * ("基本のフィードバック" / "追加の演出"). settings-screen.tsx filters
 * EFFECT_KEYS through this map instead of keeping its own hardcoded row
 * lists, so a future EffectKey can't type-check and ship without a visible
 * settings row — tests/lib/domain/fx.test.mjs asserts every key here has
 * exactly one section. */
export const EFFECT_SECTIONS: Record<EffectKey, SettingsSection> = {
  tapSpark: "basic",
  completion: "basic",
  morningGreeting: "more",
  openFlourish: "more",
  ambientParticles: "more",
  pageTransitions: "more",
};

export const DEFAULT_EFFECT_PREFS: Record<EffectKey, boolean> = {
  tapSpark: true,
  completion: true,
  morningGreeting: false,
  openFlourish: false,
  ambientParticles: false,
  pageTransitions: false,
};

export interface EffectLabel {
  label: string;
  description: string;
}

export const EFFECT_LABELS: Record<EffectKey, EffectLabel> = {
  tapSpark: {
    label: "タップの光",
    description: "ボタンを押すたび、一瞬キラッと光ります。",
  },
  completion: {
    label: "完了エフェクト",
    description: "クエスト達成の紙吹雪と、全達成ファンファーレ。",
  },
  morningGreeting: {
    label: "朝のあいさつ演出",
    description: "朝早く開いたとき、穏やかな光と音で出迎えます。",
  },
  openFlourish: {
    label: "起動時の演出",
    description: "アプリを開いた瞬間、豪華な光の演出が流れます。",
  },
  ambientParticles: {
    label: "背景の光の粒子",
    description: "研究所以外の画面に、金色の光の粒がゆっくり漂います。",
  },
  pageTransitions: {
    label: "ページごとの遷移演出",
    description: "画面を切り替えるたび、そのページらしい演出が流れます。",
  },
};

/**
 * Resolves the effective on/off state for one effect from a stored preference and
 * the OS-level reduced-motion setting. `reducedMotion` always wins — every key in
 * this file is a visual/motion effect, so a user who has told their OS to cut down
 * on motion should never get one back out of localStorage. Otherwise, fall back to
 * the curated default when `stored` is absent.
 */
export function resolveEffect(
  key: EffectKey,
  stored: boolean | null | undefined,
  reducedMotion: boolean
): boolean {
  if (reducedMotion) return false;
  return stored ?? DEFAULT_EFFECT_PREFS[key];
}
