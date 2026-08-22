// New in v2 (D-013 / F-4 / H-3): common shape for every external import
// source (Google Calendar, Gmail). v1 had no equivalent — each source
// returned its own task-shaped payload, including a category guess and
// source-identifying fields (event id, message id, sender). Those leaked
// which integration a candidate came from all the way to the UI.
//
// F-4/H-3 require that imported items reach the screen in a common format
// that does not reveal their origin, so every source-specific field is
// dropped or folded into `description`, and the only identity that survives
// is an opaque `externalId` used purely for de-duplication.

/** Normalized inbound item. The UI must not be able to tell where it came from. */
export interface ImportedScheduleItem {
  /** Stable id derived from the source record, used to avoid double-import. */
  readonly externalId: string;
  readonly title: string;
  readonly localDate: string; // 'YYYY-MM-DD'
  readonly scheduledTime?: string; // 'HH:mm'
  readonly description?: string;
}
