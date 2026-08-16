/* Fantasy-domain layer for the item visual overhaul prototype (branch
 * feat/fantasy-item-visual-overhaul, see the approved plan in
 * C:\Users\chidj\.claude\plans\expressive-wobbling-meteor.md).
 *
 * Independent of `region` (regions.ts) — region stays reserved for the 8
 * existing world-atlas expedition regions + "garden" (their tests/invariants
 * are untouched). New-style items additionally carry a `domain` id from
 * here, which drives both flavor grouping and effect-recipe selection
 * (src/lib/three/domain-recipes.ts). No narrative consistency across domains
 * is intended — each domain freely blends Monster-Hunter-style nature
 * fantasy with Elden-Ring-style dark mythology, per the user's explicit
 * instruction that individual item appeal outranks world coherence.
 *
 * IP boundary (same rule as D-029/D-032): original coinage only, no real
 * trademarked names, no literal game terminology. */

export interface DomainDef {
  id: string;
  name: string;
  subtitle: string;
  blurb: string;
  accent: string;
}

export const DOMAINS: DomainDef[] = [
  {
    id: "embercinder",
    name: "灰燼の刃庭",
    subtitle: "焼け落ちた戦場が、庭として生まれ変わった地",
    blurb: "折れた刃と灰の下から、季節ごとに新しい炎が芽吹くという奇妙な庭。",
    accent: "#e0633a",
  },
  {
    id: "hollowmire",
    name: "虚ろの瘴湿地",
    subtitle: "沈んだ王が、まだ何かを統べていると噂される湿地",
    blurb: "瘴気の底に沈んだ墓標と杯。触れた者の記憶に、少しだけ長く残るという。",
    accent: "#7a5ea8",
  },
  {
    id: "thornveil",
    name: "棘紗の森",
    subtitle: "美しさと危うさが同じ棘に同居する森",
    blurb: "踏み入るほど深くなる森。採取したものほど、なぜか目を引く色をしている。",
    accent: "#4f8f52",
  },
];

const DOMAIN_BY_ID: Map<string, DomainDef> = new Map(DOMAINS.map((domain) => [domain.id, domain]));

export function getDomainById(id: string): DomainDef | undefined {
  return DOMAIN_BY_ID.get(id);
}
