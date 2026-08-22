export { AREAS, DEFAULT_AREA_ID, findArea } from "./areas";
export type { AreaDefinition } from "./areas";
export {
  DEFAULT_CORAL_ENVIRONMENT,
  ENVIRONMENT_SCHEMA,
  UnsupportedEnvironmentSchemaError,
  normalizeEnvironmentSnapshotV3,
} from "./environment";
export type { EnvironmentSnapshotV3, QualityTier, Vec3Tuple } from "./environment";
export {
  EMPTY_WORLD_MEDIA,
  WORLD_MEDIA_SCHEMA,
  loadWorldMediaManifest,
  normalizeWorldMediaManifest,
} from "./media-manifest";
export type {
  WorldMediaEntry,
  WorldMediaManifest,
  WorldMediaSource,
} from "./media-manifest";
export { parseCommittedCreaturePresentation } from "./presentation";
export type { CommittedCreaturePresentation } from "./presentation";
