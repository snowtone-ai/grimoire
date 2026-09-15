"use client";

import type { GrowthStage, PlantSpecies } from "@/lib/domain/plant";
import { CherryBlossom } from "./cherry-blossom";
import { DelicateFlower } from "./delicate-flower";
import { HangingCluster } from "./hanging-cluster";
import { UprightFlower } from "./upright-flower";

interface Props {
  species: PlantSpecies;
  stage: GrowthStage;
}

export function PlantRenderer({ species, stage }: Props) {
  const props = {
    stage,
    color: species.color,
    accentColor: species.accentColor,
    speciesName: species.nameEn,
  };

  switch (species.archetype) {
    case "cherry":
      return <CherryBlossom {...props} />;
    case "hanging":
      return <HangingCluster {...props} />;
    case "delicate":
      return <DelicateFlower {...props} />;
    default:
      return <UprightFlower {...props} />;
  }
}
