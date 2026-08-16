"use client";

import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import type { RecipeId } from "@/lib/three/domain-recipes";

/* Momentary full-surface particle burst — used for the app-open flourish
 * (src/components/effects/app-open-flourish.tsx) and the task-completion
 * magic effect (wired from use-home-screen.ts). Reuses drei's <Sparkles>
 * (battle-tested particle primitive) rather than hand-rolling particle
 * physics, per the "imitate proven existing work" design guidance — each
 * recipe is just a differently-tuned Sparkles preset, tinted by the
 * caller's color at render time so it scales to hundreds of items for
 * free. Mounts/unmounts its own <Canvas>; React unmounting disposes the
 * WebGL context, so callers just need to stop rendering this component
 * when done (never keep more than one of these mounted at once). */

const PRESETS: Record<
  RecipeId,
  { count: number; scale: number; size: number; speed: number; opacity: number }
> = {
  radiant: { count: 40, scale: 2.2, size: 2, speed: 0.3, opacity: 0.85 },
  arcane: { count: 60, scale: 3, size: 3, speed: 0.6, opacity: 0.9 },
  ember: { count: 90, scale: 2.6, size: 4, speed: 1.3, opacity: 1 },
  verdant: { count: 50, scale: 2.6, size: 2.5, speed: 0.2, opacity: 0.75 },
  void: { count: 70, scale: 1.8, size: 3, speed: 0.85, opacity: 0.85 },
};

interface RecipeBurstProps {
  recipe: RecipeId;
  color: string;
  /** Called once after `durationMs` — callers use this to unmount the burst. */
  onDone?: () => void;
  durationMs?: number;
}

export function RecipeBurst({ recipe, color, onDone, durationMs = 1300 }: RecipeBurstProps) {
  useEffect(() => {
    if (!onDone) return;
    const timer = setTimeout(onDone, durationMs);
    return () => clearTimeout(timer);
  }, [onDone, durationMs]);

  const preset = PRESETS[recipe];

  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 45 }}
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 1.5]}
      style={{ pointerEvents: "none" }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 0, 4]} color={color} intensity={2.2} />
      <Sparkles
        count={preset.count}
        scale={preset.scale}
        size={preset.size}
        speed={preset.speed}
        opacity={preset.opacity}
        color={color}
      />
    </Canvas>
  );
}
