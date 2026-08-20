export interface CommittedCreaturePresentation {
  readonly schema: 1;
  readonly type: "taskCompletedFirstTime";
  readonly eventId: string;
  readonly presentationId: string;
  readonly committedAt: string;
  readonly presentationAt: number;
  readonly aggregate: Readonly<{ completionCountDelta: 1 }>;
}
type UnknownRecord = Record<string, unknown>;

function record(name: string, value: unknown): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value as UnknownRecord;
}

function exactKeys(name: string, value: UnknownRecord, allowed: readonly string[]): void {
  const known = new Set(allowed);
  const extra = Object.keys(value).find((key) => !known.has(key));
  if (extra !== undefined) {
    throw new TypeError(`${name}.${extra} is not allowed in a creature presentation`);
  }
}

function nonEmpty(name: string, value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 256) {
    throw new TypeError(`${name} must be a non-empty bounded string`);
  }
  return value;
}

/** Strict parsing keeps task titles, descriptions, and calendar bodies outside the world. */
export function parseCommittedCreaturePresentation(
  source: unknown,
): CommittedCreaturePresentation {
  const root = record("presentation", source);
  exactKeys("presentation", root, [
    "schema",
    "type",
    "eventId",
    "presentationId",
    "committedAt",
    "presentationAt",
    "aggregate",
  ]);
  if (root.schema !== 1 || root.type !== "taskCompletedFirstTime") {
    throw new TypeError("Unsupported creature presentation event");
  }
  const aggregate = record("presentation.aggregate", root.aggregate);
  exactKeys("presentation.aggregate", aggregate, ["completionCountDelta"]);
  if (aggregate.completionCountDelta !== 1) {
    throw new RangeError("presentation.aggregate.completionCountDelta must equal one");
  }
  const committedAt = nonEmpty("presentation.committedAt", root.committedAt);
  if (!Number.isFinite(Date.parse(committedAt))) {
    throw new RangeError("presentation.committedAt must be an ISO-compatible timestamp");
  }
  if (typeof root.presentationAt !== "number" || !Number.isFinite(root.presentationAt)) {
    throw new TypeError("presentation.presentationAt must be finite");
  }

  return Object.freeze({
    schema: 1,
    type: "taskCompletedFirstTime",
    eventId: nonEmpty("presentation.eventId", root.eventId),
    presentationId: nonEmpty("presentation.presentationId", root.presentationId),
    committedAt,
    presentationAt: root.presentationAt,
    aggregate: Object.freeze({ completionCountDelta: 1 }),
  });
}
