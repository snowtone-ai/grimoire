export {
  DEFAULT_CORAL_ENVIRONMENT,
  ENVIRONMENT_SCHEMA,
  UnsupportedEnvironmentSchemaError,
  normalizeEnvironmentSnapshotV3,
} from "./environment";
export type { EnvironmentSnapshotV3, QualityTier, Vec3Tuple } from "./environment";
export { WorldFallbackGuard } from "./fallback";
export type {
  WorldFallbackDecision,
  WorldFallbackReason,
  WorldHealthSample,
} from "./fallback";
export { parseCommittedCreaturePresentation } from "./presentation";
export type { CommittedCreaturePresentation } from "./presentation";
export type { WorldRuntimePort, WorldRuntimeSession, WorldRuntimeStatus } from "./runtime";
