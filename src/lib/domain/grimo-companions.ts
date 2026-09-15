export type GrimoId = "carol" | "pino" | "jill" | "shushu" | "muu";

export type TouchZone = "crown" | "face" | "left-fleece" | "right-fleece" | "feet";

export type GrimoCompanion = {
  id: GrimoId;
  name: string;
  world: string;
  assetPath?: string;
  touchZones: readonly TouchZone[];
};

// This is intentionally data, rather than five scene components. Each new
// companion supplies its own asset and motion grammar after its source art has
// passed the same canonical-asset review as Carol.
export const GRIMO_COMPANIONS: readonly GrimoCompanion[] = [
  { id: "carol", name: "キャロル", world: "星眠りの雲床", assetPath: "/grimo/carol-transparent.png", touchZones: ["crown", "face", "left-fleece", "right-fleece", "feet"] },
  { id: "pino", name: "ピノ", world: "泡ひかる浅瀬", touchZones: [] },
  { id: "jill", name: "ジル", world: "苔むす竜の林", touchZones: [] },
  { id: "shushu", name: "シュシュ", world: "花まどろむ庭", touchZones: [] },
  { id: "muu", name: "ムゥ", world: "虹音の花丘", touchZones: [] },
] as const;

export const CAROL = GRIMO_COMPANIONS[0];

export function classifyCarolTouch({ x, y }: { x: number; y: number }): TouchZone {
  if (y < -0.45) return "feet";
  if (x > 0.1 && x < 0.72 && y > -0.05 && y < 0.38) return "face";
  if (y > 0.48) return "crown";
  return x < 0 ? "left-fleece" : "right-fleece";
}

export function carolTouchImpulse(zone: TouchZone) {
  switch (zone) {
    case "crown": return { characterX: 0, characterY: -0.78, cloud: 0.48, stars: 0.18 };
    case "face": return { characterX: -0.16, characterY: 0.1, cloud: 0.2, stars: 0.82 };
    case "left-fleece": return { characterX: -0.9, characterY: 0.08, cloud: 0.72, stars: 0.3 };
    case "right-fleece": return { characterX: 0.9, characterY: 0.08, cloud: 0.72, stars: 0.3 };
    case "feet": return { characterX: 0, characterY: 0.62, cloud: 0.88, stars: 0.14 };
  }
}
