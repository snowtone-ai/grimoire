/* World-atlas domain for the reward system (D-032).
 *
 * The research institute (already implied by existing flavor text like
 * "研究所で大切に育てられている") runs its home base in the frozen north and
 * dispatches survey expeditions to seven further world regions, each an
 * original fusion of a real-world culture/era/mythology with light fantasy
 * elements. A ninth pseudo-region ("garden") is the institute's own seasonal
 * garden — the existing month/species-linked RARE4/RARE8 mechanic — kept
 * mechanically untouched but folded into the same atlas for narrative
 * coherence. Every DropDef in drops.ts carries a `region` id from this file.
 *
 * IP boundary (same rule as D-029): borrow structure and generic cultural
 * vocabulary only. No real trademarked names, no literal deity/place names —
 * everything here is an original coinage evoking a real culture, not copying
 * one. */

export interface RegionDef {
  id: string;
  name: string;
  subtitle: string;
  /** One-line world-building blurb shown on the expedition overview card. */
  blurb: string;
  accent: string;
}

export const REGIONS: RegionDef[] = [
  {
    id: "frost",
    name: "極北氷雪圏",
    subtitle: "本部を擁する、極光と氷河の大地",
    blurb: "調査本部そのものが根を下ろす、凍てついた大地。全ての遠征はここから発つ。",
    accent: "#7fb8e0",
  },
  {
    id: "aegis",
    name: "陽光の地中海遺跡群",
    subtitle: "白亜の神殿と碧い海に眠る古代文明",
    blurb: "崩れた円柱と沈んだ港が、かつて海を統べた文明の記憶を今に伝える。",
    accent: "#4fa8c8",
  },
  {
    id: "caravan",
    name: "大砂漠の隊商路",
    subtitle: "オアシスを繋ぐ、香辛料と精霊の道",
    blurb: "星図だけを頼りに進む隊商路。砂の下には、香油と精霊譚が眠る。",
    accent: "#e0a860",
  },
  {
    id: "canopy",
    name: "密林の古代神殿",
    subtitle: "石造りの階段神殿に眠る、失われた王国",
    blurb: "蔦に飲まれた石段の先、密林の王国が遺した神殿群が静かに朽ちている。",
    accent: "#3f8f5c",
  },
  {
    id: "lantern",
    name: "東方古都の四季庭園",
    subtitle: "提灯と紙細工が彩る、千年の都",
    blurb: "石畳の路地に提灯が並ぶ古都。千年分の四季が、路地裏に積もっている。",
    accent: "#d1495b",
  },
  {
    id: "grove",
    name: "北方霧林の大樹",
    subtitle: "ルーン石と巨木が語る、古き森の伝承",
    blurb: "霧の奥で巨木が年輪を重ねる森。石に刻まれた古い文字が今も語り継がれる。",
    accent: "#4f7a6a",
  },
  {
    id: "savanna",
    name: "大草原の王国跡",
    subtitle: "黄金と太鼓が伝える、興亡の大地",
    blurb: "地平線まで続く草原に、かつて栄えた王国の礎石と太鼓の音が眠る。",
    accent: "#d1922e",
  },
  {
    id: "tide",
    name: "南海群島の潮流路",
    subtitle: "星を読み、海を渡った民の記憶",
    blurb: "星と潮流だけを頼りに大海を渡った民の航路。珊瑚礁がその記憶を抱く。",
    accent: "#2f9e8f",
  },
  {
    id: "garden",
    name: "本部の季節庭園",
    subtitle: "調査本部に併設された、四季を映す庭",
    blurb: "遠征とは別に、本部の庭では今日も季節の花が調査対象として記録されている。",
    accent: "#e8c868",
  },
];

const REGION_BY_ID: Map<string, RegionDef> = new Map(REGIONS.map((region) => [region.id, region]));

export function getRegionById(id: string): RegionDef {
  const region = REGION_BY_ID.get(id);
  if (!region) {
    // Every DropDef's region is exercised by drop-catalog.test.mjs, so this
    // only fires on a future data typo. Degrade to the garden region instead
    // of throwing mid-render (a white /book screen) — but still surface it.
    console.error(`Unknown region id: ${id}, falling back to garden`);
    return REGION_BY_ID.get("garden")!;
  }
  return region;
}

/** The eight expedition regions the atlas overview shows (excludes the home garden). */
export const EXPEDITION_REGIONS: RegionDef[] = REGIONS.filter((region) => region.id !== "garden");
