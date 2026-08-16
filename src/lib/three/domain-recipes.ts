/* Effect-recipe selection — pure logic, no Three.js/React imports.
 *
 * A "recipe" is a named particle-burst preset (see
 * src/components/three/recipe-burst.tsx for the actual Sparkles-based
 * rendering). Recipes are shared across hundreds of items by design: one
 * recipe per domain (or per legacy rarity-tier when an item has no domain),
 * tinted at render time by the item's own `color` — not one bespoke
 * animation per item, which would not scale to 400+ items for free. */

export type RecipeId = "radiant" | "arcane" | "ember" | "verdant" | "void";

export const RECIPE_IDS: RecipeId[] = ["radiant", "arcane", "ember", "verdant", "void"];

type RarityTier = "low" | "mid" | "high";

/** Mirrors sound.ts's playClear bucketing (RARE 1-3 / 4-6 / 7-8) so sound,
 * haptic, confetti, and the magic-effect recipe all agree on "how big a
 * deal this drop is" using one shared convention. */
export function tierOfRarity(rarity: number): RarityTier {
  if (rarity <= 3) return "low";
  if (rarity <= 6) return "mid";
  return "high";
}

/** New-style fantasy-domain items (domains.ts) get a fixed recipe per domain. */
const DOMAIN_DEFAULT_RECIPE: Record<string, RecipeId> = {
  embercinder: "ember",
  hollowmire: "void",
  thornveil: "verdant",
};

/** Legacy items (no `domain`) still get the new magic-effect treatment on
 * task completion, scaled by the same rarity tier used elsewhere. */
const LEGACY_RECIPE_BY_TIER: Record<RarityTier, RecipeId> = {
  low: "radiant",
  mid: "arcane",
  high: "ember",
};

/** Resolve which recipe an item/roll should play. `effect` (DropDef.effect)
 * wins when set; otherwise domain default; otherwise the legacy rarity-tier
 * default. Always returns a valid RecipeId. */
export function pickRecipe(
  domain: string | undefined,
  rarity: number,
  effect?: string
): RecipeId {
  if (effect && (RECIPE_IDS as string[]).includes(effect)) return effect as RecipeId;
  if (domain && DOMAIN_DEFAULT_RECIPE[domain]) return DOMAIN_DEFAULT_RECIPE[domain];
  return LEGACY_RECIPE_BY_TIER[tierOfRarity(rarity)];
}

/** Uniform random recipe pick for the app-open flourish (no domain/rarity context). */
export function randomRecipe(rng: () => number = Math.random): RecipeId {
  const index = Math.floor(rng() * RECIPE_IDS.length);
  return RECIPE_IDS[Math.min(index, RECIPE_IDS.length - 1)];
}
