import type { EnvironmentSnapshotV3 } from "./environment";
import type { WorldFallbackReason, WorldHealthSample } from "./fallback";

export type WorldRuntimeStatus =
  | Readonly<{ phase: "idle" }>
  | Readonly<{ phase: "loading"; progress: number; label: string }>
  | Readonly<{ phase: "live"; qualityTier: "full" | "reduced" }>
  | Readonly<{ phase: "poster" }>
  | Readonly<{ phase: "fallback"; reason: WorldFallbackReason }>;

export interface WorldRuntimeSession {
  setArea(areaId: string): Promise<void>;
  stop(): void;
  dispose(): void;
}

export interface WorldRuntimePort {
  mount(input: Readonly<{
    canvas: HTMLCanvasElement;
    areaId: string;
    onEnvironment: (snapshot: EnvironmentSnapshotV3) => void;
    onHealth: (sample: WorldHealthSample) => void;
    onStatus: (status: WorldRuntimeStatus) => void;
  }>): Promise<WorldRuntimeSession>;
}
