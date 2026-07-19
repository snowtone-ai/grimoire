"use client";

import { useCallback, useEffect, useState } from "react";
import { getDb, type PlantState } from "@/lib/db";
import {
  calcGrowthStage,
  getCurrentSpecies,
  monthKeyLocal,
  type GrowthStage,
  type PlantSpecies,
} from "@/lib/domain/plant";

async function loadPlantState(): Promise<PlantState> {
  const db = getDb();
  const monthKey = monthKeyLocal(new Date());
  const now = new Date().toISOString();
  const existing = await db.plantState.get(1);

  if (!existing) {
    const created: PlantState = {
      id: 1,
      monthlyCompleted: 0,
      monthKey,
      lifetimeCompleted: 0,
      lastUpdated: now,
    };
    await db.plantState.put(created);
    return created;
  }

  // New month: a new species arrives — a fresh start, never a mid-month loss.
  if (existing.monthKey !== monthKey) {
    const reset: PlantState = {
      ...existing,
      monthlyCompleted: 0,
      monthKey,
      lastUpdated: now,
    };
    await db.plantState.put(reset);
    return reset;
  }

  return existing;
}

async function changeCompleted(delta: 1 | -1): Promise<PlantState | null> {
  const db = getDb();
  return db.transaction("rw", db.plantState, async () => {
    const current = await loadPlantState();
    if (delta < 0 && current.monthlyCompleted <= 0) return current;

    const updated: PlantState = {
      ...current,
      monthlyCompleted: current.monthlyCompleted + delta,
      lifetimeCompleted: Math.max(0, current.lifetimeCompleted + delta),
      lastUpdated: new Date().toISOString(),
    };
    await db.plantState.put(updated);
    return updated;
  });
}

export function usePlant() {
  const [state, setState] = useState<PlantState | null>(null);
  const species: PlantSpecies = getCurrentSpecies();
  const stage: GrowthStage = state ? calcGrowthStage(state.monthlyCompleted) : 0;

  useEffect(() => {
    loadPlantState()
      .then(setState)
      .catch((err) => console.error("[plant] load failed:", err));
  }, []);

  const incrementCompleted = useCallback(async () => {
    const updated = await changeCompleted(1);
    if (updated) setState(updated);
  }, []);

  const decrementCompleted = useCallback(async () => {
    const updated = await changeCompleted(-1);
    if (updated) setState(updated);
  }, []);

  return { state, species, stage, incrementCompleted, decrementCompleted };
}
